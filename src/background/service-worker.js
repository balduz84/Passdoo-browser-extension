/**
 * Passdoo Browser Extension - Service Worker
 * Gestisce l'autenticazione con ODOO/Entra ID e la comunicazione con l'API
 */

import { PassdooAPI } from './api/passdoo-api.js';
import { AuthService } from './api/auth-service.js';
import { StorageService } from './api/storage-service.js';

// Configurazione
const CONFIG = {
  ODOO_URL: 'https://portal.novacs.net',
  SESSION_TIMEOUT_MINUTES: 30,
  CACHE_DURATION_MINUTES: 5
};

// Inizializza i servizi
const api = new PassdooAPI(CONFIG.ODOO_URL);
const auth = new AuthService(CONFIG.ODOO_URL);
const storage = new StorageService();

// Cache delle password per performance
let passwordCache = null;
let cacheTimestamp = null;

/**
 * Gestione dei messaggi dal popup e content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      // Gestione speciale per errore di versione obsoleta
      if (error.code === 'VERSION_OUTDATED') {
        sendResponse({ 
          error: 'VERSION_OUTDATED', 
          message: error.message,
          data: error.data 
        });
      } else {
        sendResponse({ error: error.message });
      }
    });
  return true; // Indica risposta asincrona
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
    
    case 'copyToClipboard':
      return await copyToClipboard(message.text);
    
    case 'fillCredentials':
      return await fillCredentials(message.tabId, message.username, message.password);
    
    case 'getConfig':
      return { config: CONFIG };
    
    case 'getUserInfo':
      return await getUserInfo();
    
    case 'getClients':
      return await getClients();
    
    case 'getClientGroups':
      return await getClientGroups(message.partnerId);
    
    case 'createPassword':
      return await createPassword(message.passwordData);
    
    case 'generatePassword':
      return await generatePassword(message.options);
    
    case 'saveCredentials':
      return await saveCredentials(message.credentials);
    
    default:
      throw new Error(`Azione non riconosciuta: ${message.action}`);
  }
}

/**
 * Gestisce il login tramite ODOO/Entra ID
 */
