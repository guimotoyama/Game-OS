// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = "https://dvwgfmhvctpywtrkqeyv.supabase.co";
const SUPABASE_KEY = "sb_publishable_gkBCivuBZonr5ITWLYcGWg_I6kbnp7Z";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// ELEMENTOS DA TELA
// ==========================================
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app");
const loginBtn = document.getElementById("login-btn");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");

// ==========================================
// LOGIN
// ==========================================
loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    loginError.textContent = "Preencha e-mail e senha.";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    loginError.textContent = "E-mail ou senha inválidos.";
    console.error("Erro de login:", error.message);
  }
  // Se der certo, o listener de sessão (abaixo) cuida de trocar de tela sozinho
});

// Permite logar apertando Enter em qualquer um dos dois campos
loginEmail.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginBtn.click();
  }
});

loginPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginBtn.click();
  }
});

// ==========================================
// CONTROLE DE SESSÃO (decide qual tela mostrar)
// ==========================================
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    showApp();
  } else {
    showLogin();
  }
}

function showApp() {
  loginScreen.classList.add("app-hidden");
  appScreen.classList.remove("app-hidden");
  initApp();
}

function showLogin() {
  appScreen.classList.add("app-hidden");
  loginScreen.classList.remove("app-hidden");
}

// Fica de olho em mudanças de login/logout em tempo real
supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showApp();
  } else {
    showLogin();
  }
});

// ==========================================
// INÍCIO DO APP (depois de autenticado)
// ==========================================
function initApp() {
  console.log("Usuário autenticado. App iniciado.");
  loadGames();
}

// ==========================================
// BUSCA DE JOGOS (IGDB)
// ==========================================
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const searchClear = document.getElementById("search-clear");

let searchTimeout = null;
let lastGames = null; // guarda o último resultado buscado, pra reexibir sem gastar API

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);

  const term = searchInput.value.trim();

  searchClear.classList.toggle("visible", term.length > 0);

  if (term.length < 2) {
    hideResults();
    return;
  }

  searchTimeout = setTimeout(() => {
    searchGames(term);
  }, 400);
});

// Se já tem um resultado guardado e o campo ainda tem texto, mostra de novo ao focar
searchInput.addEventListener("focus", () => {
  const term = searchInput.value.trim();
  if (term.length >= 2 && lastGames) {
    showResults();
  }
});

// Botão de limpar (X)
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.remove("visible");
  hideResults();
  lastGames = null;
  searchInput.focus();
});

// Fecha a lista se clicar fora dela
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-bar")) {
    hideResults();
  }
});

async function searchGames(term) {
  const query = `fields name, cover.url, first_release_date; search "${term}"; limit 10;`;

  const { data, error } = await supabaseClient.functions.invoke("igdb-proxy", {
    body: { endpoint: "games", query },
  });

  if (error) {
    console.error("Erro na busca:", error);
    return;
  }

  lastGames = data;
  renderResults(data);
}

function renderResults(games) {
  searchResults.innerHTML = "";

  if (!games || games.length === 0) {
    searchResults.innerHTML = `<div class="search-no-results">Nenhum jogo encontrado.</div>`;
    showResults();
    return;
  }

  games.forEach((game) => {
    const item = document.createElement("div");
    item.className = "search-result-item";

    // Ajusta a URL da capa: adiciona https: e troca pro tamanho maior
    let coverUrl = "";
    if (game.cover && game.cover.url) {
      coverUrl = "https:" + game.cover.url.replace("t_thumb", "t_cover_small");
    }

    let year = "";
    if (game.first_release_date) {
    year = ` (${new Date(game.first_release_date * 1000).getFullYear()})`;
}

    item.innerHTML = `
    ${coverUrl ? `<img src="${coverUrl}" class="search-result-cover" alt="${game.name}">` : `<div class="search-result-cover"></div>`}
    <span class="search-result-name">${game.name}${year}</span>
    `;

    item.addEventListener("click", () => {
      hideResults();
      searchInput.value = "";
      searchClear.classList.remove("visible");
      lastGames = null;
      handleResultClick(game);
    });

    searchResults.appendChild(item);
  });

  showResults();
}

function showResults() {
  searchResults.classList.add("visible");
}

function hideResults() {
  searchResults.classList.remove("visible");
}

