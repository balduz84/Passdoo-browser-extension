/**
 * Passdoo Browser Extension - Service Worker per Firefox
 * Gestisce l'autenticazione con ODOO/Entra ID e la comunicazione con l'API
 * Versione compatibile con Firefox (usa browser.* invece di chrome.*)
 */

// Polyfill per compatibilità Chrome/Firefox
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Configurazione
const CONFIG = {
  ODOO_URL: 'https://portal.novacs.net',
  SESSION_TIMEOUT_MINUTES: 30,
  CACHE_DURATION_MINUTES: 5
};

// Cache delle password per performance
let passwordCache = null;
let cacheTimestamp = null;

/**
 * Storage Service inline per Firefox
 */
const storage = {
  KEYS: {
    SESSION: 'passdoo_session',
    SETTINGS: 'passdoo_settings',
    CACHE: 'passdoo_cache'
  },
  
  async setSession(sessionData) {
    await browserAPI.storage.local.set({ [this.KEYS.SESSION]: sessionData });
  },
  
  async getSession() {
    const result = await browserAPI.storage.local.get(this.KEYS.SESSION);
    return result[this.KEYS.SESSION] || null;
  },
  
  async clearSession() {
    await browserAPI.storage.local.remove([this.KEYS.SESSION, this.KEYS.CACHE]);
  }
};

/**
 * API Client inline per Firefox
 */
const api = {
  baseUrl: CONFIG.ODOO_URL,
  
  async request(endpoint, method = 'GET', data = null, sessionId = null) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (sessionId) {
      headers['X-Passdoo-Session'] = sessionId;
    }
    
    const options = {
      method,
      headers,
      credentials: 'include'
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sessione scaduta o non valida');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Errore HTTP ${response.status}`);
    }
    
    return await response.json();
  },
  
  async validateSession(sessionId) {
    try {
      const result = await this.request('/passdoo/api/extension/validate', 'GET', null, sessionId);
      return result.valid === true;
    } catch {
      return false;
    }
  },
  
  async getPasswords(sessionId) {
    const result = await this.request('/passdoo/api/extension/passwords', 'GET', null, sessionId);
    return result.passwords || [];
  },
  
  async getPassword(sessionId, passwordId) {
    const result = await this.request(`/passdoo/api/extension/password/${passwordId}`, 'GET', null, sessionId);
    return result.password;
  },
  
  async getUserInfo(sessionId) {
    const result = await this.request('/passdoo/api/extension/user', 'GET', null, sessionId);
    return result.user;
  }
};

/**
 * Gestione dei messaggi dal popup e content script
 */
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ error: error.message }));
  return true;
});

/**
 * Handler principale dei messaggi
 */
async function handleMessage(message, sender) {
  console.log('Passdoo: Received message', message.action);
  
  switch (message.action) {
    case 'login':
      return await handleLogin();
    
    case 'logout':
      return await handleLogout();
    
    case 'checkAuth':
      return await checkAuthStatus();
    
    case 'getPasswords':
      return await getPasswords(message.search, message.forceRefresh);
    
    case 'getPasswordById':
      return await getPasswordById(message.id);
    
    case 'getPasswordsByUrl':
      return await getPasswordsByUrl(message.url);
    
    case 'fillCredentials':
      return await fillCredentials(message.tabId, message.username, message.password);
    
    case 'getConfig':
      return { config: CONFIG };
    
    case 'getUserInfo':
      return await getUserInfo();
    
    default:
      throw new Error(`Azione non riconosciuta: ${message.action}`);
  }
}

/**
 * Gestisce il login tramite ODOO/Entra ID
 */
async function handleLogin() {
  try {
    const authUrl = `${CONFIG.ODOO_URL}/web/login?redirect=/passdoo/api/extension/auth`;
    
    const popup = await browserAPI.windows.create({
      url: authUrl,
      type: 'popup',
      width: 500,
      height: 700
    });
    
    return new Promise((resolve, reject) => {
      const listener = async (tabId, changeInfo, tab) => {
        if (tab.windowId === popup.id && changeInfo.url) {
          if (changeInfo.url.includes('/passdoo/api/extension/callback')) {
            browserAPI.tabs.onUpdated.removeListener(listener);
            
            try {
              const url = new URL(changeInfo.url);
              const sessionId = url.searchParams.get('session_id');
              
              if (sessionId) {
                await storage.setSession({
                  sessionId,
                  timestamp: Date.now()
                });
                
                await browserAPI.windows.remove(popup.id);
                resolve({ success: true });
              } else {
                reject(new Error('Autenticazione fallita'));
              }
            } catch (error) {
              reject(error);
            }
          } else if (changeInfo.url.includes('/web#') || changeInfo.url === `${CONFIG.ODOO_URL}/web`) {
            browserAPI.tabs.onUpdated.removeListener(listener);
            
            try {
              const cookies = await browserAPI.cookies.getAll({ domain: new URL(CONFIG.ODOO_URL).hostname });
              const sessionCookie = cookies.find(c => c.name === 'session_id');
              
              if (sessionCookie) {
                await storage.setSession({
                  sessionId: sessionCookie.value,
                  timestamp: Date.now()
                });
                
                await browserAPI.windows.remove(popup.id);
                resolve({ success: true });
              } else {
                reject(new Error('Cookie di sessione non trovato'));
              }
            } catch (error) {
              reject(error);
            }
          }
        }
      };
      
      browserAPI.tabs.onUpdated.addListener(listener);
      
      setTimeout(() => {
        browserAPI.tabs.onUpdated.removeListener(listener);
        reject(new Error('Timeout autenticazione'));
      }, 300000);
    });
  } catch (error) {
    console.error('Passdoo: Login error', error);
    throw error;
  }
}

/**
 * Gestisce il logout
 */