async function handleLogin() {
  try {
    // Apre una finestra per l'autenticazione OAuth
    const authUrl = `${CONFIG.ODOO_URL}/web/login?redirect=/passdoo/api/extension/auth`;
    
    // Crea una finestra popup per il login
    const popup = await chrome.windows.create({
      url: authUrl,
      type: 'popup',
      width: 500,
      height: 700
    });
    
    // Attendi che l'autenticazione sia completata
    return new Promise((resolve, reject) => {
      const listener = async (tabId, changeInfo, tab) => {
        if (tab.windowId === popup.id && changeInfo.url) {
          // Controlla se siamo stati reindirizzati al callback dell'estensione
          if (changeInfo.url.includes('/passdoo/api/extension/callback')) {
            chrome.tabs.onUpdated.removeListener(listener);
            
            try {
              // Estrai il token dalla URL
              const url = new URL(changeInfo.url);
              const sessionId = url.searchParams.get('session_id');
              const token = url.searchParams.get('token');
              
              if (sessionId || token) {
                // Salva le credenziali
                await storage.setSession({
                  sessionId,
                  token,
                  timestamp: Date.now()
                });
                
                // Chiudi la finestra di login
                await chrome.windows.remove(popup.id);
                
                resolve({ success: true });
              } else {
                reject(new Error('Autenticazione fallita'));
              }
            } catch (error) {
              reject(error);
            }
          } else if (changeInfo.url.includes('/web#') || changeInfo.url === `${CONFIG.ODOO_URL}/web`) {
            // Login completato, ma dobbiamo ottenere il token
            chrome.tabs.onUpdated.removeListener(listener);
            
            try {
              // Ottieni il session_id dal cookie
              const cookies = await chrome.cookies.getAll({ domain: new URL(CONFIG.ODOO_URL).hostname });
              const sessionCookie = cookies.find(c => c.name === 'session_id');
              
              if (sessionCookie) {
                await storage.setSession({
                  sessionId: sessionCookie.value,
                  timestamp: Date.now()
                });
                
                await chrome.windows.remove(popup.id);
                
                // Aggiorna il badge dopo il login
                await updateBadgeForCurrentTab().catch(() => {});
                
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
      
      chrome.tabs.onUpdated.addListener(listener);
      
      // Timeout dopo 5 minuti
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
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
    
    // Nascondi il badge dopo il logout
    await clearAllBadges();
    
    return { success: true };
  } catch (error) {
    console.error('Passdoo: Logout error', error);
    throw error;
  }
}

/**
 * Pulisce il badge da tutte le tab
 */
async function clearAllBadges() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      await chrome.action.setBadgeText({ text: '', tabId: tab.id }).catch(() => {});
    }
  } catch (error) {
    console.error('Passdoo: Error clearing badges', error);
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
    
    // Verifica che la sessione non sia scaduta
    const sessionAge = Date.now() - session.timestamp;
    const maxAge = CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000;
    
    if (sessionAge > maxAge) {
      await storage.clearSession();
      return { isAuthenticated: false };
    }
    
    // Verifica con il server
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
    
    // Usa la cache se valida
    if (!forceRefresh && passwordCache && cacheTimestamp) {
      const cacheAge = Date.now() - cacheTimestamp;
      const maxAge = CONFIG.CACHE_DURATION_MINUTES * 60 * 1000;
      
      if (cacheAge < maxAge) {
        let passwords = passwordCache;
        
        // Filtra per ricerca
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
    
    // Ottieni le password dal server
    const passwords = await api.getPasswords(session.sessionId);
    
    // Aggiorna la cache
    passwordCache = passwords;
    cacheTimestamp = Date.now();
    
    // Filtra per ricerca
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
    
    // Ottieni tutte le password
    const { passwords } = await getPasswords('', false);
    
    // Estrai il dominio dall'URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    
    // Filtra le password che corrispondono all'URL
    const matching = passwords.filter(p => {
      if (!p.uri) return false;
      
      try {
        const pUrl = new URL(p.uri.startsWith('http') ? p.uri : `https://${p.uri}`);
        const pDomain = pUrl.hostname.replace(/^www\./, '');
        return pDomain === domain || domain.endsWith(`.${pDomain}`) || pDomain.endsWith(`.${domain}`);
      } catch {
        // URI non è un URL valido, confronta come stringa
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
 * Copia il testo negli appunti
 */
async function copyToClipboard(text) {
  try {
    // Usa l'API offscreen per copiare
    await chrome.offscreen.createDocument({
      url: 'src/offscreen/offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Copia password negli appunti'
    }).catch(() => {}); // Ignora se già esiste
    
    await chrome.runtime.sendMessage({
      action: 'copyToClipboardOffscreen',
      text
    });
    
    return { success: true };
  } catch (error) {
    console.error('Passdoo: Clipboard error', error);
    throw error;
  }
}

/**
 * Compila le credenziali in una pagina
 */
async function fillCredentials(tabId, username, password) {
  try {
    await chrome.tabs.sendMessage(tabId, {
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
 * Ottiene la lista dei clienti
 */
async function getClients() {
  try {
    const session = await storage.getSession();
    
    if (!session || !session.sessionId) {
      // Se non autenticato, restituisce lista vuota invece di errore
      return { clients: [] };
    }
    
    const clients = await api.getClients(session.sessionId);
    return { clients: clients || [] };
  } catch (error) {
    console.error('Passdoo: Get clients error', error);
    // In caso di errore API, restituisci lista vuota
    return { clients: [] };
  }
}

/**
 * Ottiene i gruppi di permesso per un cliente
 */
async function getClientGroups(partnerId) {
  try {
    const session = await storage.getSession();
    
    if (!session || !session.sessionId) {
      throw new Error('Non autenticato');
    }
    
    if (!partnerId) {
      return { groups: [] };
    }
    
    const groups = await api.getClientGroups(session.sessionId, partnerId);
    return { groups: groups || [] };
  } catch (error) {
    console.error('Passdoo: Get client groups error', error);
    return { groups: [] };
  }
}

/**
 * Crea una nuova password
 */
async function createPassword(passwordData) {
  try {
    const session = await storage.getSession();
    
    if (!session || !session.sessionId) {
      throw new Error('Non autenticato');
    }
    
    const password = await api.createPassword(session.sessionId, passwordData);
    
    // Invalida la cache
    passwordCache = null;
    cacheTimestamp = null;
    
    return { password };
  } catch (error) {
    console.error('Passdoo: Create password error', error);
    throw error;
  }
}

/**
 * Genera una password sicura (localmente, senza chiamata API)
 */
async function generatePassword(options = {}) {
  console.log('Passdoo: Generating password locally with options:', options);
  
  const {
    length = 16,
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true
  } = options;
  
  let charset = '';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  if (!charset) {
    charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  }
  
  // Usa crypto.getRandomValues per generare numeri casuali sicuri
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return { password };
}

/**
 * Salva credenziali intercettate (da content script)
 */
async function saveCredentials(credentials) {
  try {
    const session = await storage.getSession();
    
    if (!session || !session.sessionId) {
      // Memorizza temporaneamente per salvare dopo il login
      await storage.setPendingCredentials(credentials);
      return { pending: true };
    }
    
    // Crea la password
    const passwordData = {
      name: credentials.siteName || credentials.url,
      username: credentials.username,
      password: credentials.password,
      uri: credentials.url,
      category: 'web'
    };
    
    const password = await api.createPassword(session.sessionId, passwordData);
    
    // Invalida la cache
    passwordCache = null;
    cacheTimestamp = null;
    
    return { password };
  } catch (error) {
    console.error('Passdoo: Save credentials error', error);
    throw error;
  }
}

/**
 * Listener per i comandi keyboard shortcut
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'fill_credentials') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      
      // Ottieni le password per l'URL corrente
      const { passwords } = await getPasswordsByUrl(tab.url);
      
      if (passwords.length === 1) {
        // Se c'è una sola password, compilala automaticamente
        const fullPassword = await getPasswordById(passwords[0].id);
        await fillCredentials(tab.id, fullPassword.password.username, fullPassword.password.password_plain);
      } else if (passwords.length > 1) {
        // Se ci sono più password, apri il popup
        chrome.action.openPopup();
      }
    }
  }
});

/**
 * Listener per quando l'estensione viene installata o aggiornata
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Passdoo: Extension installed');
    
    // Apri la pagina delle opzioni al primo avvio
    chrome.tabs.create({
      url: 'src/options/options.html?firstRun=true'
    });
  } else if (details.reason === 'update') {
    console.log('Passdoo: Extension updated to version', chrome.runtime.getManifest().version);
  }
});

/**
 * Alarm per refresh periodico della sessione
 */
chrome.alarms.create('sessionRefresh', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sessionRefresh') {
    const { isAuthenticated } = await checkAuthStatus();
    if (isAuthenticated) {
      // Refresh della cache
      await getPasswords('', true);
      // Aggiorna anche il badge dopo il refresh della cache
      await updateBadgeForCurrentTab();
    }
  }
});

// ==========================================
// Badge Management - Mostra il conteggio delle password per l'URL corrente
// ==========================================

/**
 * Aggiorna il badge dell'icona dell'estensione con il numero di password disponibili per l'URL
 * @param {number} tabId - ID della tab
 * @param {string} url - URL della tab
 */
async function updateBadge(tabId, url) {
  try {
    // Se non è un URL http/https, nascondi il badge
    if (!url || !url.startsWith('http')) {
      await chrome.action.setBadgeText({ text: '', tabId });
      return;
    }
    
    // Verifica autenticazione
    const { isAuthenticated } = await checkAuthStatus();
    if (!isAuthenticated) {
      await chrome.action.setBadgeText({ text: '', tabId });
      return;
    }
    
    // Ottieni le password che corrispondono all'URL
    const { passwords } = await getPasswordsByUrl(url);
    const count = passwords.length;
    
    if (count > 0) {
      // Mostra il badge con il numero di password
      const badgeText = count > 9 ? '9+' : count.toString();
      await chrome.action.setBadgeText({ text: badgeText, tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#521213', tabId }); // Bordeaux
      await chrome.action.setBadgeTextColor({ color: '#FFFFFF', tabId });
    } else {
      // Nessuna password, nascondi il badge
      await chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch (error) {
    console.error('Passdoo: Error updating badge', error);
    // In caso di errore, nascondi il badge
    await chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
  }
}

/**
 * Aggiorna il badge per la tab correntemente attiva
 */
async function updateBadgeForCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      await updateBadge(tab.id, tab.url);
    }
  } catch (error) {
    console.error('Passdoo: Error updating badge for current tab', error);
  }
}

/**
 * Listener per quando una tab viene aggiornata (cambio URL)
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Aggiorna il badge solo quando l'URL cambia e il caricamento è completo
  if (changeInfo.status === 'complete' && tab.url) {
    await updateBadge(tabId, tab.url);
  }
});

/**
 * Listener per quando si passa a una tab diversa
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await updateBadge(tab.id, tab.url);
    }
  } catch (error) {
    console.error('Passdoo: Error on tab activated', error);
  }
});

/**
 * Listener per quando cambia la finestra attiva
 */
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    await updateBadgeForCurrentTab();
  }
});

console.log('Passdoo: Service worker initialized');
