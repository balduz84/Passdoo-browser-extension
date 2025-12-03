/**
 * Passdoo Browser Extension - Popup Script
 * Gestisce l'interfaccia utente del popup
 */

// Configurazione
const CONFIG = {
  ODOO_URL: 'https://portal.novacs.net'
};

// Stato dell'applicazione
let state = {
  isAuthenticated: false,
  user: null,
  passwords: [],
  accessiblePasswords: [],
  filteredPasswords: [],
  personalPasswords: [],
  sharedPasswords: [],
  urlMatchingPasswords: [], // Password che matchano l'URL corrente
  currentPassword: null,
  currentTab: 'all',
  currentUrl: null,
  isLoading: false,
  clientFilter: null,  // Filtro per cliente: { id, name }
  urlFilterActive: false  // Flag per indicare se il filtro URL è attivo
};

// Elementi DOM
const elements = {};

/**
 * Inizializzazione
 */
document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  initEventListeners();
  await getCurrentTab();
  await checkAuth();
});

/**
 * Inizializza i riferimenti agli elementi DOM
 */
function initElements() {
  elements.viewLogin = document.getElementById('view-login');
  elements.viewMain = document.getElementById('view-main');
  elements.viewDetail = document.getElementById('view-detail');
  elements.viewAddPassword = document.getElementById('view-add-password');
  
  elements.btnLogin = document.getElementById('btn-login');
  elements.btnLogout = document.getElementById('btn-logout');
  elements.btnRefresh = document.getElementById('btn-refresh');
  elements.btnSettings = document.getElementById('btn-settings');
  elements.btnBack = document.getElementById('btn-back');
  elements.btnFillCredentials = document.getElementById('btn-fill-credentials');
  elements.btnTogglePassword = document.getElementById('btn-toggle-password');
  elements.btnClearSearch = document.getElementById('btn-clear-search');
  
  // Add password elements
  elements.btnAddPassword = document.getElementById('btn-add-password');
  elements.btnBackAdd = document.getElementById('btn-back-add');
  elements.btnCancelAdd = document.getElementById('btn-cancel-add');
  elements.btnSavePassword = document.getElementById('btn-save-password');
  elements.btnToggleAddPassword = document.getElementById('btn-toggle-add-password');
  elements.btnGeneratePassword = document.getElementById('btn-generate-password');
  elements.formAddPassword = document.getElementById('form-add-password');
  elements.addName = document.getElementById('add-name');
  elements.addUsername = document.getElementById('add-username');
  elements.addPassword = document.getElementById('add-password');
  elements.addUri = document.getElementById('add-uri');
  elements.addClient = document.getElementById('add-client');
  elements.addCategory = document.getElementById('add-category');
  elements.addDescription = document.getElementById('add-description');
  elements.groupsSharingSection = document.getElementById('groups-sharing-section');
  elements.groupsList = document.getElementById('groups-list');
  
  elements.searchInput = document.getElementById('search-input');
  elements.passwordList = document.getElementById('password-list');
  elements.emptyState = document.getElementById('empty-state');
  elements.emptyMessage = document.getElementById('empty-message');
  elements.loadingState = document.getElementById('loading-state');
  
  elements.detailTitle = document.getElementById('detail-title');
  elements.detailName = document.getElementById('detail-name');
  elements.detailUsername = document.getElementById('detail-username');
  elements.detailPassword = document.getElementById('detail-password');
  elements.detailUri = document.getElementById('detail-uri');
  elements.detailUriContainer = document.getElementById('detail-uri-container');
  elements.detailDescription = document.getElementById('detail-description');
  elements.detailDescriptionContainer = document.getElementById('detail-description-container');
  
  elements.userFooter = document.getElementById('user-footer');
  elements.userName = document.getElementById('user-name');
  elements.toastContainer = document.getElementById('toast-container');
  
  elements.aboutModal = document.getElementById('about-modal');
  elements.aboutModalBackdrop = document.getElementById('about-modal-backdrop');
  elements.aboutCloseBtn = document.getElementById('about-close-btn');
  elements.btnAbout = document.getElementById('btn-about');
  
  elements.tabBtns = document.querySelectorAll('.tab-btn');
}

/**
 * Inizializza gli event listener
 */
function initEventListeners() {
  elements.btnLogin.addEventListener('click', handleLogin);
  elements.btnLogout.addEventListener('click', handleLogout);
  elements.btnRefresh.addEventListener('click', () => loadPasswords(true));
  elements.btnSettings.addEventListener('click', openSettings);
  elements.btnAbout.addEventListener('click', showAboutModal);
  elements.aboutCloseBtn.addEventListener('click', hideAboutModal);
  elements.aboutModalBackdrop.addEventListener('click', hideAboutModal);
  elements.btnBack.addEventListener('click', showMainView);
  elements.btnFillCredentials.addEventListener('click', handleFillCredentials);
  elements.btnTogglePassword.addEventListener('click', togglePasswordVisibility);
  elements.btnClearSearch.addEventListener('click', clearSearch);
  
  // Add password event listeners
  elements.btnAddPassword.addEventListener('click', showAddPasswordView);
  elements.btnBackAdd.addEventListener('click', showMainView);
  elements.btnCancelAdd.addEventListener('click', showMainView);
  elements.formAddPassword.addEventListener('submit', handleSavePassword);
  elements.btnToggleAddPassword.addEventListener('click', toggleAddPasswordVisibility);
  elements.btnGeneratePassword.addEventListener('click', handleGeneratePassword);
  elements.addClient.addEventListener('change', handleClientChange);
  
  elements.searchInput.addEventListener('input', handleSearch);
  
  elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => handleCopy(btn.dataset.copy));
  });
}

/**
 * Ottiene la tab corrente del browser
 */
async function getCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      state.currentUrl = tabs[0].url;
    }
  } catch (error) {
    console.error('Error getting current tab:', error);
  }
}

/**
 * Verifica lo stato di autenticazione
 */