async function handleLogout() {
  try {
    await storage.clearSession();
    passwordCache = null;
    cacheTimestamp = null;
    return { success: true };
  } catch (error) {
    console.error('Passdoo: Logout error', error);
    throw error;
  }
}

/**
 * Verifica lo stato dell'autenticazione
 */
async function checkAuthStatus() {
  try {
    const session = await storage.getSession();
    
    if (!session || !session.sessionId) {
      return { isAuthenticated: false };
    }
    
    const sessionAge = Date.now() - session.timestamp;
    const maxAge = CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000;
    
    if (sessionAge > maxAge) {
      await storage.clearSession();
      return { isAuthenticated: false };
    }
    
    const isValid = await api.validateSession(session.sessionId);
    
    if (!isValid) {
      await storage.clearSession();
      return { isAuthenticated: false };
    }
    
    return { isAuthenticated: true };
  } catch (error) {
    console.error('Passdoo: Auth check error', error);
    return { isAuthenticated: false };
  }
}

/**
 * Ottiene la lista delle password
 */
async function getPasswords(search = '', forceRefresh = false) {
  try {
    const session = await storage.getSession();
    
    if (!session || !session.sessionId) {
      throw new Error('Non autenticato');
    }
    
    if (!forceRefresh && passwordCache && cacheTimestamp) {
      const cacheAge = Date.now() - cacheTimestamp;
      const maxAge = CONFIG.CACHE_DURATION_MINUTES * 60 * 1000;
      
      if (cacheAge < maxAge) {
        let passwords = passwordCache;
        
        if (search) {
          const searchLower = search.toLowerCase();
          passwords = passwords.filter(p => 
            p.name.toLowerCase().includes(searchLower) ||
            (p.username && p.username.toLowerCase().includes(searchLower)) ||
            (p.uri && p.uri.toLowerCase().includes(searchLower))
          );
        }
        
        return { passwords };
      }
    }
    
    const passwords = await api.getPasswords(session.sessionId);
    
    passwordCache = passwords;
    cacheTimestamp = Date.now();
    
    let result = passwords;
    if (search) {
      const searchLower = search.toLowerCase();
      result = passwords.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        (p.username && p.username.toLowerCase().includes(searchLower)) ||
        (p.uri && p.uri.toLowerCase().includes(searchLower))
      );
    }
    
    return { passwords: result };
  } catch (error) {
    console.error('Passdoo: Get passwords error', error);
    throw error;
  }
}

/**
 * Ottiene una password specifica con la password decifrata
 */
async function getPasswordById(id) {
  try {
    const session = await storage.getSession();
    
    if (!session || !session.sessionId) {
      throw new Error('Non autenticato');
    }
    
    const password = await api.getPassword(session.sessionId, id);
    return { password };
  } catch (error) {
    console.error('Passdoo: Get password error', error);
    throw error;
  }
}

/**
 * Ottiene le password che corrispondono a un URL
 */
async function getPasswordsByUrl(url) {
  try {
    const session = await storage.getSession();
    
    if (!session || !session.sessionId) {
      return { passwords: [] };
    }
    
    const { passwords } = await getPasswords('', false);
    
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    
    const matching = passwords.filter(p => {
      if (!p.uri) return false;
      
      try {
        const pUrl = new URL(p.uri.startsWith('http') ? p.uri : `https://${p.uri}`);
        const pDomain = pUrl.hostname.replace(/^www\./, '');
        return pDomain === domain || domain.endsWith(`.${pDomain}`) || pDomain.endsWith(`.${domain}`);
      } catch {
        return p.uri.toLowerCase().includes(domain.toLowerCase());
      }
    });
    
    return { passwords: matching };
  } catch (error) {
    console.error('Passdoo: Get passwords by URL error', error);
    return { passwords: [] };
  }
}

/**
 * Compila le credenziali in una pagina
 */
async function fillCredentials(tabId, username, password) {
  try {
    await browserAPI.tabs.sendMessage(tabId, {
      action: 'fillCredentials',
      username,
      password
    });
    
    return { success: true };
  } catch (error) {
    console.error('Passdoo: Fill credentials error', error);
    throw error;
  }
}

/**
 * Ottiene le informazioni dell'utente corrente
 */
async function getUserInfo() {
  try {
    const session = await storage.getSession();
    
    if (!session || !session.sessionId) {
      throw new Error('Non autenticato');
    }
    
    const userInfo = await api.getUserInfo(session.sessionId);
    return { user: userInfo };
  } catch (error) {
    console.error('Passdoo: Get user info error', error);
    throw error;
  }
}

/**
 * Listener per i comandi keyboard shortcut
 */
browserAPI.commands.onCommand.addListener(async (command) => {
  if (command === 'fill_credentials') {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      
      const { passwords } = await getPasswordsByUrl(tab.url);
      
      if (passwords.length === 1) {
        const fullPassword = await getPasswordById(passwords[0].id);
        await fillCredentials(tab.id, fullPassword.password.username, fullPassword.password.password_plain);
      } else if (passwords.length > 1) {
        browserAPI.browserAction.openPopup();
      }
    }
  }
});

/**
 * Listener per quando l'estensione viene installata o aggiornata
 */
browserAPI.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Passdoo: Extension installed');
    
    browserAPI.tabs.create({
      url: 'src/options/options.html?firstRun=true'
    });
  }
});

/**
 * Alarm per refresh periodico della sessione
 */
browserAPI.alarms.create('sessionRefresh', { periodInMinutes: 5 });

browserAPI.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sessionRefresh') {
    const { isAuthenticated } = await checkAuthStatus();
    if (isAuthenticated) {
      await getPasswords('', true);
    }
  }
});

console.log('Passdoo: Background script initialized (Firefox)');
