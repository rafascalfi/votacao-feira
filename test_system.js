const http = require('http');

// Inicia o servidor em segundo plano para teste
const server = require('./server');

async function runTests() {
  console.log('--- Iniciando Testes Automatizados do Sistema ---');

  const baseUrl = 'http://localhost:3000';

  // Helper para requisições HTTP
  function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const options = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed, raw: data, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data, headers: res.headers });
          }
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  try {
    // 1. Testa status inicial
    console.log('1. Testando /api/status...');
    const status1 = await request('GET', '/api/status');
    console.log(`-> Status: ${status1.status}, Equipes cadastradas: ${status1.data.teams.length}`);
    if (status1.data.teams.length !== 8) throw new Error('Deveriam existir 8 equipes cadastradas!');

    // 2. Testa registro de primeiro voto
    console.log('2. Testando primeiro voto (Equipe 1 - Rainhas do Amazonas)...');
    const vote1 = await request('POST', '/api/vote', {
      teamId: 1,
      fingerprint: 'test_device_fingerprint_001',
      voterToken: 'token_001',
      deviceSummary: 'iPhone (Safari)'
    });
    console.log(`-> Resposta Voto 1: Status ${vote1.status}`, vote1.data);
    if (vote1.status !== 200 || !vote1.data.success) throw new Error('Primeiro voto deveria ser aceito!');

    // 3. Testa tentativa de voto DUPLICADO no mesmo dispositivo
    console.log('3. Testando tentativa de voto duplicado com o mesmo fingerprint...');
    const voteDuplicate = await request('POST', '/api/vote', {
      teamId: 2,
      fingerprint: 'test_device_fingerprint_001',
      voterToken: 'token_001',
      deviceSummary: 'iPhone (Safari)'
    });
    console.log(`-> Resposta Voto Duplicado: Status ${voteDuplicate.status} (Esperado: 409)`, voteDuplicate.data);
    if (voteDuplicate.status !== 409) throw new Error('Voto duplicado deveria ter sido bloqueado com código 409!');

    // 4. Testa voto de outro dispositivo
    console.log('4. Testando voto de um segundo dispositivo diferente (Equipe 4 - AgroLock)...');
    const vote2 = await request('POST', '/api/vote', {
      teamId: 4,
      fingerprint: 'test_device_fingerprint_002',
      voterToken: 'token_002',
      deviceSummary: 'Android (Chrome)'
    });
    console.log(`-> Resposta Voto 2: Status ${vote2.status}`, vote2.data);
    if (vote2.status !== 200) throw new Error('Segundo voto deveria ser aceito!');

    // 5. Testa login de administrador
    console.log('5. Testando login do painel admin com PIN feira2024...');
    const adminLogin = await request('POST', '/api/admin/login', { pin: 'feira2024' });
    console.log(`-> Status Login Admin: ${adminLogin.status}`, adminLogin.data);
    if (adminLogin.status !== 200 || !adminLogin.data.token) throw new Error('Login do admin falhou!');

    // 6. Testa apuração de estatísticas
    console.log('6. Testando /api/admin/stats...');
    const stats = await request('GET', '/api/admin/stats', null, { 'x-admin-token': 'feira2024' });
    console.log(`-> Total de votos: ${stats.data.totalVotes}`);
    console.log(`-> Ranking parcial:`, stats.data.teams.slice(0, 3).map(t => `${t.name}: ${t.votes} votos (${t.percentage}%)`));
    if (stats.data.totalVotes !== 2) throw new Error('Deveriam haver 2 votos computados!');

    // 7. Testa zerar votos para deixar o sistema limpo para o cliente
    console.log('7. Limpando votos de teste com ZERAR...');
    const reset = await request('POST', '/api/admin/reset-votes', { confirmation: 'ZERAR' }, { 'x-admin-token': 'feira2024' });
    console.log(`-> Status Reset: ${reset.status}`, reset.data);

    const statsClean = await request('GET', '/api/admin/stats', null, { 'x-admin-token': 'feira2024' });
    console.log(`-> Votos após limpeza: ${statsClean.data.totalVotes}`);
    if (statsClean.data.totalVotes !== 0) throw new Error('Votos deveriam estar zerados após reset!');

    console.log('\n✅ TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!\n');
    process.exit(0);

  } catch (err) {
    console.error('❌ ERRO NO TESTE:', err);
    process.exit(1);
  }
}

// Aguarda 1 segundo para o server subir e roda
setTimeout(runTests, 1000);
