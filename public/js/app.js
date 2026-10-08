// Aplicação de Votação do Eleitor

let currentDevice = null;
let allTeams = [];
let selectedTeam = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await initVoter();
});

async function initVoter() {
  try {
    // 1. Obtém a digital única do dispositivo
    currentDevice = await window.FeiraFingerprint.getFingerprint();
    
    // 2. Consulta o status do servidor
    const res = await fetch(`/api/status?fingerprint=${encodeURIComponent(currentDevice.fingerprint)}&voterToken=${encodeURIComponent(currentDevice.voterToken)}`);
    const data = await res.json();

    allTeams = data.teams || [];

    // 3. Atualiza o status de abertura
    updateVotingStatusBadge(data.votingOpen);

    // 4. Se já votou, exibe a tela de confirmação
    if (data.alreadyVoted) {
      showAlreadyVotedScreen(data.votedTeam, data.votedAt);
      return;
    }

    // 5. Se a votação estiver pausada
    if (!data.votingOpen) {
      document.getElementById('voting-paused-screen').classList.remove('hidden');
    }

    // 6. Renderiza os cards das 8 equipes
    renderTeamsGrid(allTeams, data.votingOpen);

  } catch (err) {
    console.error('Erro na inicialização:', err);
    showToast('Erro ao carregar a votação. Verifique sua conexão.', 'error');
  }
}

// Atualiza o crachá do topo
function updateVotingStatusBadge(isOpen) {
  const badge = document.getElementById('header-status-badge');
  if (!badge) return;

  if (isOpen) {
    badge.className = "flex items-center space-x-2 bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 rounded-full text-xs sm:text-sm text-emerald-300";
    badge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span><span class="font-medium">Votação Aberta</span>`;
  } else {
    badge.className = "flex items-center space-x-2 bg-amber-500/20 border border-amber-400/40 px-3 py-1.5 rounded-full text-xs sm:text-sm text-amber-300";
    badge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span><span class="font-medium">Votação Pausada</span>`;
  }
}