async function checkAuth() {
  setLoading(true);
  
  try {
    const response = await sendMessage({ action: 'checkAuth' });
    
    if (response.isAuthenticated) {
      state.isAuthenticated = true;
      await loadUserInfo();
      await loadPasswords();
      showMainView();
    } else {
      state.isAuthenticated = false;
      showLoginView();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    state.isAuthenticated = false;
    showLoginView();
    // Mostra toast solo se è un errore di sessione scaduta
    if (error.message === 'SESSION_EXPIRED') {
      showToast('Sessione scaduta. Effettua nuovamente il login.', 'warning');
    }
  } finally {
    setLoading(false);
  }
}

/**
 * Gestisce il login
 */
async function handleLogin() {
  elements.btnLogin.disabled = true;
  elements.btnLogin.innerHTML = '<span class="spinner-small"></span> Accesso in corso...';
  
  try {
    const response = await sendMessage({ action: 'login' });
    
    if (response.success) {
      state.isAuthenticated = true;
      await loadUserInfo();
      await loadPasswords();
      showMainView();
      showToast('Accesso effettuato con successo', 'success');
    } else {
      showToast('Errore durante l\'accesso', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast(error.message || 'Errore durante l\'accesso', 'error');
  } finally {
    elements.btnLogin.disabled = false;
    elements.btnLogin.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
        <polyline points="10 17 15 12 10 7"></polyline>
        <line x1="15" y1="12" x2="3" y2="12"></line>
      </svg>
      Accedi con Entra ID
    `;
  }
}

/**
 * Gestisce il logout
 */
async function handleLogout() {
  try {
    await sendMessage({ action: 'logout' });
    state.isAuthenticated = false;
    state.user = null;
    state.passwords = [];
    showLoginView();
    showToast('Disconnessione effettuata', 'success');
  } catch (error) {
    console.error('Logout error:', error);
    showToast('Errore durante la disconnessione', 'error');
  }
}

/**
 * Carica le informazioni dell'utente
 */
async function loadUserInfo() {
  try {
    const response = await sendMessage({ action: 'getUserInfo' });
    if (response.user) {
      state.user = response.user;
      elements.userName.textContent = response.user.name || response.user.email;
      elements.userFooter.style.display = 'flex';
    }
  } catch (error) {
    // Se la sessione è scaduta, propaga l'errore per interrompere il flusso
    if (error.message === 'SESSION_EXPIRED') {
      throw error;  // Propaga per far gestire a checkAuth
    }
    console.error('Error loading user info:', error);
    // Non propagare altri errori - getUserInfo non è critico
  }
}

/**
 * Trova le password che matchano l'URL corrente
 */
function findMatchingPasswords() {
  if (!state.currentUrl || !state.passwords.length) {
    return [];
  }
  
  try {
    const currentUrlObj = new URL(state.currentUrl);
    const currentDomain = currentUrlObj.hostname.replace('www.', '').toLowerCase();
    
    return state.passwords.filter(p => {
      if (!p.uri) return false;
      
      try {
        // Normalizza l'URI della password
        const passwordUri = p.uri.startsWith('http') ? p.uri : 'https://' + p.uri;
        const passwordUrlObj = new URL(passwordUri);
        const passwordDomain = passwordUrlObj.hostname.replace('www.', '').toLowerCase();
        
        // Match esatto del dominio o sottodominio
        return currentDomain === passwordDomain || 
               currentDomain.endsWith('.' + passwordDomain) ||
               passwordDomain.endsWith('.' + currentDomain);
      } catch {
        // Se l'URI non è un URL valido, prova un match parziale
        const normalizedUri = p.uri.toLowerCase().replace('www.', '');
        return currentDomain.includes(normalizedUri) || normalizedUri.includes(currentDomain);
      }
    });
  } catch {
    return [];
  }
}

/**
 * Carica le password
 */
async function loadPasswords(forceRefresh = false) {
  setLoading(true);
  
  try {
    // Carica tutte le password
    const response = await sendMessage({ 
      action: 'getPasswords', 
      forceRefresh 
    });
    
    // Gestisci risposta undefined o senza passwords
    if (!response || !response.passwords) {
      state.passwords = [];
    } else {
      state.passwords = response.passwords;
    }
    
    // Il server già restituisce solo le password accessibili all'utente,
    // filtrate in base ai gruppi di permesso
    state.accessiblePasswords = state.passwords;
    
    // Separa password in base al ruolo:
    // - "Mie": sono owner (nel gruppo owner_group)
    // - "Condivise": ho accesso ma non sono owner
    state.personalPasswords = state.passwords.filter(p => p.is_owner);
    state.sharedPasswords = state.passwords.filter(p => !p.is_owner);
    
    // Trova password che matchano l'URL corrente
    state.urlMatchingPasswords = findMatchingPasswords();
    
    // Se ci sono password che matchano l'URL, attiva automaticamente il filtro
    if (state.urlMatchingPasswords.length > 0) {
      state.urlFilterActive = true;
      state.filteredPasswords = state.urlMatchingPasswords;
      showUrlFilterIndicator();
    } else {
      state.urlFilterActive = false;
    }
    
    // Filtra in base alla tab corrente
    updatePasswordList();
    
  } catch (error) {
    console.error('Error loading passwords:', error);
    
    // Se la sessione è scaduta, torna alla schermata di login
    if (error.message === 'SESSION_EXPIRED') {
      state.isAuthenticated = false;
      showLoginView();
      showToast('Sessione scaduta. Effettua nuovamente il login.', 'warning');
      return;
    }
    
    showToast('Errore nel caricamento delle password', 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Aggiorna la lista delle password visualizzata
 */
function updatePasswordList() {
  let passwordsToShow = [];
  
  // Prima applica il filtro per cliente se attivo
  let basePasswords = state.accessiblePasswords;
  let basePersonal = state.personalPasswords;
  let baseShared = state.sharedPasswords;
  
  // Se il filtro URL è attivo e non c'è ricerca manuale, usa le password matching
  if (state.urlFilterActive && !elements.searchInput.value) {
    basePasswords = state.urlMatchingPasswords;
    basePersonal = state.urlMatchingPasswords.filter(p => p.is_owner);
    baseShared = state.urlMatchingPasswords.filter(p => !p.is_owner);
  }
  
  if (state.clientFilter) {
    basePasswords = basePasswords.filter(p => p.partner_id === state.clientFilter.id);
    basePersonal = basePersonal.filter(p => p.partner_id === state.clientFilter.id);
    baseShared = baseShared.filter(p => p.partner_id === state.clientFilter.id);
  }
  
  // Applica anche il filtro di ricerca se presente
  let filteredBySearch = state.filteredPasswords;
  if (state.clientFilter && state.filteredPasswords.length > 0) {
    filteredBySearch = state.filteredPasswords.filter(p => p.partner_id === state.clientFilter.id);
  }
  
  if (state.currentTab === 'personal') {
    // Tab "Mie": password dove sono owner
    passwordsToShow = filteredBySearch.length > 0 || elements.searchInput.value 
      ? filteredBySearch.filter(p => p.is_owner)
      : basePersonal;
    if (passwordsToShow.length === 0) {
      elements.emptyMessage.textContent = state.clientFilter 
        ? `Nessuna password di cui sei owner per ${state.clientFilter.name}`
        : 'Nessuna password di cui sei owner';
    }
  } else if (state.currentTab === 'shared') {
    // Tab "Condivise": password dove non sono owner ma ho accesso
    passwordsToShow = filteredBySearch.length > 0 || elements.searchInput.value 
      ? filteredBySearch.filter(p => !p.is_owner)
      : baseShared;
    if (passwordsToShow.length === 0) {
      elements.emptyMessage.textContent = state.clientFilter 
        ? `Nessuna password condivisa per ${state.clientFilter.name}`
        : 'Nessuna password condivisa con te';
    }
  } else {
    // Tab "Tutte" - mostra tutte le password accessibili
    passwordsToShow = filteredBySearch.length > 0 || elements.searchInput.value 
      ? filteredBySearch 
      : basePasswords;
    elements.emptyMessage.textContent = state.clientFilter 
      ? `Nessuna password trovata per ${state.clientFilter.name}`
      : 'Nessuna password trovata';
  }
  
  if (passwordsToShow.length === 0) {
    elements.passwordList.innerHTML = '';
    elements.emptyState.style.display = 'flex';
    return;
  }
  
  elements.emptyState.style.display = 'none';
  
  // Se c'è filtro URL attivo e poche password, mostra lista semplice
  if (state.urlFilterActive && !elements.searchInput.value && passwordsToShow.length <= 10) {
    const categoriesHtml = renderCategoriesOnly(passwordsToShow);
    elements.passwordList.innerHTML = categoriesHtml;
  } else if (state.clientFilter) {
    // Se c'è filtro cliente, mostra solo le categorie (senza raggruppamento per cliente)
    const categoriesHtml = renderCategoriesOnly(passwordsToShow);
    elements.passwordList.innerHTML = categoriesHtml;
  } else {
    // Raggruppa le password per cliente e poi per categoria
    const groupedPasswords = groupPasswordsByClient(passwordsToShow);
    elements.passwordList.innerHTML = renderGroupedPasswords(groupedPasswords);
  }
  
  // Aggiungi event listener per ogni item
  elements.passwordList.querySelectorAll('.password-item').forEach(item => {
    item.addEventListener('click', () => showPasswordDetail(parseInt(item.dataset.id)));
  });
  
  // Aggiungi event listener per i gruppi collassabili
  elements.passwordList.querySelectorAll('.client-group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Non collassare se si clicca sul bottone filtro
      if (e.target.closest('.client-filter-btn')) return;
      const group = header.closest('.client-group');
      group.classList.toggle('collapsed');
    });
  });

  // Aggiungi event listener per le categorie collassabili (secondo livello)
  elements.passwordList.querySelectorAll('.category-group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const group = header.closest('.category-group');
      group.classList.toggle('collapsed');
    });
  });

  // Aggiungi event listener per i bottoni filtro cliente
  elements.passwordList.querySelectorAll('.client-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const clientId = parseInt(btn.dataset.clientId);
      const clientName = btn.dataset.clientName;
      applyClientFilter(clientId, clientName);
    });
  });

  // Aggiungi event listener per i bottoni di copia rapida
  elements.passwordList.querySelectorAll('.quick-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const type = btn.dataset.type;
      const password = state.passwords.find(p => p.id === id);
      
      if (password) {
        // Temporaneamente imposta la password corrente per usare handleCopy
        const prevPassword = state.currentPassword;
        state.currentPassword = password;
        handleCopy(type);
        // Ripristina (opzionale, ma più sicuro)
        if (!elements.viewDetail.style.display === 'block') {
            state.currentPassword = prevPassword;
        }
      }
    });
  });

  // Configura gestori errore immagini (CSP-compliant, no inline handlers)
  setupImageErrorHandlers();
}

/**
 * Re-renderizza la lista password (alias per updatePasswordList)
 */
function renderPasswordList() {
  updatePasswordList();
}

/**
 * Applica il filtro per cliente
 */
function applyClientFilter(clientId, clientName) {
  state.clientFilter = { id: clientId, name: clientName };
  
  // Mostra la barra del filtro attivo
  showClientFilterBar(clientName);
  
  // Aggiorna la lista
  renderPasswordList();
  
  showToast(`Filtro: ${clientName}`, 'success');
}

/**
 * Rimuove il filtro per cliente
 */
function clearClientFilter() {
  state.clientFilter = null;
  
  // Nascondi la barra del filtro
  hideClientFilterBar();
  
  // Aggiorna la lista
  renderPasswordList();
}

/**
 * Mostra la barra del filtro cliente attivo
 */
function showClientFilterBar(clientName) {
  let filterBar = document.getElementById('client-filter-bar');
  
  if (!filterBar) {
    // Crea la barra se non esiste
    filterBar = document.createElement('div');
    filterBar.id = 'client-filter-bar';
    filterBar.className = 'client-filter-bar';
    
    // Inseriscila dopo i tab
    const tabNav = document.querySelector('.tab-nav');
    tabNav.parentNode.insertBefore(filterBar, tabNav.nextSibling);
  }
  
  filterBar.innerHTML = `
    <div class="filter-info">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </svg>
      <span>Filtro: <strong>${escapeHtml(clientName)}</strong></span>
    </div>
    <button id="btn-clear-client-filter" class="filter-clear-btn" title="Rimuovi filtro">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  filterBar.style.display = 'flex';
  
  // Aggiungi event listener per rimuovere il filtro
  document.getElementById('btn-clear-client-filter').addEventListener('click', clearClientFilter);
}

/**
 * Nascondi la barra del filtro cliente
 */
function hideClientFilterBar() {
  const filterBar = document.getElementById('client-filter-bar');
  if (filterBar) {
    filterBar.style.display = 'none';
  }
}

/**
 * Mostra l'indicatore del filtro URL attivo
 */
function showUrlFilterIndicator() {
  let filterBar = document.getElementById('url-filter-bar');
  
  if (!filterBar) {
    // Crea la barra se non esiste
    filterBar = document.createElement('div');
    filterBar.id = 'url-filter-bar';
    filterBar.className = 'url-filter-bar';
    
    // Inseriscila dopo i tab
    const tabNav = document.querySelector('.tab-nav');
    tabNav.parentNode.insertBefore(filterBar, tabNav.nextSibling);
  }
  
  // Estrai il dominio dall'URL corrente
  let domain = 'questo sito';
  try {
    const url = new URL(state.currentUrl);
    domain = url.hostname.replace('www.', '');
  } catch {}
  
  filterBar.innerHTML = `
    <div class="filter-info">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>
      <span>Password per <strong>${escapeHtml(domain)}</strong> (${state.urlMatchingPasswords.length})</span>
    </div>
    <button id="btn-show-all-passwords" class="filter-show-all-btn" title="Mostra tutte">
      Mostra tutte
    </button>
  `;
  
  filterBar.style.display = 'flex';
  
  // Aggiungi event listener per mostrare tutte le password
  document.getElementById('btn-show-all-passwords').addEventListener('click', clearUrlFilter);
}

/**
 * Rimuove il filtro URL
 */
function clearUrlFilter() {
  state.urlFilterActive = false;
  state.filteredPasswords = [];
  hideUrlFilterBar();
  updatePasswordList();
}

/**
 * Nascondi la barra del filtro URL
 */
function hideUrlFilterBar() {
  const filterBar = document.getElementById('url-filter-bar');
  if (filterBar) {
    filterBar.style.display = 'none';
  }
}

/**
 * Configura i gestori di errore per le immagini dei clienti
 * Necessario per evitare violazioni CSP con handler inline
 */
function setupImageErrorHandlers() {
  document.querySelectorAll('.client-icon-img').forEach(img => {
    img.addEventListener('error', function() {
      this.style.display = 'none';
      const fallback = this.nextElementSibling;
      if (fallback) {
        fallback.style.display = 'block';
      }
    });
  });
}

/**
 * Raggruppa le password per cliente e poi per categoria
 * Struttura: Cliente → Categoria → Password
 */
function groupPasswordsByClient(passwords) {
  const groups = {};
  const noClient = [];
  
  passwords.forEach(password => {
    if (password.partner_id && password.partner_name) {
      const clientKey = password.partner_id;
      if (!groups[clientKey]) {
        groups[clientKey] = {
          id: password.partner_id,
          name: password.partner_name,
          image: password.partner_image,
          categories: {},
          totalCount: 0
        };
      }
      
      // Raggruppa per categoria all'interno del cliente
      const categoryKey = password.category || 'other';
      const categoryName = password.category ? getCategoryDisplayName(password.category) : 'Altro';
      
      if (!groups[clientKey].categories[categoryKey]) {
        groups[clientKey].categories[categoryKey] = {
          key: categoryKey,
          name: categoryName,
          passwords: []
        };
      }
      groups[clientKey].categories[categoryKey].passwords.push(password);
      groups[clientKey].totalCount++;
    } else {
      noClient.push(password);
    }
  });
  
  // Converti le categorie in array ordinati per ogni cliente
  Object.values(groups).forEach(group => {
    group.categoryList = Object.values(group.categories).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  });
  
  // Ordina i gruppi per nome cliente
  const sortedGroups = Object.values(groups).sort((a, b) => 
    a.name.localeCompare(b.name)
  );
  
  return {
    clientGroups: sortedGroups,
    noClientPasswords: noClient
  };
}

/**
 * Ottiene il nome visualizzato per una categoria
 */
function getCategoryDisplayName(category) {
  const categoryNames = {
    'web': 'Siti Web',
    'server': 'Server',
    'database': 'Database',
    'email': 'Email',
    'vpn': 'VPN',
    'wifi': 'WiFi',
    'api': 'API',
    'certificate': 'Certificati',
    'ssh': 'SSH',
    'ftp': 'FTP',
    'other': 'Altro'
  };
  return categoryNames[category] || category || 'Altro';
}

/**
 * Renderizza le password raggruppate per cliente e categoria
 * Struttura: Cliente → Categoria → Password
 */
function renderGroupedPasswords(grouped) {
  let html = '';
  
  // Prima mostra le password senza cliente (se ce ne sono poche o siamo in ricerca)
  if (grouped.noClientPasswords.length > 0 && grouped.clientGroups.length === 0) {
    // Se non ci sono gruppi, mostra semplicemente la lista
    html += grouped.noClientPasswords.map(p => createPasswordItem(p)).join('');
  } else {
    // Mostra i gruppi per cliente (chiusi di default)
    grouped.clientGroups.forEach(group => {
      // Costruisci l'icona del cliente: immagine base64 se disponibile, altrimenti SVG
      let clientIconHtml;
      if (group.image) {
        clientIconHtml = `
          <div class="client-icon client-icon-with-img">
            <img src="data:image/png;base64,${group.image}" alt="${escapeHtml(group.name)}" class="client-icon-img" data-has-fallback="true" />
            <svg class="client-icon-fallback" style="display: none;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        `;
      } else {
        clientIconHtml = `
          <div class="client-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        `;
      }
      
      // Costruisci il contenuto con le categorie
      let categoriesHtml = '';
      group.categoryList.forEach(category => {
        const categoryIcon = getCategoryIcon(category.key);
        categoriesHtml += `
          <div class="category-group collapsed">
            <div class="category-group-header" data-category="${escapeHtml(category.key)}">
              <div class="category-icon">${categoryIcon}</div>
              <div class="category-name">${escapeHtml(category.name)}</div>
              <div class="category-count">${category.passwords.length}</div>
              <div class="category-chevron">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
            <div class="category-group-content">
              ${category.passwords.map(p => createPasswordItem(p)).join('')}
            </div>
          </div>
        `;
      });
      
      html += `
        <div class="client-group collapsed">
          <div class="client-group-header">
            ${clientIconHtml}
            <div class="client-name">${escapeHtml(group.name)}</div>
            <button class="client-filter-btn" data-client-id="${group.id}" data-client-name="${escapeHtml(group.name)}" title="Filtra per questo cliente">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
            </button>
            <div class="client-count">${group.totalCount}</div>
            <div class="client-chevron">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="client-group-content">
            ${categoriesHtml}
          </div>
        </div>
      `;
    });
    
    // Poi mostra le password senza cliente (chiuso di default)
    if (grouped.noClientPasswords.length > 0) {
      // Raggruppa anche queste per categoria
      const noClientCategories = {};
      grouped.noClientPasswords.forEach(p => {
        const catKey = p.category || 'other';
        const catName = getCategoryDisplayName(catKey);
        if (!noClientCategories[catKey]) {
          noClientCategories[catKey] = { key: catKey, name: catName, passwords: [] };
        }
        noClientCategories[catKey].passwords.push(p);
      });
      
      const noClientCatList = Object.values(noClientCategories).sort((a, b) => a.name.localeCompare(b.name));
      
      let noClientCategoriesHtml = '';
      noClientCatList.forEach(category => {
        const categoryIcon = getCategoryIcon(category.key);
        noClientCategoriesHtml += `
          <div class="category-group collapsed">
            <div class="category-group-header" data-category="${escapeHtml(category.key)}">
              <div class="category-icon">${categoryIcon}</div>
              <div class="category-name">${escapeHtml(category.name)}</div>
              <div class="category-count">${category.passwords.length}</div>
              <div class="category-chevron">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
            <div class="category-group-content">
              ${category.passwords.map(p => createPasswordItem(p)).join('')}
            </div>
          </div>
        `;
      });
      
      html += `
        <div class="client-group collapsed">
          <div class="client-group-header">
            <div class="client-icon" style="opacity: 0.5;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <div class="client-name" style="color: var(--text-secondary);">Senza cliente</div>
            <div class="client-count">${grouped.noClientPasswords.length}</div>
            <div class="client-chevron">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="client-group-content">
            ${noClientCategoriesHtml}
          </div>
        </div>
      `;
    }
  }
  
  return html;
}

/**
 * Renderizza le password raggruppate solo per categoria (usato quando c'è filtro cliente)
 */
function renderCategoriesOnly(passwords) {
  // Raggruppa per categoria
  const categories = {};
  passwords.forEach(password => {
    const catKey = password.category || 'other';
    const catName = getCategoryDisplayName(catKey);
    if (!categories[catKey]) {
      categories[catKey] = { key: catKey, name: catName, passwords: [] };
    }
    categories[catKey].passwords.push(password);
  });
  
  const categoryList = Object.values(categories).sort((a, b) => a.name.localeCompare(b.name));
  
  // Se il filtro URL è attivo, non collassare le categorie
  const collapsedClass = state.urlFilterActive ? '' : 'collapsed';
  
  let html = '';
  categoryList.forEach(category => {
    const categoryIcon = getCategoryIcon(category.key);
    html += `
      <div class="category-group ${collapsedClass} category-group-standalone">
        <div class="category-group-header" data-category="${escapeHtml(category.key)}">
          <div class="category-icon">${categoryIcon}</div>
          <div class="category-name">${escapeHtml(category.name)}</div>
          <div class="category-count">${category.passwords.length}</div>
          <div class="category-chevron">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
        <div class="category-group-content">
          ${category.passwords.map(p => createPasswordItem(p)).join('')}
        </div>
      </div>
    `;
  });
  
  return html;
}

/**
 * Crea l'HTML per un elemento password
 */
function createPasswordItem(password) {
  const categoryIcon = getCategoryIcon(password.category);
  
  // Badge permessi: mostra se è owner o il livello di accesso
  let permissionBadge = '';
  if (password.is_owner) {
    permissionBadge = '<span class="permission-badge owner" title="Sei nel gruppo Owner">Owner</span>';
  } else if (password.access_level === 'write') {
    permissionBadge = '<span class="permission-badge write" title="Lettura e Scrittura">R/W</span>';
  } else {
    permissionBadge = '<span class="permission-badge read" title="Solo Lettura">R</span>';
  }
  
  // Crea il link URL se presente
  let urlHtml = '';
  if (password.uri) {
    // Estrai dominio per display più pulito
    let displayUrl = password.uri;
    try {
      const url = new URL(password.uri.startsWith('http') ? password.uri : 'https://' + password.uri);
      displayUrl = url.hostname + (url.pathname !== '/' ? url.pathname : '');
    } catch (e) {
      displayUrl = password.uri;
    }
    const fullUrl = password.uri.startsWith('http') ? password.uri : 'https://' + password.uri;
    urlHtml = `<a href="${escapeHtml(fullUrl)}" class="password-url" target="_blank" title="${escapeHtml(password.uri)}">${escapeHtml(displayUrl)}</a>`;
  }
  
  return `
    <div class="password-item" data-id="${password.id}">
      <div class="password-icon">
        ${categoryIcon}
      </div>
      <div class="password-info">
        <div class="password-name-row">
          <span class="password-name">${escapeHtml(password.name)}</span>
          ${permissionBadge}
        </div>
        <div class="password-username">${escapeHtml(password.username || '')}</div>
        ${urlHtml}
      </div>
      <div class="password-actions">
        ${password.uri ? `
        <button class="quick-copy" data-id="${password.id}" data-type="uri" title="Copia URL">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>` : ''}
        <button class="quick-copy" data-id="${password.id}" data-type="username" title="Copia username">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </button>
        <button class="quick-copy" data-id="${password.id}" data-type="password" title="Copia password">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Restituisce l'icona per la categoria
 */
function getCategoryIcon(category) {
  const icons = {
    web: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    database: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    server: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    email: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    social: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    banking: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    vpn: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    wifi: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>'
  };
  
  return icons[category] || icons.web;
}

/**
 * Mostra i dettagli di una password
 */
async function showPasswordDetail(passwordId) {
  setLoading(true);
  
  try {
    const response = await sendMessage({ action: 'getPasswordById', id: passwordId });
    
    if (response.password) {
      state.currentPassword = response.password;
      
      elements.detailTitle.textContent = response.password.name;
      elements.detailName.textContent = response.password.name;
      elements.detailUsername.textContent = response.password.username || '-';
      elements.detailPassword.textContent = '••••••••';
      elements.detailPassword.dataset.value = response.password.password_plain || '';
      
      if (response.password.uri) {
        elements.detailUri.textContent = response.password.uri;
        elements.detailUri.href = response.password.uri.startsWith('http') 
          ? response.password.uri 
          : `https://${response.password.uri}`;
        elements.detailUriContainer.style.display = 'block';
      } else {
        elements.detailUriContainer.style.display = 'none';
      }
      
      if (response.password.description) {
        elements.detailDescription.textContent = response.password.description;
        elements.detailDescriptionContainer.style.display = 'block';
      } else {
        elements.detailDescriptionContainer.style.display = 'none';
      }
      
      showView('detail');
    }
  } catch (error) {
    console.error('Error loading password detail:', error);
    showToast('Errore nel caricamento della password', 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Gestisce la ricerca
 */
function handleSearch() {
  const query = elements.searchInput.value.toLowerCase().trim();
  
  elements.btnClearSearch.style.display = query ? 'flex' : 'none';
  
  if (query) {
    // Quando c'è ricerca, nascondi la barra del filtro URL
    hideUrlFilterBar();
    
    state.filteredPasswords = state.passwords.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.username && p.username.toLowerCase().includes(query)) ||
      (p.uri && p.uri.toLowerCase().includes(query))
    );
    
    // Switch alla tab "tutte" se stiamo cercando
    if (state.currentTab === 'suggested') {
      switchTab('all', false);
    }
  } else {
    state.filteredPasswords = [];
    
    // Se ci sono password matching, riattiva il filtro URL
    if (state.urlMatchingPasswords.length > 0) {
      state.urlFilterActive = true;
      state.filteredPasswords = state.urlMatchingPasswords;
      showUrlFilterIndicator();
    }
  }
  
  updatePasswordList();
}

/**
 * Pulisce la ricerca
 */
function clearSearch() {
  elements.searchInput.value = '';
  elements.btnClearSearch.style.display = 'none';
  state.filteredPasswords = [];
  
  // Se ci sono password matching, riattiva il filtro URL
  if (state.urlMatchingPasswords.length > 0) {
    state.urlFilterActive = true;
    state.filteredPasswords = state.urlMatchingPasswords;
    showUrlFilterIndicator();
  }
  
  updatePasswordList();
}

/**
 * Cambia tab
 */
function switchTab(tab, updateList = true) {
  state.currentTab = tab;
  
  elements.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  if (updateList) {
    updatePasswordList();
  }
}

/**
 * Compila le credenziali nella pagina corrente
 */
async function handleFillCredentials() {
  if (!state.currentPassword) return;
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tabs.length > 0) {
      await sendMessage({
        action: 'fillCredentials',
        tabId: tabs[0].id,
        username: state.currentPassword.username,
        password: state.currentPassword.password_plain
      });
      
      showToast('Credenziali inserite', 'success');
      window.close();
    }
  } catch (error) {
    console.error('Error filling credentials:', error);
    showToast('Errore nell\'inserimento delle credenziali', 'error');
  }
}

