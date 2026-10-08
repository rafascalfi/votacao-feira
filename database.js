const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Garante que o diretório de dados existe
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'votacao.db');
const db = new DatabaseSync(dbPath);

// Inicializa as tabelas do banco de dados
function initDatabase() {
  // Tabela de Configuração
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Tabela de Equipes
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      category TEXT,
      icon TEXT,
      color TEXT
    );
  `);

  // Tabela de Votos
  db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      fingerprint TEXT NOT NULL,
      voter_token TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      device_summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );
    CREATE INDEX IF NOT EXISTS idx_votes_fingerprint ON votes(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_votes_token ON votes(voter_token);
  `);

  // Configuração padrão
  const getOpenStmt = db.prepare("SELECT value FROM config WHERE key = 'voting_open'");
  const openRow = getOpenStmt.get();
  if (!openRow) {
    db.prepare("INSERT INTO config (key, value) VALUES ('voting_open', 'true')").run();
  }

  const getPinStmt = db.prepare("SELECT value FROM config WHERE key = 'admin_pin'");
  const pinRow = getPinStmt.get();
  if (!pinRow) {
    db.prepare("INSERT INTO config (key, value) VALUES ('admin_pin', 'feira2024')").run();
  }

  // Cadastro das 8 equipes oficiais da feira
  const initialTeams = [
    {
      name: "Rainhas do Amazonas",
      slug: "rainhas-do-amazonas",
      description: "Bioeconomia, conservação ambiental e inovação sustentável valorizando a Amazônia.",
      category: "Sustentabilidade & Meio Ambiente",
      icon: "fa-leaf",
      color: "emerald"
    },
    {
      name: "The Gag",
      slug: "the-gag",
      description: "Comunicação criativa, mídia interativa e soluções engajadoras para o público.",
      category: "Criatividade & Entretenimento",
      icon: "fa-masks-theater",
      color: "purple"
    },
    {
      name: "Factory on the Island",
      slug: "factory-on-the-island",
      description: "Conceito inovador de fábrica autônoma, modular e conectada com Indústria 4.0.",
      category: "Indústria & Automação",
      icon: "fa-industry",
      color: "amber"
    },
    {
      name: "AgroLock",
      slug: "agrolock",
      description: "Tecnologia inteligente para proteção, segurança de ativos e rastreabilidade no campo.",
      category: "Agrotecnologia & Segurança",
      icon: "fa-shield-halved",
      color: "green"
    },
    {
      name: "SafeLift",
      slug: "safelift",
      description: "Sistema avançado de segurança, ergonomia e prevenção de acidentes em içamentos de carga.",
      category: "Segurança & Engenharia",
      icon: "fa-helmet-safety",
      color: "orange"
    },
    {
      name: "Linha Omega",
      slug: "linha-omega",
      description: "Otimização de processos produtivos, fluxo operacional contínuo e eficiência logística.",
      category: "Eficiência & Produção",
      icon: "fa-gears",
      color: "cyan"
    },
    {
      name: "Virtual Restorage",
      slug: "virtual-restorage",
      description: "Soluções inteligentes em redundância, recuperação e armazenamento em nuvem.",
      category: "Tecnologia da Informação",
      icon: "fa-cloud-arrow-up",
      color: "blue"
    },
    {
      name: "Simulador Torno CNC",
      slug: "simulador-torno-cnc",
      description: "Simulação virtual realista para treinamento de usinagem e manufatura assistida por computador.",
      category: "Manufatura Digital & CNC",
      icon: "fa-microchip",
      color: "rose"
    }
  ];

  const countTeams = db.prepare("SELECT COUNT(*) as count FROM teams").get();
  if (countTeams.count === 0) {
    const insertTeam = db.prepare(`
      INSERT INTO teams (name, slug, description, category, icon, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const team of initialTeams) {
      insertTeam.run(team.name, team.slug, team.description, team.category, team.icon, team.color);
    }
    console.log("As 8 equipes foram cadastradas com sucesso no banco de dados.");
  }
}

// Inicializa no carregamento
initDatabase();

module.exports = {
  db,
  isVotingOpen: () => {
    const row = db.prepare("SELECT value FROM config WHERE key = 'voting_open'").get();
    return row ? row.value === 'true' : true;
  },
  setVotingOpen: (isOpen) => {
    db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('voting_open', ?)").run(isOpen ? 'true' : 'false');
  },
  getAdminPin: () => {
    const row = db.prepare("SELECT value FROM config WHERE key = 'admin_pin'").get();
    return row ? row.value : 'feira2024';
  },
  setAdminPin: (newPin) => {
    db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('admin_pin', ?)").run(newPin);
  },
  getTeams: () => {
    return db.prepare("SELECT * FROM teams ORDER BY id ASC").all();
  },
  getTeamById: (id) => {
    return db.prepare("SELECT * FROM teams WHERE id = ?").get(id);
  },
  checkExistingVote: (fingerprint, voterToken) => {
    // Verifica se já existe voto registrado com esse fingerprint ou token
    const stmt = db.prepare(`
      SELECT v.*, t.name as team_name, t.category as team_category 
      FROM votes v
      JOIN teams t ON v.team_id = t.id
      WHERE v.fingerprint = ? OR v.voter_token = ?
      LIMIT 1
    `);
    return stmt.get(fingerprint, voterToken);
  },
  registerVote: ({ teamId, fingerprint, voterToken, ipAddress, userAgent, deviceSummary }) => {
    const insert = db.prepare(`
      INSERT INTO votes (team_id, fingerprint, voter_token, ip_address, user_agent, device_summary)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return insert.run(teamId, fingerprint, voterToken, ipAddress, userAgent, deviceSummary || 'Dispositivo');
  },
  getResults: () => {
    const totalRow = db.prepare("SELECT COUNT(*) as total FROM votes").get();
    const totalVotes = totalRow.total || 0;

    const rows = db.prepare(`
      SELECT 
        t.id, 
        t.name, 
        t.slug, 
        t.category, 
        t.icon, 
        t.color,
        COUNT(v.id) as votes_count
      FROM teams t
      LEFT JOIN votes v ON t.id = v.team_id
      GROUP BY t.id
      ORDER BY votes_count DESC, t.name ASC
    `).all();

    const results = rows.map((team, index) => {
      const votes = Number(team.votes_count);
      const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : "0.0";
      return {
        ...team,
        votes,
        percentage: Number(percentage),
        rank: index + 1
      };
    });

    return {
      totalVotes,
      teams: results
    };
  },
  getRecentVotes: (limit = 30) => {
    return db.prepare(`
      SELECT 
        v.id,
        t.name as team_name,
        v.device_summary,
        SUBSTR(v.fingerprint, 1, 8) || '...' as masked_fingerprint,
        v.created_at
      FROM votes v
      JOIN teams t ON v.team_id = t.id
      ORDER BY v.id DESC
      LIMIT ?
    `).all(limit);
  },
  getAllVotesForExport: () => {
    return db.prepare(`
      SELECT 
        v.id,
        t.name as equipe,
        t.category as categoria,
        v.device_summary as dispositivo,
        v.ip_address as ip,
        v.fingerprint,
        v.voter_token,
        v.created_at as data_hora
      FROM votes v
      JOIN teams t ON v.team_id = t.id
      ORDER BY v.id ASC
    `).all();
  },
  resetAllVotes: () => {
    db.exec("DELETE FROM votes;");
    db.exec("DELETE FROM sqlite_sequence WHERE name = 'votes';");
  }
};
