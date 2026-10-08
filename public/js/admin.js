// Lógica do Painel Administrativo

let adminToken = localStorage.getItem('feira_admin_token') || '';
let isVotingCurrentlyOpen = true;
let refreshInterval = null;
let qrcodeInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    showDashboard();
  } else {
    showLogin();
  }
});

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('admin-dashboard').classList.add('hidden');
  if (refreshInterval) clearInterval(refreshInterval);
}

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.remove('hidden');

  initQRCode();
  loadAdminStats();

  // Atualização em tempo real a cada 5 segundos
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(loadAdminStats, 5000);
}

// Manipulador do formulário de Login
async function handleLogin(e) {
  e.preventDefault();
  const pinInput = document.getElementById('admin-pin-input');
  const pin = pinInput.value.trim();

  if (!pin) return;

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Verificando...</span>`;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || 'Senha incorreta!');
      pinInput.value = '';
      pinInput.focus();
      return;
    }

    adminToken = data.token || pin;
    localStorage.setItem('feira_admin_token', adminToken);
    showDashboard();

  } catch (err) {
    alert('Erro de conexão ao autenticar.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Entrar no Painel</span><i class="fa-solid fa-arrow-right"></i>`;
  }
}

function logoutAdmin() {
  localStorage.removeItem('feira_admin_token');
  adminToken = '';
  document.cookie = "feira_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  showLogin();
}

// Carrega as estatísticas do servidor
async function loadAdminStats() {
  if (!adminToken) return;

  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'x-admin-token': adminToken }
    });

    if (res.status === 401) {
      logoutAdmin();
      return;
    }

    const data = await res.json();
    isVotingCurrentlyOpen = data.votingOpen;

    // Atualiza Métricas
    document.getElementById('metric-total-votes').textContent = data.totalVotes;
    
    // Líder
    if (data.teams && data.teams.length > 0) {
      const leader = data.teams[0];
      document.getElementById('metric-leader-name').textContent = leader.votes > 0 ? leader.name : 'Aguardando votos';
      document.getElementById('metric-leader-votes').textContent = leader.votes > 0 ? `${leader.votes} votos (${leader.percentage}%)` : '0 votos computados';
    }

    // Status da Votação
    const statusText = document.getElementById('metric-status-text');
    const statusWrap = document.getElementById('metric-status-icon-wrap');
    const toggleBtn = document.getElementById('btn-toggle-voting');

    if (isVotingCurrentlyOpen) {
      statusText.textContent = "Aberta";
      statusText.className = "text-xl font-bold text-emerald-400 mt-1";
      statusWrap.className = "w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-2xl";
      
      toggleBtn.className = "px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-2 transition border bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40";
      toggleBtn.innerHTML = `<i class="fa-solid fa-pause"></i><span>Pausar Votação</span>`;
    } else {
      statusText.textContent = "Pausada";
      statusText.className = "text-xl font-bold text-amber-400 mt-1";
      statusWrap.className = "w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-2xl";

      toggleBtn.className = "px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-2 transition border bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40";
      toggleBtn.innerHTML = `<i class="fa-solid fa-play"></i><span>Abrir Votação</span>`;
    }

    document.getElementById('metric-last-update').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;

    // Renderiza Ranking com Barras de Progresso
    renderRankingList(data.teams, data.totalVotes);

    // Renderiza Tabela de Auditoria
    renderAuditTable(data.recentVotes);

  } catch (err) {
    console.error('Erro ao atualizar estatísticas:', err);
  }
}

// Renderiza lista com barras de progresso
function renderRankingList(teams, totalVotes) {
  const container = document.getElementById('ranking-list');
  if (!container) return;

  const medalBadges = [
    '<span class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-base font-bold shadow-md">🥇</span>',
    '<span class="w-8 h-8 rounded-xl bg-slate-300/20 text-slate-200 border border-slate-300/40 flex items-center justify-center text-base font-bold shadow-md">🥈</span>',
    '<span class="w-8 h-8 rounded-xl bg-amber-700/20 text-amber-600 border border-amber-700/40 flex items-center justify-center text-base font-bold shadow-md">🥉</span>'
  ];

  container.innerHTML = teams.map((team, idx) => {
    const badge = medalBadges[idx] || `<span class="w-8 h-8 rounded-xl bg-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold">#${idx + 1}</span>`;
    
    // Cor da barra de progresso
    let barColor = 'from-blue-600 to-indigo-500';
    if (idx === 0) barColor = 'from-amber-500 to-yellow-400';
    else if (idx === 1) barColor = 'from-slate-400 to-slate-200';
    else if (idx === 2) barColor = 'from-amber-700 to-amber-600';

    return `
      <div class="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 transition hover:border-slate-600">
        <div class="flex items-center justify-between gap-3 mb-2.5">
          <div class="flex items-center space-x-3 min-w-0">
            ${badge}
            <div class="min-w-0">
              <h4 class="text-sm sm:text-base font-bold text-white truncate">${team.name}</h4>
              <p class="text-[11px] text-slate-400 truncate">${team.category}</p>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="text-base sm:text-lg font-black text-white">${team.votes}</span>
            <span class="text-xs text-slate-400">votos</span>
            <span class="ml-2 px-2 py-0.5 rounded-md bg-slate-800 text-xs font-bold text-blue-400 border border-slate-700">
              ${team.percentage}%
            </span>
          </div>
        </div>

        <!-- Barra de Progresso Animada -->
        <div class="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/40">
          <div 
            class="h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700 ease-out"
            style="width: ${team.percentage > 0 ? team.percentage : 1}%;"
          ></div>
        </div>
      </div>
    `;
  }).join('');
}