/**
 * Toggle visibilità password
 */
function togglePasswordVisibility() {
  const passwordEl = elements.detailPassword;
  const isHidden = passwordEl.classList.contains('password-masked');
  
  if (isHidden) {
    passwordEl.textContent = passwordEl.dataset.value;
    passwordEl.classList.remove('password-masked');
  } else {
    passwordEl.textContent = '••••••••';
    passwordEl.classList.add('password-masked');
  }
  
  // Toggle icons
  const iconEye = elements.btnTogglePassword.querySelector('.icon-eye');
  const iconEyeOff = elements.btnTogglePassword.querySelector('.icon-eye-off');
  iconEye.style.display = isHidden ? 'none' : 'block';
  iconEyeOff.style.display = isHidden ? 'block' : 'none';
}

/**
 * Gestisce la copia negli appunti
 */
async function handleCopy(type) {
  if (!state.currentPassword) return;
  
  let textToCopy = '';
  
  switch (type) {
    case 'username':
      textToCopy = state.currentPassword.username || '';
      break;
    case 'password':
      textToCopy = state.currentPassword.password_plain || '';
      break;
    case 'uri':
      textToCopy = state.currentPassword.uri || '';
      break;
  }
  
  try {
    await navigator.clipboard.writeText(textToCopy);
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} copiato`, 'success');
  } catch (error) {
    console.error('Clipboard error:', error);
    showToast('Errore nella copia', 'error');
  }
}

/**
 * Mostra una view specifica
 */
function showView(viewName) {
  elements.viewLogin.style.display = 'none';
  elements.viewMain.style.display = 'none';
  elements.viewDetail.style.display = 'none';
  elements.viewAddPassword.style.display = 'none';
  
  switch (viewName) {
    case 'login':
      elements.viewLogin.style.display = 'flex';
      elements.userFooter.style.display = 'none';
      break;
    case 'main':
      elements.viewMain.style.display = 'flex';
      elements.userFooter.style.display = state.isAuthenticated ? 'flex' : 'none';
      break;
    case 'detail':
      elements.viewDetail.style.display = 'flex';
      elements.userFooter.style.display = 'none';
      break;
    case 'add':
      elements.viewAddPassword.style.display = 'flex';
      elements.userFooter.style.display = 'none';
      break;
  }
}

function showLoginView() {
  showView('login');
}

function showMainView() {
  showView('main');
}

/**
 * Apre le impostazioni
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
}

/**
 * Imposta lo stato di caricamento
 */
function setLoading(loading) {
  state.isLoading = loading;
  elements.loadingState.style.display = loading ? 'flex' : 'none';
}

/**
 * Mostra un toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  elements.toastContainer.appendChild(toast);
  
  // Animazione di ingresso
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Rimuovi dopo 3 secondi
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Invia un messaggio al service worker
 */
async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.error) {
        // Gestione speciale per errore di versione obsoleta
        if (response.error === 'VERSION_OUTDATED') {
          handleVersionOutdated(response.data);
          reject(new Error('VERSION_OUTDATED'));
        } else if (response.error === 'SESSION_EXPIRED') {
          // Gestione speciale per sessione scaduta
          reject(new Error('SESSION_EXPIRED'));
        } else {
          reject(new Error(response.error));
        }
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Gestisce l'errore di versione obsoleta
 */
function handleVersionOutdated(data) {
  // Mostra una vista speciale per l'aggiornamento
  const downloadUrl = data?.download_url || '/passdoo/downloads';
  const currentVersion = data?.current_version || 'sconosciuta';
  const minVersion = data?.min_version || 'più recente';
  
  // Nascondi tutte le viste
  hideAllViews();
  
  // Mostra messaggio di aggiornamento
  const mainView = elements.viewMain || document.getElementById('view-main');
  if (mainView) {
    mainView.style.display = 'block';
    const passwordList = document.getElementById('password-list');
    if (passwordList) {
      passwordList.innerHTML = `
        <div class="update-required-message">
          <div class="update-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <h3>Aggiornamento Richiesto</h3>
          <p>La versione attuale (${escapeHtml(currentVersion)}) non è più supportata.</p>
          <p>È richiesta almeno la versione <strong>${escapeHtml(minVersion)}</strong>.</p>
          <a href="${CONFIG.ODOO_URL}${downloadUrl}" target="_blank" class="btn btn-primary update-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Scarica Aggiornamento
          </a>
        </div>
      `;
    }
  }
  
  // Esegui logout per sicurezza
  chrome.runtime.sendMessage({ action: 'logout' });
}

/**
 * Escape HTML per prevenire XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// Add Password Functions
// ==========================================

/**
 * Mostra la vista di aggiunta password
 */
async function showAddPasswordView() {
  // Reset form
  elements.formAddPassword.reset();
  elements.addPassword.type = 'password';
  
  // Pre-compila l'URL con la pagina corrente
  if (state.currentUrl) {
    elements.addUri.value = state.currentUrl;
    
    // Suggerisci un nome basato sul dominio
    try {
      const url = new URL(state.currentUrl);
      const domain = url.hostname.replace('www.', '');
      elements.addName.value = domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (e) {}
  }
  
  // Carica clienti e categorie in parallelo
  await Promise.all([loadClients(), loadCategories()]);
  
  // Mostra la vista
  hideAllViews();
  elements.viewAddPassword.style.display = 'block';
}

/**
 * Carica la lista delle categorie nel dropdown
 */
async function loadCategories() {
  try {
    const response = await sendMessage({ action: 'getCategories' });
    const categories = (response && response.categories) ? response.categories : [];
    
    // Svuota e ricompila il dropdown
    elements.addCategory.innerHTML = '';
    
    if (categories.length === 0) {
      // Fallback a categorie default se l'API non restituisce nulla
      const defaultCategories = [
        { id: 'web', label: 'Sito Web' },
        { id: 'database', label: 'Database' },
        { id: 'server', label: 'Server' },
        { id: 'application', label: 'Applicazione' },
        { id: 'email', label: 'Email' },
        { id: 'other', label: 'Altro' }
      ];
      defaultCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.label;
        elements.addCategory.appendChild(option);
      });
    } else {
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id || cat.value;
        option.textContent = cat.label || cat.name;
        elements.addCategory.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading categories:', error);
    // In caso di errore, mostra categorie di fallback
    elements.addCategory.innerHTML = `
      <option value="web">Sito Web</option>
      <option value="other">Altro</option>
    `;
  }
}

/**
 * Carica la lista dei clienti nel dropdown
 */
async function loadClients() {
  try {
    const response = await sendMessage({ action: 'getClients' });
    const clients = (response && response.clients) ? response.clients : [];
    
    // Svuota e ricompila il dropdown
    elements.addClient.innerHTML = '<option value="">-- Nessun cliente --</option>';
    
    clients.forEach(client => {
      const option = document.createElement('option');
      option.value = client.id;
      option.textContent = client.name;
      elements.addClient.appendChild(option);
    });
    
    // Reset della sezione gruppi
    elements.groupsSharingSection.style.display = 'none';
    elements.groupsList.innerHTML = '';
  } catch (error) {
    console.error('Error loading clients:', error);
    // In caso di errore, mostra solo l'opzione default
    elements.addClient.innerHTML = '<option value="">-- Nessun cliente --</option>';
  }
}

/**
 * Gestisce il cambio di cliente selezionato
 */
async function handleClientChange() {
  const clientId = elements.addClient.value;
  
  if (!clientId) {
    // Nessun cliente selezionato - nascondi sezione gruppi
    elements.groupsSharingSection.style.display = 'none';
    elements.groupsList.innerHTML = '';
    return;
  }
  
  // Mostra sezione gruppi con loading
  elements.groupsSharingSection.style.display = 'block';
  elements.groupsList.innerHTML = '<div class="groups-loading">Caricamento gruppi...</div>';
  
  try {
    const response = await sendMessage({ 
      action: 'getClientGroups', 
      partnerId: parseInt(clientId) 
    });
    const groups = (response && response.groups) ? response.groups : [];
    const maxPermission = response.max_permission || 'read';
    
    if (groups.length === 0) {
      elements.groupsList.innerHTML = '<div class="groups-empty">Nessun gruppo disponibile</div>';
      return;
    }
    
    // Renderizza i gruppi con il livello massimo di permesso dell'utente
    renderGroupsList(groups, maxPermission);
  } catch (error) {
    console.error('Error loading client groups:', error);
    elements.groupsList.innerHTML = '<div class="groups-empty">Errore nel caricamento dei gruppi</div>';
  }
}

/**
 * Renderizza la lista dei gruppi con checkbox e select per i permessi
 */
function renderGroupsList(groups, maxUserPermission = 'read') {
  elements.groupsList.innerHTML = '';
  
  groups.forEach(group => {
    // Usa il flag is_owner_group dal backend
    const isOwner = group.is_owner_group === true;
    const div = document.createElement('div');
    div.className = 'group-item' + (isOwner ? ' is-owner' : '');
    div.dataset.groupId = group.id;
    
    if (isOwner) {
      // Gruppo proprietario - sempre attivo con write
      div.innerHTML = `
        <div class="group-header">
          <input type="checkbox" class="group-checkbox" checked disabled data-group-id="${group.id}">
          <span class="group-name">${escapeHtml(group.name)}</span>
          <span class="group-owner-badge">Proprietario</span>
        </div>
        <select class="group-access-select" disabled data-group-id="${group.id}">
          <option value="write" selected>Lettura/Scrittura</option>
        </select>
      `;
    } else {
      // Altri gruppi - l'utente può assegnare al massimo il suo livello di permesso
      const canAssignWrite = maxUserPermission === 'write';
      div.innerHTML = `
        <div class="group-header">
          <input type="checkbox" class="group-checkbox" data-group-id="${group.id}">
          <span class="group-name">${escapeHtml(group.name)}</span>
        </div>
        <select class="group-access-select" data-group-id="${group.id}" disabled>
          <option value="read">Solo Lettura</option>
          ${canAssignWrite ? '<option value="write">Lettura/Scrittura</option>' : ''}
        </select>
      `;
      
      // Event listener per abilitare/disabilitare la select
      const checkbox = div.querySelector('.group-checkbox');
      const select = div.querySelector('.group-access-select');
      
      checkbox.addEventListener('change', () => {
        select.disabled = !checkbox.checked;
        if (!checkbox.checked) {
          select.value = 'read'; // Reset a read quando deselezionato
        }
      });
    }
    
    elements.groupsList.appendChild(div);
  });
}

/**
 * Raccoglie i dati dei gruppi selezionati dal form
 */
function collectGroupAccess() {
  const groupAccess = [];
  
  const checkboxes = elements.groupsList.querySelectorAll('.group-checkbox:checked:not(:disabled)');
  checkboxes.forEach(checkbox => {
    const groupId = parseInt(checkbox.dataset.groupId);
    const select = elements.groupsList.querySelector(`.group-access-select[data-group-id="${groupId}"]`);
    
    if (select && !isNaN(groupId)) {
      groupAccess.push({
        group_id: groupId,
        access_level: select.value
      });
    }
  });
  
  return groupAccess;
}

/**
 * Toggle visibilità password nel form di aggiunta
 */
function toggleAddPasswordVisibility() {
  const input = elements.addPassword;
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

/**
 * Genera una password sicura
 */
async function handleGeneratePassword() {
  try {
    const response = await sendMessage({ 
      action: 'generatePassword',
      options: {
        length: 16,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true
      }
    });
    
    if (response.password) {
      elements.addPassword.value = response.password;
      elements.addPassword.type = 'text'; // Mostra la password generata
      showToast('Password generata', 'success');
    }
  } catch (error) {
    console.error('Error generating password:', error);
    showToast('Errore nella generazione', 'error');
  }
}

/**
 * Salva una nuova password
 */
async function handleSavePassword(event) {
  event.preventDefault();
  
  const name = elements.addName.value.trim();
  const password = elements.addPassword.value;
  
  if (!name || !password) {
    showToast('Nome e password sono obbligatori', 'error');
    return;
  }
  
  // Disabilita il bottone durante il salvataggio
  elements.btnSavePassword.disabled = true;
  elements.btnSavePassword.innerHTML = '<span class="spinner-small"></span> Salvataggio...';
  
  try {
    const categoryValue = elements.addCategory.value;
    const passwordData = {
      name: name,
      username: elements.addUsername.value.trim(),
      password: password,
      uri: elements.addUri.value.trim(),
      // Invia category_id se è numerico, altrimenti category come fallback
      category_id: !isNaN(categoryValue) ? parseInt(categoryValue) : null,
      category: isNaN(categoryValue) ? categoryValue : null,
      description: elements.addDescription.value.trim()
    };
    
    // Aggiungi il cliente se selezionato
    const clientId = elements.addClient.value;
    if (clientId) {
      passwordData.partner_id = parseInt(clientId);
      
      // Aggiungi i permessi dei gruppi selezionati
      const groupAccess = collectGroupAccess();
      if (groupAccess.length > 0) {
        passwordData.group_access = groupAccess;
      }
    }
    
    const response = await sendMessage({ 
      action: 'createPassword',
      passwordData: passwordData
    });
    
    if (response.password) {
      showToast('Password salvata con successo', 'success');
      
      // Ricarica le password e torna alla lista
      await loadPasswords(true);
      showMainView();
    }
  } catch (error) {
    console.error('Error saving password:', error);
    showToast(error.message || 'Errore durante il salvataggio', 'error');
  } finally {
    elements.btnSavePassword.disabled = false;
    elements.btnSavePassword.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      Salva
    `;
  }
}

/**
 * Funzione helper per nascondere tutte le viste
 */
function hideAllViews() {
  elements.viewLogin.style.display = 'none';
  elements.viewMain.style.display = 'none';
  elements.viewDetail.style.display = 'none';
  elements.viewAddPassword.style.display = 'none';
}

/**
 * Pre-compila il form con credenziali intercettate
 */
function prefillAddPasswordForm(credentials) {
  if (credentials.username) {
    elements.addUsername.value = credentials.username;
  }
  if (credentials.password) {
    elements.addPassword.value = credentials.password;
  }
  if (credentials.url) {
    elements.addUri.value = credentials.url;
    try {
      const url = new URL(credentials.url);
      const domain = url.hostname.replace('www.', '');
      elements.addName.value = domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (e) {}
  }
}

/**
 * Mostra il modal About
 */
function showAboutModal() {
  // Aggiorna la versione dal manifest
  const version = chrome.runtime.getManifest().version;
  const versionEl = document.getElementById('about-version');
  if (versionEl) {
    versionEl.textContent = `Versione ${version}`;
  }
  
  elements.aboutModal.style.display = 'flex';
}

/**
 * Nasconde il modal About
 */
function hideAboutModal() {
  elements.aboutModal.style.display = 'none';
}
