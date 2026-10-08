const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações e Middlewares
app.use(cors());
app.use(express.json());
app.use(cookieParser('feira-secret-salt-2024'));
app.use(express.static(path.join(__dirname, 'public')));

// Função auxiliar para capturar IP real (inclusive atrás de proxies/túneis)
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || req.ip;
}

// Middleware de autenticação de administrador
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.cookies['feira_admin_auth'] || req.query.auth;
  const currentPin = db.getAdminPin();
  
  if (token && token === currentPin) {
    return next();
  }
  return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Acesso não autorizado ao painel.' });
}

// ================= ROTAS PÚBLICAS DA VOTAÇÃO ================= //

/**
 * Retorna o status da votação e se o visitante já votou
 */
app.get('/api/status', (req, res) => {
  try {
    const fingerprint = req.query.fingerprint || '';
    const voterToken = req.query.voterToken || req.cookies['feira_voter_token'] || '';
    const votingOpen = db.isVotingOpen();
    const teams = db.getTeams();

    let alreadyVoted = false;
    let votedTeam = null;
    let votedAt = null;

    if (fingerprint || voterToken) {
      const existing = db.checkExistingVote(fingerprint, voterToken);
      if (existing) {
        alreadyVoted = true;
        votedTeam = {
          id: existing.team_id,
          name: existing.team_name,
          category: existing.team_category
        };
        votedAt = existing.created_at;
      }
    }

    res.json({
      votingOpen,
      alreadyVoted,
      votedTeam,
      votedAt,
      teams
    });
  } catch (err) {
    console.error('Erro ao consultar status:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao verificar status.' });
  }
});

/**
 * Registra o voto com tripla validação (Fingerprint + Token + Cookie)
 */
app.post('/api/vote', (req, res) => {
  try {
    const { teamId, fingerprint, voterToken, deviceSummary } = req.body;
    const cookieToken = req.cookies['feira_voter_token'];

    // 1. Verifica se a votação está aberta
    if (!db.isVotingOpen()) {
      return res.status(403).json({
        error: 'VOTING_CLOSED',
        message: 'A votação está encerrada ou temporariamente pausada pelos organizadores.'
      });
    }

    // 2. Valida os campos obrigatórios
    if (!teamId || !fingerprint) {
      return res.status(400).json({
        error: 'INVALID_DATA',
        message: 'Identificação de equipe ou do dispositivo ausente.'
      });
    }

    const effectiveToken = voterToken || cookieToken || ('token_' + Date.now());

    // 3. Valida se a equipe escolhida existe
    const team = db.getTeamById(Number(teamId));
    if (!team) {
      return res.status(404).json({
        error: 'TEAM_NOT_FOUND',
        message: 'Equipe selecionada não foi encontrada.'
      });
    }

    // 4. Validação anti-duplicação: Verifica se o dispositivo ou token já votou
    const existing = db.checkExistingVote(fingerprint, effectiveToken);
    if (existing) {
      return res.status(409).json({
        error: 'ALREADY_VOTED',
        message: `Este dispositivo já registrou um voto anteriormente para a equipe "${existing.team_name}".`,
        teamName: existing.team_name,
        votedAt: existing.created_at
      });
    }

    // 5. Registra o voto no banco de dados
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Desconhecido';

    db.registerVote({
      teamId: Number(teamId),
      fingerprint,
      voterToken: effectiveToken,
      ipAddress: ip,
      userAgent,
      deviceSummary: deviceSummary || 'Dispositivo Móvel/Web'
    });

    // 6. Define cookie persistente por 1 ano
    res.cookie('feira_voter_token', effectiveToken, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax'
    });

    return res.json({
      success: true,
      message: 'Voto computado com sucesso!',
      teamName: team.name,
      category: team.category,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erro ao registrar voto:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Erro interno ao processar seu voto. Tente novamente.'
    });
  }
});

// ================= ROTAS DO PAINEL DE ADMINISTRAÇÃO ================= //

