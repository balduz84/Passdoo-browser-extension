/**
 * Passdoo Browser Extension - Auth Service
 * Gestisce l'autenticazione OAuth con Entra ID tramite ODOO
 */

export class AuthService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Inizia il flusso di autenticazione OAuth
   * ODOO gestisce l'integrazione con Entra ID, quindi semplicemente
   * redirigiamo alla pagina di login di ODOO che poi gestirà OAuth
   */
  getLoginUrl() {
    // URL di login ODOO che gestisce l'autenticazione Entra ID
    return `${this.baseUrl}/web/login`;
  }

  /**
   * URL per l'autenticazione diretta dell'estensione
   * Questo endpoint è personalizzato per restituire un token
   */
  getExtensionAuthUrl() {
    return `${this.baseUrl}/passdoo/api/extension/auth`;
  }

  /**
   * Verifica se la sessione è valida
   */
  async validateSession(sessionId) {
    try {
      const response = await fetch(`${this.baseUrl}/passdoo/api/extension/validate`, {
        method: 'GET',
        headers: {
          'X-Passdoo-Session': sessionId,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      console.error('AuthService: Validation error', error);
      return false;
    }
  }

  /**
   * Effettua il logout
   */
  async logout(sessionId) {
    try {
      await fetch(`${this.baseUrl}/passdoo/api/extension/logout`, {
        method: 'POST',
        headers: {
          'X-Passdoo-Session': sessionId,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      return true;
    } catch (error) {
      console.error('AuthService: Logout error', error);
      return false;
    }
  }

  /**
   * Refresh del token di sessione
   */
  async refreshSession(sessionId) {
    try {
      const response = await fetch(`${this.baseUrl}/passdoo/api/extension/refresh`, {
        method: 'POST',
        headers: {
          'X-Passdoo-Session': sessionId,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.session_id;
    } catch (error) {
      console.error('AuthService: Refresh error', error);
      return null;
    }
  }
}