// Renderiza tabela de auditoria
function renderAuditTable(recentVotes) {
  const tbody = document.getElementById('audit-table-body');
  if (!tbody) return;

  if (!recentVotes || recentVotes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-500">
          Nenhum voto registrado ainda.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recentVotes.map(v => {
    const date = new Date(v.created_at);
    const hora = date.toLocaleTimeString('pt-BR');

    return `
      <tr class="hover:bg-slate-700/30 transition">
        <td class="py-3 px-4 font-mono text-slate-400">${hora}</td>
        <td class="py-3 px-4 font-semibold text-white">${v.team_name}</td>
        <td class="py-3 px-4 text-slate-400">${v.device_summary}</td>
        <td class="py-3 px-4 font-mono text-xs text-slate-500">${v.masked_fingerprint}</td>
        <td class="py-3 px-4 text-right">
          <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
            <i class="fa-solid fa-check"></i>
            <span>Válido</span>
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// Alterna o status da votação
async function toggleVotingState() {
  const newState = !isVotingCurrentlyOpen;
  try {
    const res = await fetch('/api/admin/toggle-voting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      },
      body: JSON.stringify({ open: newState })
    });

    if (res.ok) {
      loadAdminStats();
    } else {
      alert('Erro ao alterar status da votação.');
    }
  } catch (err) {
    alert('Erro de conexão.');
  }
}

// Inicializa o QR Code
function initQRCode() {
  const qrContainer = document.getElementById('qrcode');
  const urlDisplay = document.getElementById('voting-public-url');
  if (!qrContainer) return;

  qrContainer.innerHTML = '';

  const publicUrl = window.location.origin;
  urlDisplay.textContent = publicUrl;

  qrcodeInstance = new QRCode(qrContainer, {
    text: publicUrl,
    width: 170,
    height: 170,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  // Também gera para o cartaz de impressão
  const printQrTarget = document.getElementById('print-qr-target');
  if (printQrTarget) {
    printQrTarget.innerHTML = '';
    new QRCode(printQrTarget, {
      text: publicUrl,
      width: 260,
      height: 260,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }
}

// Copia o link de votação
function copyVotingLink() {
  const publicUrl = window.location.origin;
  navigator.clipboard.writeText(publicUrl).then(() => {
    alert('Link de votação copiado com sucesso:\n' + publicUrl);
  }).catch(() => {
    prompt('Copie o link abaixo:', publicUrl);
  });
}

// Imprime cartaz A4
function printQRPoster() {
  const poster = document.getElementById('print-poster');
  if (!poster) return;
  poster.classList.remove('hidden');
  window.print();
  poster.classList.add('hidden');
}

// Exporta votos para CSV
function exportCSV() {
  window.location.href = `/api/admin/export-csv?auth=${encodeURIComponent(adminToken)}`;
}

// Modal de Zerar Votos
function openResetModal() {
  document.getElementById('input-confirm-reset').value = '';
  document.getElementById('modal-reset').classList.remove('hidden');
}

function closeResetModal() {
  document.getElementById('modal-reset').classList.add('hidden');
}

async function submitResetVotes() {
  const val = document.getElementById('input-confirm-reset').value.trim();
  if (val !== 'ZERAR') {
    alert('Digite a palavra ZERAR em letras maiúsculas para confirmar.');
    return;
  }

  try {
    const res = await fetch('/api/admin/reset-votes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      },
      body: JSON.stringify({ confirmation: 'ZERAR' })
    });

    const data = await res.json();
    if (res.ok) {
      alert('Todos os votos foram apagados com sucesso! O banco está pronto para a feira.');
      closeResetModal();
      loadAdminStats();
    } else {
      alert(data.message || 'Erro ao zerar votos.');
    }
  } catch (err) {
    alert('Erro de conexão ao zerar votos.');
  }
}

// Modal de Alteração de PIN
function openChangePinModal() {
  document.getElementById('input-new-pin').value = '';
  document.getElementById('modal-pin').classList.remove('hidden');
}

function closeChangePinModal() {
  document.getElementById('modal-pin').classList.add('hidden');
}

async function submitChangePin() {
  const newPin = document.getElementById('input-new-pin').value.trim();
  if (!newPin || newPin.length < 4) {
    alert('A nova senha deve ter no mínimo 4 dígitos.');
    return;
  }

  try {
    const res = await fetch('/api/admin/change-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      },
      body: JSON.stringify({ newPin })
    });

    const data = await res.json();
    if (res.ok) {
      alert('Senha alterada com sucesso! Guarde sua nova senha: ' + newPin);
      adminToken = newPin;
      localStorage.setItem('feira_admin_token', newPin);
      closeChangePinModal();
    } else {
      alert(data.message || 'Erro ao alterar senha.');
    }
  } catch (err) {
    alert('Erro de conexão.');
  }
}
