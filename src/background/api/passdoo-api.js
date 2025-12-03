/**
 * Passdoo Browser Extension - API Client per ODOO
 * Gestisce tutte le chiamate API verso il server ODOO/Passdoo
 */

// Versione dell'estensione (letta dal manifest)
const EXTENSION_VERSION = chrome.runtime.getManifest().version;

export class PassdooAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Esegue una chiamata API a ODOO
   */
  async request(endpoint, method = 'GET', data = null, sessionId = null) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Type': 'browser-extension',
      'X-Client-Version': EXTENSION_VERSION
    };
    
    // Aggiungi il session ID se presente
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
    
    try {
      const response = await fetch(url, options);
      
      // Gestione speciale per errore di versione
      if (response.status === 426) {
        const errorData = await response.json();
        // Emetti un evento speciale per la gestione aggiornamento
        const error = new Error(errorData.message || 'Aggiornamento richiesto');
        error.code = 'VERSION_OUTDATED';
        error.data = errorData;
        throw error;
      }
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sessione scaduta o non valida');
        }
        if (response.status === 403) {
          throw new Error('Accesso negato');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Errore HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Passdoo API Error:', error);
      throw error;
    }
  }

  /**
   * Valida la sessione corrente
   */
  async validateSession(sessionId) {
    try {
      const result = await this.request('/passdoo/api/extension/validate', 'GET', null, sessionId);
      return result.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Ottiene la lista delle password accessibili all'utente
   */
  async getPasswords(sessionId) {
    const result = await this.request('/passdoo/api/extension/passwords', 'GET', null, sessionId);
    return result.passwords || [];
  }

  /**
   * Ottiene una password specifica con la password decifrata
   */
  async getPassword(sessionId, passwordId) {
    const result = await this.request(`/passdoo/api/extension/password/${passwordId}`, 'GET', null, sessionId);
    return result.password;
  }

  /**
   * Cerca password per URL
   */
  async searchPasswordsByUrl(sessionId, url) {
    const result = await this.request('/passdoo/api/extension/passwords/search', 'POST', { url }, sessionId);
    return result.passwords || [];
  }

  /**
   * Ottiene le informazioni dell'utente corrente
   */
  async getUserInfo(sessionId) {
    const result = await this.request('/passdoo/api/extension/user', 'GET', null, sessionId);
    return result.user;
  }

  /**
   * Registra un accesso alla password (per audit)
   */
  async logPasswordAccess(sessionId, passwordId, action) {
    await this.request('/passdoo/api/extension/audit', 'POST', {
      password_id: passwordId,
      action: action
    }, sessionId);
  }

  /**
   * Verifica se l'utente ha accesso a una password specifica
   */
  async checkPasswordAccess(sessionId, passwordId) {
    try {
      const result = await this.request(`/passdoo/api/extension/password/${passwordId}/access`, 'GET', null, sessionId);
      return result.has_access === true;
    } catch {
      return false;
    }
  }

  /**
   * Ottiene le categorie delle password
   */
  async getCategories(sessionId) {
    const result = await this.request('/passdoo/api/extension/categories', 'GET', null, sessionId);
    return result.categories || [];
  }

  /**
   * Cerca password per parola chiave
   */
  async searchPasswords(sessionId, query) {
    const result = await this.request('/passdoo/api/extension/passwords/search', 'POST', { query }, sessionId);
    return result.passwords || [];
  }


  /**
   * Genera una password sicura
   */
  async generatePassword(sessionId, options = {}) {
    const defaultOptions = {
      length: 16,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true
    };
    
    const result = await this.request('/passdoo/api/extension/generate-password', 'POST', 
      { ...defaultOptions, ...options }, sessionId);
    return result.password;
  }

  /**
   * Salva una nuova password
   */
  async createPassword(sessionId, passwordData) {
    const result = await this.request('/passdoo/api/extension/passwords', 'POST', passwordData, sessionId);
    return result.password;
  }

  /**
   * Aggiorna una password esistente
   */
  async updatePassword(sessionId, passwordId, passwordData) {
    const result = await this.request(`/passdoo/api/extension/password/${passwordId}`, 'PUT', passwordData, sessionId);
    return result.password;
  }

  /**
   * Ottiene la lista dei clienti accessibili
   */
  async getClients(sessionId) {
    try {
      const result = await this.request('/passdoo/api/extension/clients', 'GET', null, sessionId);
      return result.clients || [];
    } catch (error) {
      console.warn('Passdoo API: getClients failed, returning empty list', error.message);
      return [];
    }
  }

  /**
   * Ottiene i gruppi di permesso disponibili per un cliente
   * Restituisce i gruppi con il livello massimo di permesso che l'utente può assegnare
   */
  async getClientGroups(sessionId, partnerId) {
    try {
      const result = await this.request(`/passdoo/api/extension/client/${partnerId}/groups`, 'GET', null, sessionId);
      return result.groups || [];
    } catch (error) {
      console.warn('Passdoo API: getClientGroups failed', error.message);
      return [];
    }
  }
}

