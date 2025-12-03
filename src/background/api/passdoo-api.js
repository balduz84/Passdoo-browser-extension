/**
 * Passdoo Browser Extension - API Client per ODOO
 * Gestisce tutte le chiamate API verso il server ODOO/Passdoo
 * Usa autenticazione token Bearer (come app desktop)
 */

// Versione dell'estensione (letta dal manifest)
const EXTENSION_VERSION = chrome.runtime.getManifest().version;

export class PassdooAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Esegue una chiamata API a ODOO con token Bearer
   */
  async request(endpoint, method = 'GET', data = null, token = null) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Type': 'browser-extension',
      'X-Client-Version': EXTENSION_VERSION
    };
    
    // Usa token Bearer per l'autenticazione
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
      method,
      headers,
      credentials: 'omit'  // Non inviare cookie, usiamo solo token
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
          throw new Error('Token non valido o scaduto');
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
   * Valida il token corrente
   */
  async validateToken(token) {
    try {
      const result = await this.request('/passdoo/api/extension/validate', 'GET', null, token);
      return result.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Ottiene la lista delle password accessibili all'utente
   */
  async getPasswords(token) {
    const result = await this.request('/passdoo/api/extension/passwords', 'GET', null, token);
    return result.passwords || [];
  }

  /**
   * Ottiene una password specifica con la password decifrata
   */
  async getPassword(token, passwordId) {
    const result = await this.request(`/passdoo/api/extension/password/${passwordId}`, 'GET', null, token);
    return result.password;
  }

  /**
   * Cerca password per URL
   */
  async searchPasswordsByUrl(token, url) {
    const result = await this.request('/passdoo/api/extension/passwords/search', 'POST', { url }, token);
    return result.passwords || [];
  }

  /**
   * Ottiene le informazioni dell'utente corrente
   */
  async getUserInfo(token) {
    const result = await this.request('/passdoo/api/extension/user', 'GET', null, token);
    return result.user;
  }

  /**
   * Registra un accesso alla password (per audit)
   */
  async logPasswordAccess(token, passwordId, action) {
    await this.request('/passdoo/api/extension/audit', 'POST', {
      password_id: passwordId,
      action: action
    }, token);
  }

  /**
   * Verifica se l'utente ha accesso a una password specifica
   */
  async checkPasswordAccess(token, passwordId) {
    try {
      const result = await this.request(`/passdoo/api/extension/password/${passwordId}/access`, 'GET', null, token);
      return result.has_access === true;
    } catch {
      return false;
    }
  }

  /**
   * Ottiene le categorie delle password
   */
  async getCategories(token) {
    const result = await this.request('/passdoo/api/extension/categories', 'GET', null, token);
    return result.categories || [];
  }

  /**
   * Cerca password per parola chiave
   */
  async searchPasswords(token, query) {
    const result = await this.request('/passdoo/api/extension/passwords/search', 'POST', { query }, token);
    return result.passwords || [];
  }


  /**
   * Genera una password sicura
   */
  async generatePassword(token, options = {}) {
    const defaultOptions = {
      length: 16,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true
    };
    
    const result = await this.request('/passdoo/api/extension/generate-password', 'POST', 
      { ...defaultOptions, ...options }, token);
    return result.password;
  }

  /**
   * Salva una nuova password
   */
  async createPassword(token, passwordData) {
    const result = await this.request('/passdoo/api/extension/passwords', 'POST', passwordData, token);
    return result.password;
  }

  /**
   * Aggiorna una password esistente
   */
  async updatePassword(token, passwordId, passwordData) {
    const result = await this.request(`/passdoo/api/extension/password/${passwordId}`, 'PUT', passwordData, token);
    return result.password;
  }

  /**
   * Ottiene la lista dei clienti accessibili
   */
  async getClients(token) {
    try {
      const result = await this.request('/passdoo/api/extension/clients', 'GET', null, token);
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
  async getClientGroups(token, partnerId) {
    try {
      const result = await this.request(`/passdoo/api/extension/client/${partnerId}/groups`, 'GET', null, token);
      return result.groups || [];
    } catch (error) {
      console.warn('Passdoo API: getClientGroups failed', error.message);
      return [];
    }
  }

  /**
   * Invalida il token (logout)
   */
  async logout(token) {
    try {
      await this.request('/passdoo/api/extension/logout', 'POST', null, token);
      return true;
    } catch (error) {
      console.warn('Passdoo API: logout failed', error.message);
      return false;
    }
  }
}

