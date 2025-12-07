/**
 * Passdoo Browser Extension - Content Script
 * Rileva i campi di login nelle pagine e gestisce il riempimento automatico
 */

(function() {
  'use strict';
  
  // Evita di caricare più volte
  if (window.passdooContentScriptLoaded) return;
  window.passdooContentScriptLoaded = true;
  
  const PASSDOO_CLASS = 'passdoo-field';
  const PASSDOO_ICON_CLASS = 'passdoo-icon';
  
  // Selettori per i campi di login
  const USERNAME_SELECTORS = [
    'input[type="email"]',
    'input[type="text"][name*="user"]',
    'input[type="text"][name*="login"]',
    'input[type="text"][name*="email"]',
    'input[type="text"][id*="user"]',
    'input[type="text"][id*="login"]',
    'input[type="text"][id*="email"]',
    'input[type="text"][autocomplete="username"]',
    'input[type="text"][autocomplete="email"]',
    'input[name="username"]',
    'input[name="login"]',
    'input[name="email"]',
    'input[id="username"]',
    'input[id="login"]',
    'input[id="email"]',
    'input[id="user"]',
  ];
  
  const PASSWORD_SELECTORS = [
    'input[type="password"]',
  ];
  
  // Stato
  let loginFields = {
    username: null,
    password: null
  };
  let overlayVisible = false;
  let currentOverlay = null;
  let matchingPasswords = [];
  let pendingCredentials = null;
  let savePromptVisible = false;
  let extensionContextValid = true;
  
  /**
   * Verifica se il contesto dell'estensione è ancora valido
   */
  function isExtensionContextValid() {
    try {
      // Tenta di accedere a chrome.runtime.id - se l'estensione è invalidata, questo fallirà
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Wrapper sicuro per chrome.runtime.sendMessage
   */
  async function safeSendMessage(message) {
    if (!isExtensionContextValid()) {
      extensionContextValid = false;
      console.log('Passdoo: Extension context invalidated, please refresh the page');
      return null;
    }
    
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        extensionContextValid = false;
        console.log('Passdoo: Extension was reloaded, please refresh the page');
        // Rimuovi le icone Passdoo dalla pagina
        cleanupPassdooElements();
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Rimuove gli elementi Passdoo dalla pagina quando l'estensione è invalidata
   */
  function cleanupPassdooElements() {
    document.querySelectorAll('.' + PASSDOO_ICON_CLASS).forEach(el => el.remove());
    document.querySelectorAll('.' + PASSDOO_CLASS).forEach(el => el.classList.remove(PASSDOO_CLASS));
    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }
  }
  
  /**
   * Rimuove le icone Passdoo che non sono più associate a campi visibili
   * Questo è necessario quando la pagina cambia (es. dopo login, mostra campo OTP)
   */
  function cleanupOrphanedIcons() {
    const icons = document.querySelectorAll('.' + PASSDOO_ICON_CLASS);
    
    icons.forEach(icon => {
      const fieldId = icon.dataset.passdooFieldId;
      if (!fieldId) {
        // Icona senza ID associato, rimuovila
        icon.remove();
        return;
      }
      
      // Trova il campo associato
      const field = document.querySelector(`[data-passdoo-field-id="${fieldId}"]`);
      
      if (!field) {
        // Il campo non esiste più, rimuovi l'icona
        icon.remove();
        return;
      }
      
      if (!isVisible(field)) {
        // Il campo non è più visibile, rimuovi l'icona e la classe dal campo
        icon.remove();
        field.classList.remove(PASSDOO_CLASS);
        delete field.dataset.passdooFieldId;
        return;
      }
      
      // Se il campo è ancora visibile, verifica se è ancora un campo di login valido
      // (potrebbe essere stato cambiato in un altro tipo di input)
      const isLoginField = field.matches('input[type="password"], input[type="text"], input[type="email"]');
      if (!isLoginField) {
        icon.remove();
        field.classList.remove(PASSDOO_CLASS);
        delete field.dataset.passdooFieldId;
      }
    });
    
    // Resetta anche i riferimenti ai campi se sono stati rimossi
    if (loginFields.password && !document.body.contains(loginFields.password)) {
      loginFields.password = null;
    }
    if (loginFields.username && !document.body.contains(loginFields.username)) {
      loginFields.username = null;
    }
  }
  
  /**
   * Inizializzazione
   */
  function init() {
    // Verifica che l'estensione sia ancora valida
    if (!isExtensionContextValid()) {
      console.log('Passdoo: Extension context not valid, skipping initialization');
      return;
    }
    
    // Cerca i campi di login nella pagina
    findLoginFields();
    
    // Osserva le modifiche al DOM per rilevare nuovi campi
    observeDOM();
    
    // Intercetta i submit dei form
    interceptFormSubmit();
    
    // Ascolta i messaggi dal background script
    try {
      chrome.runtime.onMessage.addListener(handleMessage);
    } catch (e) {
      console.log('Passdoo: Could not add message listener');
    }
    
    console.log('Passdoo: Content script initialized');
  }
  
  /**
   * Gestisce i messaggi dal background script
   */
  function handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'fillCredentials':
        fillCredentials(message.username, message.password);
        sendResponse({ success: true });
        break;
        
      case 'getLoginFields':
        sendResponse({ 
          hasLoginFields: loginFields.username !== null || loginFields.password !== null,
          url: window.location.href
        });
        break;
        
      case 'showPasswordMenu':
        if (loginFields.username || loginFields.password) {
          showPasswordMenu(loginFields.username || loginFields.password, message.passwords);
        }
        sendResponse({ success: true });
        break;
    }
    return true;
  }
  
  /**
   * Cerca i campi di login nella pagina
   */
  function findLoginFields() {
    // Prima rimuovi le icone associate a campi non più visibili o rimossi
    cleanupOrphanedIcons();
    
    // Cerca il campo password
    for (const selector of PASSWORD_SELECTORS) {
      const field = document.querySelector(selector);
      if (field && isVisible(field)) {
        loginFields.password = field;
        addPassdooIcon(field);
        break;
      }
    }
    
    // Cerca il campo username
    for (const selector of USERNAME_SELECTORS) {
      const field = document.querySelector(selector);
      if (field && isVisible(field) && field !== loginFields.password) {
        loginFields.username = field;
        addPassdooIcon(field);
        break;
      }
    }
    
    // Cerca anche nella prossimità del campo password
    if (loginFields.password && !loginFields.username) {
      const form = loginFields.password.closest('form');
      if (form) {
        const textInputs = form.querySelectorAll('input[type="text"], input[type="email"]');
        for (const input of textInputs) {
          if (isVisible(input)) {
            loginFields.username = input;
            addPassdooIcon(input);
            break;
          }
        }
      }
    }
    
    // Notifica il background script
    if (loginFields.username || loginFields.password) {
      loadMatchingPasswords();
    }
  }
  
  /**
   * Intercetta il submit dei form per catturare le credenziali
   */
  function interceptFormSubmit() {
    // Listener per il submit dei form
    document.addEventListener('submit', handleFormSubmit, true);
    
    // Intercetta anche i click su bottoni di submit
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button[type="submit"], input[type="submit"], button:not([type])');
      if (target) {
        const form = target.closest('form');
        if (form && hasPasswordField(form)) {
          // Cattura le credenziali prima del submit
          captureCredentials(form);
        }
      }
    }, true);
    
    // Intercetta il pressaggio di Enter nei campi password
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.type === 'password') {
        const form = e.target.closest('form');
        if (form) {
          captureCredentials(form);
        }
      }
    }, true);
  }
  
  /**
   * Gestisce il submit del form
   */
  function handleFormSubmit(e) {
    const form = e.target;
    if (form.tagName !== 'FORM') return;
    
    if (hasPasswordField(form)) {
      captureCredentials(form);
    }
  }
  
  /**
   * Verifica se il form contiene un campo password
   */
  function hasPasswordField(form) {
    return form.querySelector('input[type="password"]') !== null;
  }
  
  /**
   * Cattura le credenziali dal form
   */
  function captureCredentials(form) {
    const passwordField = form.querySelector('input[type="password"]');
    if (!passwordField || !passwordField.value) return;
    
    // Trova il campo username
    let usernameField = null;
    const possibleUserFields = form.querySelectorAll('input[type="text"], input[type="email"]');
    for (const field of possibleUserFields) {
      if (isVisible(field) && field.value) {
        usernameField = field;
        break;
      }
    }
    
    const username = usernameField ? usernameField.value : '';
    const password = passwordField.value;
    
    if (!password) return;
    
    // Verifica se queste credenziali sono già salvate
    const alreadySaved = matchingPasswords.some(p => 
      p.username === username
    );
    
    if (!alreadySaved) {
      pendingCredentials = {
        username,
        password,
        url: window.location.href,
        siteName: getSiteName()
      };
      
      // Mostra il prompt di salvataggio dopo un breve delay (per permettere la navigazione)
      setTimeout(() => {
        if (pendingCredentials) {
          showSavePrompt(pendingCredentials);
        }
      }, 1500);
    }
  }
  
  /**
   * Ottiene il nome del sito dalla pagina
   */
  function getSiteName() {
    // Prova il title della pagina
    const title = document.title;
    if (title) {
      // Rimuovi suffissi comuni
      return title.split(' - ')[0].split(' | ')[0].trim();
    }
    
    // Fallback al dominio
    try {
      const url = new URL(window.location.href);
      return url.hostname.replace('www.', '');
    } catch (e) {
      return window.location.hostname;
    }
  }
  
  /**
   * Mostra il prompt per salvare le credenziali
   */
  function showSavePrompt(credentials) {
    if (savePromptVisible) return;
    savePromptVisible = true;
    
    const banner = document.createElement('div');
    banner.id = 'passdoo-save-prompt';
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      width: 360px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: passdooSlideIn 0.3s ease;
      overflow: hidden;
    `;
    
    banner.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${getIconUrl()}" alt="Passdoo" style="width: 32px; height: 32px; object-fit: contain;">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 14px; color: #111827;">Salvare questa password?</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${escapeHtml(credentials.siteName)}</div>
          </div>
          <button id="passdoo-close-prompt" style="
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            color: #9ca3af;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div style="padding: 16px;">
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Username</div>
          <div style="font-size: 14px; color: #111827; padding: 8px 12px; background: #f9fafb; border-radius: 6px;">${escapeHtml(credentials.username) || '(vuoto)'}</div>
        </div>
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Password</div>
          <div style="font-size: 14px; color: #111827; padding: 8px 12px; background: #f9fafb; border-radius: 6px;">••••••••</div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button id="passdoo-save-btn" style="
            flex: 1;
            padding: 10px 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: background 0.2s;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Salva
          </button>
          <button id="passdoo-options-btn" style="
            padding: 10px 16px;
            background: #f3f4f6;
            color: #374151;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          ">
            Opzioni
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(banner);
    
    // Event listeners
    document.getElementById('passdoo-close-prompt').addEventListener('click', () => {
      closeSavePrompt();
    });
    
    document.getElementById('passdoo-save-btn').addEventListener('click', async () => {
      await saveCredentialsQuick(credentials);
    });
    
    document.getElementById('passdoo-options-btn').addEventListener('click', () => {
      // Apri il popup con le opzioni avanzate
      safeSendMessage({
        action: 'openPopupWithCredentials',
        credentials: credentials
      });
      closeSavePrompt();
    });
    
    // Hover effects
    const saveBtn = document.getElementById('passdoo-save-btn');
    saveBtn.addEventListener('mouseenter', () => saveBtn.style.background = '#1d4ed8');
    saveBtn.addEventListener('mouseleave', () => saveBtn.style.background = '#2563eb');
    
    const optionsBtn = document.getElementById('passdoo-options-btn');
    optionsBtn.addEventListener('mouseenter', () => optionsBtn.style.background = '#e5e7eb');
    optionsBtn.addEventListener('mouseleave', () => optionsBtn.style.background = '#f3f4f6');
    
    // Auto-chiudi dopo 30 secondi
    setTimeout(() => {
      if (document.getElementById('passdoo-save-prompt')) {
        closeSavePrompt();
      }
    }, 30000);
  }
  
  /**
   * Chiude il prompt di salvataggio
   */
  function closeSavePrompt() {
    const prompt = document.getElementById('passdoo-save-prompt');
    if (prompt) {
      prompt.style.animation = 'passdooSlideOut 0.3s ease forwards';
      setTimeout(() => {
        prompt.remove();
        savePromptVisible = false;
        pendingCredentials = null;
      }, 300);
    }
  }
  
  /**
   * Salva le credenziali rapidamente (senza opzioni avanzate)
   */
  async function saveCredentialsQuick(credentials) {
    const saveBtn = document.getElementById('passdoo-save-btn');
    if (saveBtn) {
      saveBtn.innerHTML = '<span style="animation: spin 1s linear infinite; display: inline-block;">⏳</span> Salvataggio...';
      saveBtn.disabled = true;
    }
    
    try {
      const response = await safeSendMessage({
        action: 'saveCredentials',
        credentials: credentials
      });
      
      if (response && (response.password || response.pending)) {
        // Mostra successo
        const prompt = document.getElementById('passdoo-save-prompt');
        if (prompt) {
          prompt.innerHTML = `
            <div style="padding: 24px; text-align: center;">
              <div style="width: 48px; height: 48px; background: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div style="font-weight: 600; font-size: 16px; color: #111827; margin-bottom: 4px;">
                ${response.pending ? 'Password memorizzata' : 'Password salvata!'}
              </div>
              <div style="font-size: 13px; color: #6b7280;">
                ${response.pending ? 'Effettua il login per completare il salvataggio' : 'Le credenziali sono state salvate in Passdoo'}
              </div>
            </div>
          `;
          setTimeout(() => closeSavePrompt(), 2000);
        }
      }
    } catch (error) {
      console.error('Passdoo: Error saving credentials', error);
      if (saveBtn) {
        saveBtn.innerHTML = '❌ Errore';
        saveBtn.style.background = '#ef4444';
        setTimeout(() => closeSavePrompt(), 2000);
      }
    }
  }
  
  /**
   * Carica le password che corrispondono a questa pagina
   */
  async function loadMatchingPasswords() {
    if (!extensionContextValid) return;
    
    try {
      const response = await safeSendMessage({
        action: 'getPasswordsByUrl',
        url: window.location.href
      });
      
      if (response && response.passwords) {
        matchingPasswords = response.passwords;
      }
    } catch (error) {
      // Ignora silenziosamente gli errori di contesto invalidato
      if (!error.message || !error.message.includes('Extension context invalidated')) {
        console.error('Passdoo: Error loading matching passwords', error);
      }
    }
  }
  
  /**
   * Ottiene l'URL dell'icona Passdoo
   */
  function getIconUrl() {
    if (!isExtensionContextValid()) {
      return '';
    }
    try {
      return chrome.runtime.getURL('src/icons/icon-32.png');
    } catch (e) {
      return '';
    }
  }
  
  /**
   * Aggiunge l'icona Passdoo a un campo
   * Usa position:fixed e getBoundingClientRect per posizionare l'icona
   * precisamente all'interno del campo input, indipendentemente dal layout della pagina
   */
  function addPassdooIcon(field) {
    if (!extensionContextValid) return;
    if (field.classList.contains(PASSDOO_CLASS)) return;
    
    field.classList.add(PASSDOO_CLASS);
    
    // Crea l'icona usando l'immagine PNG
    const icon = document.createElement('div');
    icon.className = PASSDOO_ICON_CLASS;
    icon.dataset.passdooFieldId = Math.random().toString(36).substr(2, 9);
    field.dataset.passdooFieldId = icon.dataset.passdooFieldId;
    
    const img = document.createElement('img');
    img.src = getIconUrl();
    img.alt = 'Passdoo';
    img.style.cssText = `
      width: 18px;
      height: 18px;
      object-fit: contain;
      pointer-events: none;
    `;
    icon.appendChild(img);
    
    icon.style.cssText = `
      position: fixed;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0.85;
      transition: opacity 0.2s;
      z-index: 2147483640;
      background: white;
      border-radius: 4px;
      padding: 2px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;
    
    // Funzione per posizionare l'icona
    function positionIcon() {
      const rect = field.getBoundingClientRect();
      // Posiziona all'interno del campo, vicino al bordo destro
      const iconRight = rect.right - 8;
      const iconTop = rect.top + (rect.height / 2);
      
      icon.style.left = `${iconRight - 22}px`;
      icon.style.top = `${iconTop - 11}px`;
      
      // Nascondi se l'input non è visibile
      if (rect.width === 0 || rect.height === 0 || 
          rect.bottom < 0 || rect.top > window.innerHeight ||
          rect.right < 0 || rect.left > window.innerWidth) {
        icon.style.display = 'none';
      } else {
        icon.style.display = 'flex';
      }
    }
    
    // Posiziona inizialmente
    positionIcon();
    
    // Aggiorna posizione su scroll e resize
    const updatePosition = () => {
      if (document.body.contains(field) && document.body.contains(icon)) {
        positionIcon();
      } else if (!document.body.contains(field)) {
        // Il campo è stato rimosso, rimuovi anche l'icona
        icon.remove();
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      }
    };
    
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    // Osserva cambiamenti di visibilità del campo
    const observer = new MutationObserver(updatePosition);
    observer.observe(field, { attributes: true, attributeFilter: ['style', 'class'] });
    
    icon.addEventListener('mouseenter', () => {
      icon.style.opacity = '1';
    });
    
    icon.addEventListener('mouseleave', () => {
      if (!overlayVisible) {
        icon.style.opacity = '0.7';
      }
    });
    
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePasswordMenu(field);
    });
    
    // Inserisci l'icona nel body per evitare problemi di layout
    document.body.appendChild(icon);
    
    // Aggiusta il padding del campo per fare spazio all'icona
    const computedStyle = window.getComputedStyle(field);
    const currentPadding = parseInt(computedStyle.paddingRight) || 0;
    if (currentPadding < 32) {
      field.style.paddingRight = `${Math.max(currentPadding, 32)}px`;
    }
  }
  
  /**
   * Mostra/nasconde il menu delle password
   */
  async function togglePasswordMenu(field) {
    if (overlayVisible) {
      hidePasswordMenu();
      return;
    }
    
    await loadMatchingPasswords();
    showPasswordMenu(field, matchingPasswords);
  }
  
  /**
   * Mostra il menu delle password
   */
  function showPasswordMenu(field, passwords) {
    hidePasswordMenu();
    
    const rect = field.getBoundingClientRect();
    
    const overlay = document.createElement('div');
    overlay.className = 'passdoo-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 4}px;
      left: ${rect.left}px;
      width: ${Math.max(rect.width, 280)}px;
      max-height: 300px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    const headerIcon = document.createElement('img');
    headerIcon.src = getIconUrl();
    headerIcon.alt = 'Passdoo';
    headerIcon.style.cssText = 'width: 20px; height: 20px; object-fit: contain;';
    
    const headerText = document.createElement('span');
    headerText.textContent = 'Passdoo';
    headerText.style.cssText = 'font-weight: 600; font-size: 14px; color: #111827;';
    
    header.appendChild(headerIcon);
    header.appendChild(headerText);
    overlay.appendChild(header);
    
    // Lista password
    const list = document.createElement('div');
    list.style.cssText = `
      max-height: 240px;
      overflow-y: auto;
    `;
    
    if (passwords.length === 0) {
      list.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: #6b7280; font-size: 13px;">
          Nessuna password trovata per questo sito.
          <br><br>
          <a href="#" class="passdoo-open-popup" style="color: #2563eb; text-decoration: none;">Apri Passdoo</a>
        </div>
      `;
    } else {
      passwords.forEach(password => {
        const item = document.createElement('div');
        item.className = 'passdoo-password-item';
        item.style.cssText = `
          padding: 10px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.2s;
        `;
        
        // Contenuto testuale (cliccabile per fill)
        const textContent = document.createElement('div');
        textContent.style.cssText = 'flex: 1; min-width: 0;';
        textContent.innerHTML = `
          <div style="font-size: 14px; font-weight: 500; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(password.name)}
          </div>
          <div style="font-size: 12px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(password.username || '')}
          </div>
        `;
        
        // Freccia per aprire il dettaglio nel popup
        const arrowBtn = document.createElement('div');
        arrowBtn.className = 'passdoo-open-detail-btn';
        arrowBtn.title = 'Apri dettaglio in Passdoo';
        arrowBtn.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 4px;
          transition: background 0.2s;
        `;
        arrowBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        `;
        
        item.appendChild(textContent);
        item.appendChild(arrowBtn);
        
        item.addEventListener('mouseenter', () => {
          item.style.background = '#f3f4f6';
        });
        
        item.addEventListener('mouseleave', () => {
          item.style.background = 'transparent';
          arrowBtn.style.background = 'transparent';
        });
        
        // Click sul testo: compila credenziali
        textContent.addEventListener('click', async (e) => {
          e.stopPropagation();
          await handlePasswordSelect(password.id);
        });
        
        // Hover sulla freccia
        arrowBtn.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          arrowBtn.style.background = '#e5e7eb';
          arrowBtn.querySelector('svg').style.stroke = '#2563eb';
        });
        
        arrowBtn.addEventListener('mouseleave', (e) => {
          arrowBtn.style.background = 'transparent';
          arrowBtn.querySelector('svg').style.stroke = '#9ca3af';
        });
        
        // Click sulla freccia: apri popup con dettaglio
        arrowBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await openPopupWithDetail(password.id);
        });
        
        list.appendChild(item);
      });
    }
    
    overlay.appendChild(list);
    
    // Event listener per chiudere il menu
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);
    
    document.body.appendChild(overlay);
    currentOverlay = overlay;
    overlayVisible = true;
    
    // Listener per aprire il popup
    const openPopupLink = overlay.querySelector('.passdoo-open-popup');
    if (openPopupLink) {
      openPopupLink.addEventListener('click', (e) => {
        e.preventDefault();
        safeSendMessage({ action: 'openPopup' });
        hidePasswordMenu();
      });
    }
  }
  
  /**
   * Gestisce la selezione di una password
   */
  async function handlePasswordSelect(passwordId) {
    if (!extensionContextValid) return;
    
    try {
      const response = await safeSendMessage({
        action: 'getPasswordById',
        id: passwordId
      });
      
      if (response && response.password) {
        fillCredentials(response.password.username, response.password.password_plain);
        hidePasswordMenu();
        showNotification('Credenziali inserite');
      }
    } catch (error) {
      console.error('Passdoo: Error getting password', error);
      showNotification('Errore nel recupero della password', 'error');
    }
  }
  
  /**
   * Apre il popup dell'estensione con il dettaglio di una password specifica
   */
  async function openPopupWithDetail(passwordId) {
    if (!extensionContextValid) return;
    
    try {
      hidePasswordMenu();
      
      // Invia messaggio al background per aprire il popup con il dettaglio
      await safeSendMessage({
        action: 'openPopupWithDetail',
        passwordId: passwordId
      });
    } catch (error) {
      console.error('Passdoo: Error opening popup with detail', error);
      showNotification('Clicca sull\'icona Passdoo per vedere il dettaglio', 'info');
    }
  }
  
  /**
   * Nasconde il menu delle password
   */
  function hidePasswordMenu() {
    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }
    overlayVisible = false;
    document.removeEventListener('click', handleClickOutside);
  }
  
  /**
   * Gestisce i click fuori dal menu
   */
  function handleClickOutside(e) {
    if (currentOverlay && !currentOverlay.contains(e.target) && 
        !e.target.classList.contains(PASSDOO_ICON_CLASS)) {
      hidePasswordMenu();
    }
  }
  
  /**
   * Compila i campi con le credenziali
   */
  function fillCredentials(username, password) {
    // Ritrova i campi (potrebbero essere cambiati)
    findLoginFields();
    
    if (loginFields.username && username) {
      setFieldValue(loginFields.username, username);
    }
    
    if (loginFields.password && password) {
      setFieldValue(loginFields.password, password);
    }
  }
  
  /**
   * Imposta il valore di un campo simulando l'input dell'utente
   */
  function setFieldValue(field, value) {
    // Focus sul campo
    field.focus();
    
    // Imposta il valore
    field.value = value;
    
    // Trigger eventi per React, Angular, Vue, ecc.
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    field.dispatchEvent(inputEvent);
    
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    field.dispatchEvent(changeEvent);
    
    // Per React
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(field, value);
    
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  /**
   * Mostra una notifica
   */
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'passdoo-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10002;
      animation: passdooSlideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'passdooSlideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
  
  /**
   * Verifica se un elemento è visibile
   */
  function isVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
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
  
  /**
   * Osserva le modifiche al DOM
   */
  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      let nodesRemoved = false;
      
      for (const mutation of mutations) {
        // Controlla nodi aggiunti
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && (node.matches('input') || node.querySelector('input'))) {
                shouldCheck = true;
                break;
              }
            }
          }
        }
        
        // Controlla nodi rimossi (potrebbero essere campi con icone)
        if (mutation.removedNodes.length > 0) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && (node.matches('input') || node.matches('.' + PASSDOO_CLASS) || node.querySelector('input'))) {
                nodesRemoved = true;
                break;
              }
            }
          }
        }
        
        if (shouldCheck && nodesRemoved) break;
      }
      
      if (shouldCheck || nodesRemoved) {
        // Debounce
        clearTimeout(window.passdooCheckTimeout);
        window.passdooCheckTimeout = setTimeout(findLoginFields, 300);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Aggiungi stili globali
  const style = document.createElement('style');
  style.textContent = `
    @keyframes passdooSlideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes passdooSlideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  // Inizializza quando il DOM è pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
