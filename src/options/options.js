/**
 * Passdoo Browser Extension - Options Page Script
 */

// Elementi DOM
const elements = {
  autoFill: document.getElementById('autoFill'),
  showNotifications: document.getElementById('showNotifications'),
  autoLockMinutes: document.getElementById('autoLockMinutes'),
  clearClipboardSeconds: document.getElementById('clearClipboardSeconds'),
  darkMode: document.getElementById('darkMode'),
  connectionStatus: document.getElementById('connection-status'),
  version: document.getElementById('version'),
  btnSave: document.getElementById('btn-save'),
  btnReset: document.getElementById('btn-reset'),
  btnClearData: document.getElementById('btn-clear-data'),
  toast: document.getElementById('toast')
};

// Impostazioni predefinite
const defaultSettings = {
  autoFill: true,
  showNotifications: true,
  autoLockMinutes: 30,
  clearClipboardSeconds: 30,
  darkMode: 'system'
};

/**
 * Inizializzazione
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Mostra la versione
  elements.version.textContent = chrome.runtime.getManifest().version;
  
  // Carica le impostazioni
  await loadSettings();
  
  // Verifica lo stato della connessione
  await checkConnectionStatus();
  
  // Event listeners
  elements.btnSave.addEventListener('click', saveSettings);
  elements.btnReset.addEventListener('click', resetSettings);
  elements.btnClearData.addEventListener('click', clearAllData);
  
  // Check per primo avvio
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('firstRun') === 'true') {
    showToast('Benvenuto in Passdoo! Configura l\'estensione qui.');
  }
});

/**
 * Carica le impostazioni salvate
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('passdoo_settings');
    const settings = result.passdoo_settings || defaultSettings;
    
    elements.autoFill.checked = settings.autoFill !== false;
    elements.showNotifications.checked = settings.showNotifications !== false;
    elements.autoLockMinutes.value = settings.autoLockMinutes || 30;
    elements.clearClipboardSeconds.value = settings.clearClipboardSeconds || 30;
    elements.darkMode.value = settings.darkMode || 'system';
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Salva le impostazioni
 */
async function saveSettings() {
  const settings = {
    autoFill: elements.autoFill.checked,
    showNotifications: elements.showNotifications.checked,
    autoLockMinutes: parseInt(elements.autoLockMinutes.value),
    clearClipboardSeconds: parseInt(elements.clearClipboardSeconds.value),
    darkMode: elements.darkMode.value
  };
  
  try {
    await chrome.storage.sync.set({ passdoo_settings: settings });
    showToast('Impostazioni salvate');
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Errore nel salvataggio', 'error');
  }
}

/**
 * Ripristina le impostazioni predefinite
 */
async function resetSettings() {
  elements.autoFill.checked = defaultSettings.autoFill;
  elements.showNotifications.checked = defaultSettings.showNotifications;
  elements.autoLockMinutes.value = defaultSettings.autoLockMinutes;
  elements.clearClipboardSeconds.value = defaultSettings.clearClipboardSeconds;
  elements.darkMode.value = defaultSettings.darkMode;
  
  await saveSettings();
  showToast('Impostazioni ripristinate');
}

/**
 * Cancella tutti i dati
 */
async function clearAllData() {
  if (!confirm('Sei sicuro di voler cancellare tutti i dati locali dell\'estensione?')) {
    return;
  }
  
  try {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    showToast('Dati cancellati. L\'estensione verrà ricaricata.');
    
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } catch (error) {
    console.error('Error clearing data:', error);
    showToast('Errore nella cancellazione dei dati', 'error');
  }
}

/**
 * Verifica lo stato della connessione
 */
async function checkConnectionStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
    
    if (response.isAuthenticated) {
      elements.connectionStatus.classList.remove('disconnected');
      elements.connectionStatus.querySelector('.status-text').textContent = 'Connesso';
    } else {
      elements.connectionStatus.classList.add('disconnected');
      elements.connectionStatus.querySelector('.status-text').textContent = 'Non connesso';
    }
  } catch (error) {
    elements.connectionStatus.classList.add('disconnected');
    elements.connectionStatus.querySelector('.status-text').textContent = 'Errore di connessione';
  }
}

/**
 * Mostra un toast
 */
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}