// MODAL DE ADICIONAR JOGO
const addModal = document.getElementById("add-modal");
const modalClose = document.getElementById("modal-close");
const modalGameCover = document.getElementById("modal-game-cover");
const modalGameName = document.getElementById("modal-game-name");
const modalPlatformField = document.getElementById("modal-platform-field");
const modalPlatformSelect = document.getElementById("modal-platform-select");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const statusOptions = document.querySelectorAll(".status-option");

let pendingGame = null;
let selectedStatus = null;

function openAddModal(game) {
  pendingGame = game;
  selectedStatus = null;
  modalGameName.textContent = game.name;
  if (game.cover && game.cover.url) {
    modalGameCover.src = "https:" + game.cover.url.replace("t_thumb", "t_cover_big");
  } else {
    modalGameCover.src = "";
  }
  statusOptions.forEach((btn) => btn.classList.remove("active"));
  modalPlatformField.classList.add("app-hidden");
  addModal.classList.remove("app-hidden");
}

function closeAddModal() {
  addModal.classList.add("app-hidden");
}

modalClose.addEventListener("click", closeAddModal);
addModal.addEventListener("click", (event) => {
  if (event.target === addModal) closeAddModal();
});

statusOptions.forEach((btn) => {
  btn.addEventListener("click", () => {
    statusOptions.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedStatus = btn.dataset.status;
    if (selectedStatus === "playing" || selectedStatus === "completed") {
      modalPlatformField.classList.remove("app-hidden");
    } else {
      modalPlatformField.classList.add("app-hidden");
    }
  });
});

modalConfirmBtn.addEventListener("click", () => {
  if (!selectedStatus) {
    showToast("Escolha um status antes de confirmar.");
    return;
  }
  const platform = (selectedStatus === "playing" || selectedStatus === "completed")
    ? modalPlatformSelect.value
    : null;
  const game = pendingGame;
  closeAddModal();
  saveGame(game, selectedStatus, platform);
});

// SALVAR JOGO (busca completa + detecção de loja + insert no Supabase)
const STORE_PATTERNS = [
  { regex: /steam/i, label: "Steam" },
  { regex: /gog/i, label: "GOG" },
  { regex: /epic/i, label: "Epic Games" },
  { regex: /microsoft|xbox/i, label: "Xbox" },
  { regex: /playstation|psn/i, label: "PlayStation" },
  { regex: /nintendo|eshop/i, label: "Nintendo Switch" },
];

function matchStoreName(sourceName) {
  if (!sourceName) return null;
  const found = STORE_PATTERNS.find((s) => s.regex.test(sourceName));
  return found ? found.label : null;
}

function normalizePlatformName(platform) {
  const name = platform.name || "";
  if (/pc|windows|mac|linux/i.test(name)) return "PC";
  if (platform.platform_family && platform.platform_family.name) {
    return platform.platform_family.name;
  }
  return name;
}

async function saveGame(game, status, playingOn) {
  showToast("Salvando jogo...");
  try {
    const detailsQuery = `fields name, cover.url, genres.name, platforms.name, platforms.platform_family.name, first_release_date; where id = ${game.id};`;
    const { data: detailsData, error: detailsError } = await supabaseClient.functions.invoke("igdb-proxy", {
      body: { endpoint: "games", query: detailsQuery },
    });
    if (detailsError) throw detailsError;
    const details = detailsData[0] || {};

    let coverUrl = null;
    if (details.cover && details.cover.url) {
      coverUrl = "https:" + details.cover.url.replace("t_thumb", "t_cover_big");
    }

    const genre = (details.genres || []).map((g) => translateGenre(g.name)).join(", ") || null;

    const releaseDate = details.first_release_date
  ? new Date(details.first_release_date * 1000).toISOString().split("T")[0]
  : null;

    const platformSet = new Set();
    (details.platforms || []).forEach((p) => platformSet.add(normalizePlatformName(p)));

    if (platformSet.has("PC")) {
      const storesQuery = `fields external_game_source.name; where game = ${game.id};`;
      const { data: storesData, error: storesError } = await supabaseClient.functions.invoke("igdb-proxy", {
        body: { endpoint: "external_games", query: storesQuery },
      });

      if (!storesError && storesData && storesData.length > 0) {
        const foundStores = new Set();
        storesData.forEach((entry) => {
          const sourceName = entry.external_game_source && entry.external_game_source.name;
          const matched = matchStoreName(sourceName);
          if (matched) foundStores.add(matched);
        });

        if (foundStores.size > 0) {
          platformSet.delete("PC");
          foundStores.forEach((store) => platformSet.add(store));
        }
      }
    }

    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error: insertError } = await supabaseClient.from("games").insert({
  user_id: user.id,
  game_id: game.id,
  title: details.name || game.name,
  cover_url: coverUrl,
  status: status,
  genre: genre,
  playing_on: playingOn,
  available_platforms: Array.from(platformSet),
  release_date: releaseDate,
    });
    
    if (insertError) throw insertError;

    showToast("Jogo adicionado com sucesso!");
    loadGames();
  } catch (err) {
    console.error("Erro ao salvar jogo:", err);
    showToast("Erro ao salvar o jogo. Tente novamente.");
  }
}