/**
 * Login no painel administrativo
 */
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  const currentPin = db.getAdminPin();

  if (pin && pin.trim() === currentPin) {
    res.cookie('feira_admin_auth', currentPin, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax'
    });
    return res.json({ success: true, token: currentPin });
  }

  return res.status(401).json({ error: 'INVALID_PIN', message: 'Senha/PIN de administrador incorreta.' });
});

/**
 * Estatísticas e apuração ao vivo
 */
app.get('/api/admin/stats', adminAuth, (req, res) => {
  try {
    const stats = db.getResults();
    const votingOpen = db.isVotingOpen();
    const recentVotes = db.getRecentVotes(40);

    res.json({
      votingOpen,
      totalVotes: stats.totalVotes,
      teams: stats.teams,
      recentVotes
    });
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Erro ao carregar apuração.' });
  }
});

/**
 * Abrir / Pausar a votação
 */
app.post('/api/admin/toggle-voting', adminAuth, (req, res) => {
  try {
    const { open } = req.body;
    db.setVotingOpen(Boolean(open));
    res.json({ success: true, votingOpen: db.isVotingOpen() });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Erro ao alterar estado da votação.' });
  }
});

/**
 * Alterar senha/PIN de administrador
 */
app.post('/api/admin/change-pin', adminAuth, (req, res) => {
  try {
    const { newPin } = req.body;
    if (!newPin || newPin.trim().length < 4) {
      return res.status(400).json({ error: 'INVALID_PIN', message: 'O PIN deve conter pelo menos 4 caracteres.' });
    }
    db.setAdminPin(newPin.trim());
    res.cookie('feira_admin_auth', newPin.trim(), {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax'
    });
    res.json({ success: true, message: 'Senha administrativa atualizada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Erro ao alterar PIN.' });
  }
});

/**
 * Zerar todos os votos (para limpar testes antes de abrir para o público)
 */
app.post('/api/admin/reset-votes', adminAuth, (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'ZERAR') {
      return res.status(400).json({ error: 'CONFIRMATION_REQUIRED', message: 'Digite ZERAR para confirmar a exclusão de todos os votos.' });
    }
    db.resetAllVotes();
    res.json({ success: true, message: 'Todos os votos foram zerados com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Erro ao zerar votos.' });
  }
});

/**
 * Exportar todos os votos em formato CSV (Excel)
 */
app.get('/api/admin/export-csv', adminAuth, (req, res) => {
  try {
    const votes = db.getAllVotesForExport();
    
    // Cabeçalho CSV com BOM para abrir perfeitamente no Excel no Brasil
    let csv = '\uFEFFID;Equipe;Categoria;Dispositivo;IP;Data_Hora;Fingerprint_Hash\n';
    
    for (const v of votes) {
      const cleanEquipe = (v.equipe || '').replace(/;/g, ',');
      const cleanCat = (v.categoria || '').replace(/;/g, ',');
      const cleanDisp = (v.dispositivo || '').replace(/;/g, ',');
      const cleanIp = (v.ip || '').replace(/;/g, ',');
      const cleanData = (v.data_hora || '').replace(/;/g, ',');
      const cleanFp = (v.fingerprint || '').replace(/;/g, ',');
      csv += `${v.id};"${cleanEquipe}";"${cleanCat}";"${cleanDisp}";"${cleanIp}";"${cleanData}";"${cleanFp}"\n`;
    }

    const filename = `relatorio_votacao_feira_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Erro ao exportar CSV:', err);
    res.status(500).send('Erro ao gerar relatório CSV.');
  }
});

// Redirecionamento das rotas amigáveis
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Sistema de Votação da Feira rodando com sucesso!`);
  console.log(`📱 Link para votação:    http://localhost:${PORT}`);
  console.log(`📊 Painel administrativo: http://localhost:${PORT}/admin`);
  console.log(`🔑 Senha padrão Admin:   ${db.getAdminPin()}`);
  console.log(`======================================================\n`);
});