// Renderiza a grade de projetos
function renderTeamsGrid(teams, votingOpen) {
  const container = document.getElementById('teams-grid');
  if (!container) return;

  if (teams.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500">
        Nenhum projeto encontrado.
      </div>
    `;
    return;
  }

  const colorStyles = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  btn: 'bg-purple-600 hover:bg-purple-700' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   btn: 'bg-amber-600 hover:bg-amber-700' },
    green:   { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   btn: 'bg-green-600 hover:bg-green-700' },
    orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  btn: 'bg-orange-600 hover:bg-orange-700' },
    cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    btn: 'bg-cyan-600 hover:bg-cyan-700' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    btn: 'bg-blue-600 hover:bg-blue-700' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    btn: 'bg-rose-600 hover:bg-rose-700' }
  };

  container.innerHTML = teams.map((team, idx) => {
    const c = colorStyles[team.color] || colorStyles.blue;
    const num = (idx + 1).toString().padStart(2, '0');

    return `
      <div class="team-card bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between relative group">
        <!-- Badge de Número e Categoria -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-black tracking-wider text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
              #${num}
            </span>
            <span class="text-[11px] font-semibold tracking-wide ${c.bg} ${c.text} px-2.5 py-1 rounded-full border ${c.border}">
              ${team.category}
            </span>
          </div>

          <!-- Ícone e Nome -->
          <div class="flex items-start space-x-3.5 mb-3">
            <div class="w-12 h-12 rounded-2xl ${c.bg} ${c.text} border ${c.border} flex-shrink-0 flex items-center justify-center text-xl shadow-inner">
              <i class="fa-solid ${team.icon || 'fa-award'}"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition">
                ${team.name}
              </h3>
            </div>
          </div>

          <!-- Descrição -->
          <p class="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
            ${team.description || 'Projeto participante da feira de inovações.'}
          </p>
        </div>

        <!-- Botão de Votar -->
        <button 
          onclick="openModal(${team.id})" 
          ${!votingOpen ? 'disabled' : ''}
          class="w-full py-3 px-4 rounded-xl font-semibold text-sm transition active:scale-95 flex items-center justify-center space-x-2 shadow-sm
          ${votingOpen 
            ? 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-blue-500/25 cursor-pointer' 
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}">
          <i class="fa-solid fa-check-to-slot"></i>
          <span>${votingOpen ? 'Votar nesta Equipe' : 'Votação Fechada'}</span>
        </button>
      </div>
    `;
  }).join('');
}

// Abre o modal de confirmação
function openModal(teamId) {
  selectedTeam = allTeams.find(t => t.id === teamId);
  if (!selectedTeam) return;

  const modal = document.getElementById('confirm-modal');
  const card = document.getElementById('modal-card');

  document.getElementById('modal-team-name').textContent = selectedTeam.name;
  document.getElementById('modal-team-category').textContent = selectedTeam.category;
  
  const iconEl = document.getElementById('modal-team-icon');
  iconEl.className = `fa-solid ${selectedTeam.icon || 'fa-award'}`;

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    card.classList.remove('scale-95');
    card.classList.add('scale-100');
  }, 10);
}

// Fecha o modal
function closeModal() {
  const modal = document.getElementById('confirm-modal');
  const card = document.getElementById('modal-card');

  card.classList.remove('scale-100');
  card.classList.add('scale-95');
  modal.classList.add('opacity-0');

  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

// Envia o voto para o servidor
async function submitVote() {
  if (!selectedTeam || !currentDevice) return;

  const btnConfirm = document.getElementById('btn-confirm-vote');
  const btnText = document.getElementById('btn-confirm-text');
  const spinner = document.getElementById('btn-confirm-spinner');

  try {
    btnConfirm.disabled = true;
    btnText.textContent = 'Gravando voto...';
    spinner.classList.remove('hidden');

    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teamId: selectedTeam.id,
        fingerprint: currentDevice.fingerprint,
        voterToken: currentDevice.voterToken,
        deviceSummary: currentDevice.deviceSummary
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        // Já havia votado
        closeModal();
        showToast(data.message || 'Dispositivo já votou.', 'warning');
        showAlreadyVotedScreen({ name: data.teamName || selectedTeam.name, category: selectedTeam.category }, data.votedAt || new Date().toISOString());
        return;
      }
      throw new Error(data.message || 'Erro ao registrar voto.');
    }

    // Sucesso!
    closeModal();
    fireConfetti();
    showToast(`Voto registrado com sucesso em "${selectedTeam.name}"!`, 'success');

    // Exibe tela de agradecimento e bloqueio de novos votos
    showAlreadyVotedScreen(selectedTeam, data.timestamp);

  } catch (err) {
    console.error('Erro ao enviar voto:', err);
    showToast(err.message || 'Não foi possível registrar seu voto.', 'error');
  } finally {
    btnConfirm.disabled = false;
    btnText.textContent = 'Confirmar Voto';
    spinner.classList.add('hidden');
  }
}

// Exibe a tela de voto registrado
function showAlreadyVotedScreen(team, votedAt) {
  const alreadyScreen = document.getElementById('already-voted-screen');
  const votingSection = document.getElementById('voting-section');

  if (team) {
    document.getElementById('voted-team-name').textContent = team.name;
    document.getElementById('voted-team-cat-text').textContent = team.category || 'Projeto Concorrente';
  }

  if (votedAt) {
    const date = new Date(votedAt);
    document.getElementById('voted-team-time').textContent = date.toLocaleString('pt-BR');
  }

  if (alreadyScreen) alreadyScreen.classList.remove('hidden');
  if (votingSection) votingSection.classList.add('hidden');

  // Atualiza badge de topo
  const badge = document.getElementById('header-status-badge');
  if (badge) {
    badge.className = "flex items-center space-x-2 bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 rounded-full text-xs sm:text-sm text-emerald-300";
    badge.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i><span class="font-medium">Seu Voto Foi Registrado</span>`;
  }
}

// Confetti festivo
function fireConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }
}

// Notificação toast
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');

  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;

  if (type === 'success') {
    toastIcon.className = "fa-solid fa-circle-check text-emerald-400 text-xl";
  } else if (type === 'warning') {
    toastIcon.className = "fa-solid fa-triangle-exclamation text-amber-400 text-xl";
  } else {
    toastIcon.className = "fa-solid fa-circle-xmark text-rose-400 text-xl";
  }

  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 4000);
}