// LISTAR JOGOS NA TELA
const gamesGrid = document.getElementById("games-grid");
const filterButtons = document.querySelectorAll(".filters .filter-btn");
let allGames = [];
let currentFilter = "all";

const STATUS_LABELS = {
  playing: "🎮 Jogando",
  completed: "🏆 Zerado",
  planned: "📅 Planejado",
  dropped: "🚫 Abandonado",
};

async function loadGames() {
  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Erro ao carregar jogos:", error);
    return;
  }
  allGames = data;
  renderGamesGrid();
}

function renderGamesGrid() {
  const filtered = currentFilter === "all"
    ? allGames
    : allGames.filter((g) => g.status === currentFilter);

  if (filtered.length === 0) {
    gamesGrid.innerHTML = `<p class="placeholder-msg">Nenhum jogo aqui ainda.</p>`;
    return;
  }

  gamesGrid.innerHTML = "";
  filtered.forEach((g) => {
    const card = document.createElement("div");
    card.className = "game-card";

    const ribbon = document.createElement("span");
    ribbon.className = `status-ribbon ${g.status}`;
    ribbon.textContent = STATUS_LABELS[g.status] || g.status;
    card.appendChild(ribbon);

    if (isUpcoming(g.release_date)) {
  const upcomingRibbon = document.createElement("span");
  upcomingRibbon.className = "upcoming-ribbon";
  upcomingRibbon.textContent = "🕒 Em breve";
  card.appendChild(upcomingRibbon);
}

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "game-card-delete";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteGame(g.id);
    });
    card.appendChild(deleteBtn);

    if (g.cover_url) {
      const img = document.createElement("img");
      img.src = g.cover_url;
      img.alt = g.title;
      card.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "game-card-info";
    info.innerHTML = `
  <div class="game-card-title">${g.title}</div>
  ${g.genre ? `<div class="game-card-meta">${g.genre}</div>` : ""}
  ${g.playing_on ? `<div class="game-card-meta">${g.playing_on}</div>` : ""}
  <div class="game-card-meta">${formatReleaseDate(g.release_date)}</div>
`;

    card.appendChild(info);

    card.addEventListener("click", () => openDetailsModal(g));

    gamesGrid.appendChild(card);
  });
}

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.status;
    renderGamesGrid();
  });
});

// TRADUÇÃO DE GÊNEROS
const GENRE_TRANSLATIONS = {
  "point-and-click": "Aponte e Clique",
  "fighting": "Luta",
  "shooter": "Tiro",
  "music": "Música",
  "platform": "Plataforma",
  "puzzle": "Quebra-cabeça",
  "racing": "Corrida",
  "real time strategy (rts)": "Estratégia em Tempo Real",
  "role-playing (rpg)": "RPG",
  "simulator": "Simulador",
  "sport": "Esporte",
  "strategy": "Estratégia",
  "turn-based strategy (tbs)": "Estratégia por Turnos",
  "tactical": "Tático",
  "hack and slash/beat 'em up": "Hack and Slash",
  "quiz/trivia": "Quiz",
  "pinball": "Pinball",
  "adventure": "Aventura",
  "indie": "Indie",
  "arcade": "Arcade",
  "visual novel": "Visual Novel",
  "card & board game": "Cartas e Tabuleiro",
  "moba": "MOBA",
};

