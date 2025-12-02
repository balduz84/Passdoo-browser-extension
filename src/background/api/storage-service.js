/**
 * Passdoo Browser Extension - Storage Service
 * Gestisce la memorizzazione sicura dei dati nell'estensione
 */

export class StorageService {
  constructor() {
    this.KEYS = {
      SESSION: 'passdoo_session',
      SETTINGS: 'passdoo_settings',
      CACHE: 'passdoo_cache',
      LAST_SYNC: 'passdoo_last_sync',
      PENDING_CREDENTIALS: 'passdoo_pending_credentials'
    };
  }

  /**
   * Salva la sessione
   */
  async setSession(sessionData) {
    await chrome.storage.local.set({
      [this.KEYS.SESSION]: sessionData
    });
  }

  /**
   * Ottiene la sessione corrente
   */
  async getSession() {
    const result = await chrome.storage.local.get(this.KEYS.SESSION);
    return result[this.KEYS.SESSION] || null;
  }

  /**
   * Cancella la sessione
   */
  async clearSession() {
    await chrome.storage.local.remove([this.KEYS.SESSION, this.KEYS.CACHE]);
  }

  /**
   * Salva le impostazioni
   */
  async setSettings(settings) {
    const current = await this.getSettings();
    await chrome.storage.sync.set({
      [this.KEYS.SETTINGS]: { ...current, ...settings }
    });
  }

  /**
   * Ottiene le impostazioni
   */
  async getSettings() {
    const result = await chrome.storage.sync.get(this.KEYS.SETTINGS);
    return result[this.KEYS.SETTINGS] || this.getDefaultSettings();
  }

  /**
   * Impostazioni predefinite
   */
  getDefaultSettings() {
    return {
      autoFill: true,
      showNotifications: true,
      autoLockMinutes: 30,
      clearClipboardSeconds: 30,
      darkMode: 'system',
      language: 'it'
    };
  }

  /**
   * Salva nella cache
   */
  async setCache(key, data, ttlMinutes = 5) {
    const cache = await this.getFullCache();
    cache[key] = {
      data,
      expires: Date.now() + (ttlMinutes * 60 * 1000)
    };
    await chrome.storage.local.set({
      [this.KEYS.CACHE]: cache
    });
  }

  /**
   * Ottiene dalla cache
   */
  async getCache(key) {
    const cache = await this.getFullCache();
    const item = cache[key];
    
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      // Cache scaduta
      delete cache[key];
      await chrome.storage.local.set({
        [this.KEYS.CACHE]: cache
      });
      return null;
    }
    
    return item.data;
  }

  /**
   * Ottiene tutta la cache
   */
  async getFullCache() {
    const result = await chrome.storage.local.get(this.KEYS.CACHE);
    return result[this.KEYS.CACHE] || {};
  }

  /**
   * Pulisce la cache scaduta
   */
  async cleanExpiredCache() {
    const cache = await this.getFullCache();
    const now = Date.now();
    
    for (const key in cache) {
      if (cache[key].expires < now) {
        delete cache[key];
      }
    }
    
    await chrome.storage.local.set({
      [this.KEYS.CACHE]: cache
    });
  }

  /**
   * Salva la data dell'ultima sincronizzazione
   */
  async setLastSync(timestamp) {
    await chrome.storage.local.set({
      [this.KEYS.LAST_SYNC]: timestamp
    });
  }

  /**
   * Ottiene la data dell'ultima sincronizzazione
   */
  async getLastSync() {
    const result = await chrome.storage.local.get(this.KEYS.LAST_SYNC);
    return result[this.KEYS.LAST_SYNC] || null;
  }

  /**
   * Cancella tutti i dati dell'estensione
   */
  async clearAll() {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
  }

  /**
   * Salva credenziali in attesa di essere salvate
   */
  async setPendingCredentials(credentials) {
    await chrome.storage.local.set({
      [this.KEYS.PENDING_CREDENTIALS]: credentials
    });
  }

  /**
   * Ottiene le credenziali in attesa
   */
  async getPendingCredentials() {
    const result = await chrome.storage.local.get(this.KEYS.PENDING_CREDENTIALS);
    return result[this.KEYS.PENDING_CREDENTIALS] || null;
  }

  /**
   * Cancella le credenziali in attesa
   */
  async clearPendingCredentials() {
    await chrome.storage.local.remove(this.KEYS.PENDING_CREDENTIALS);
  }
}