function translateGenre(name) {
  const key = name.toLowerCase();
  return GENRE_TRANSLATIONS[key] || name;
}

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatReleaseDate(dateStr) {
  if (!dateStr) return "Data não anunciada";
  const date = new Date(dateStr + "T00:00:00");
  return `${date.getDate()} de ${MONTHS_PT[date.getMonth()]} de ${date.getFullYear()}`;
}

function isUpcoming(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr + "T00:00:00");
  return date.getTime() > Date.now();
}

// CHECAGEM DE DUPLICATA (antes de abrir o modal de adicionar)
async function handleResultClick(game) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  const { data: existing, error } = await supabaseClient
    .from("games")
    .select("*")
    .eq("user_id", user.id)
    .eq("game_id", game.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao checar duplicidade:", error);
    return;
  }

  if (existing) {
    showDuplicateToast(existing);
    return;
  }

  openAddModal(game);
}

// EXCLUIR JOGO
function deleteGame(id) {
  showConfirmDialog("Remover este jogo da sua lista?", async () => {
    const { error } = await supabaseClient
      .from("games")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    showToast("Jogo removido.", { type: "success" });
    closeDetailsModal();
    loadGames();
  });
}

// TELA DE DETALHES
const detailsModal = document.getElementById("details-modal");
const detailsClose = document.getElementById("details-close");
const detailsCover = document.getElementById("details-cover");
const detailsTitle = document.getElementById("details-title");
const detailsStatusSelect = document.getElementById("details-status-select");
const detailsPlatformSelect = document.getElementById("details-platform-select");
const detailsGenre = document.getElementById("details-genre");
const detailsAvailable = document.getElementById("details-available");
const detailsRelease = document.getElementById("details-release");

let currentDetailsGameId = null;

function openDetailsModal(game) {
  currentDetailsGameId = game.id;
  detailsCover.src = game.cover_url || "";
  detailsTitle.textContent = game.title;
  detailsStatusSelect.value = game.status;
  detailsPlatformSelect.value = game.playing_on || "Outro";
  detailsGenre.textContent = game.genre || "Não informado";
  detailsAvailable.textContent =
    (game.available_platforms || []).join(", ") || "Não informado";
  detailsModal.classList.remove("app-hidden");
  detailsRelease.textContent = formatReleaseDate(game.release_date);
}

async function updateGameField(id, field, value) {
  const { error } = await supabaseClient
    .from("games")
    .update({ [field]: value })
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  loadGames();
}

detailsStatusSelect.addEventListener("change", () => {
  updateGameField(currentDetailsGameId, "status", detailsStatusSelect.value);
});

detailsPlatformSelect.addEventListener("change", () => {
  updateGameField(currentDetailsGameId, "playing_on", detailsPlatformSelect.value);
});

function closeDetailsModal() {
  detailsModal.classList.add("app-hidden");
  currentDetailsGameId = null;
}

detailsClose.addEventListener("click", closeDetailsModal);
detailsModal.addEventListener("click", (event) => {
  if (event.target === detailsModal) closeDetailsModal();
});

function showToast(message, options = {}) {
  const old = document.querySelector(".toast");
  if (old) old.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${options.type ? "toast-" + options.type : ""}`;

  const msg = document.createElement("span");
  msg.textContent = message;
  toast.appendChild(msg);

  if (options.actionLabel && options.onAction) {
    const btn = document.createElement("button");
    btn.textContent = options.actionLabel;
    btn.onclick = () => {
      toast.remove();
      options.onAction();
    };
    toast.appendChild(btn);
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), options.duration || 4000);
}

function showDuplicateToast(existingGame) {
  showToast(`"${existingGame.title}" já está na sua lista.`, {
    actionLabel: "Ver detalhes",
    onAction: () => openDetailsModal(existingGame),
    duration: 6000,
  });
}

function showConfirmDialog(message, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";

  const box = document.createElement("div");
  box.className = "confirm-box";

  const text = document.createElement("p");
  text.textContent = message;
  box.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "confirm-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancelar";
  cancelBtn.className = "confirm-cancel";
  cancelBtn.onclick = () => overlay.remove();

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "Remover";
  confirmBtn.className = "confirm-confirm";
  confirmBtn.onclick = () => {
    overlay.remove();
    onConfirm();
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ==========================================
// PONTO DE PARTIDA
// ==========================================
checkSession();