# 🔐 Passdoo Browser Extension

<p align="center">
  <img src="src/icons/icon-128.png" alt="Passdoo Logo" width="128"/>
</p>

<p align="center">
  <strong>Password Manager per ODOO - Estensione Browser</strong><br>
  Accedi alle tue password salvate in Passdoo direttamente dal browser
</p>

<p align="center">
  <a href="https://portal.novacs.net/passdoo/downloads">📥 Download</a> •
  <a href="#-installazione">📖 Installazione</a> •
  <a href="#-utilizzo">🚀 Utilizzo</a>
</p>

---

## ✨ Funzionalità

- **Accesso rapido**: Accedi alle tue password direttamente dal popup dell'estensione
- **Ricerca in tempo reale**: Cerca rapidamente tra tutte le tue password
- **Raggruppamento**: Password organizzate per cliente e categoria (Personali/Condivise)
- **Copia rapida**: Copia username e password con un click
- **Logo clienti**: Visualizza i loghi dei clienti associati alle password
- **Sicurezza**: Autenticazione tramite ODOO con supporto Microsoft Entra ID

## 🚀 Installazione

### Prerequisiti

- Google Chrome 88+ o Firefox 109+
- Accesso a ODOO con il modulo Passdoo installato
- Account configurato su https://portal.novacs.net

### Installazione su Chrome

1. Scarica l'ultima versione da [Releases](https://github.com/balduz84/Passdoo-browser-extension/releases)
2. Estrai l'archivio ZIP
3. Apri Chrome e vai su `chrome://extensions/`
4. Abilita "Modalità sviluppatore" in alto a destra
5. Clicca "Carica estensione non pacchettizzata"
6. Seleziona la cartella estratta

### Installazione su Firefox

1. Scarica l'ultima versione da [Releases](https://github.com/balduz84/Passdoo-browser-extension/releases)
2. Estrai l'archivio ZIP
3. Apri Firefox e vai su `about:debugging#/runtime/this-firefox`
4. Clicca "Carica componente aggiuntivo temporaneo"
5. Seleziona il file `manifest.json` dalla cartella estratta

## 📖 Utilizzo

### Primo accesso

1. Clicca sull'icona Passdoo nella barra degli strumenti
2. Clicca "Accedi con Entra ID"
3. Effettua il login con le tue credenziali ODOO
4. L'estensione è ora pronta all'uso

### Compilazione automatica

Quando visiti una pagina con un modulo di login:

1. Vedrai un'icona Passdoo accanto ai campi username/password
2. Clicca sull'icona per vedere le password suggerite
3. Seleziona la password per compilare automaticamente i campi

### Scorciatoie da tastiera

- `Alt+Shift+P`: Apri il popup Passdoo
- `Alt+Shift+F`: Compila automaticamente i campi della pagina corrente

## 🔒 Sicurezza

- Le password sono memorizzate cifrate nel database ODOO
- La sessione viene validata ad ogni richiesta
- Blocco automatico dopo un periodo di inattività
- Nessuna password viene memorizzata localmente in chiaro
- Audit completo di tutti gli accessi

## 🏗️ Struttura del Progetto

```
passdoo_browser_extension/
├── manifest.json           # Manifest dell'estensione (Chrome MV3)
├── src/
│   ├── background/         # Service worker
│   │   ├── service-worker.js
│   │   └── api/           # Client API
│   │       ├── passdoo-api.js
│   │       ├── auth-service.js
│   │       └── storage-service.js
│   ├── popup/             # Interfaccia popup
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── content/           # Content script
│   │   ├── content-script.js
│   │   └── content-styles.css
│   ├── options/           # Pagina opzioni
│   │   ├── options.html
│   │   └── options.js
│   └── icons/             # Icone estensione
└── README.md
```

## 🔧 Configurazione Server ODOO

Per utilizzare l'estensione, il modulo Passdoo su ODOO deve esporre le API REST. Aggiungi i controller forniti nella directory `controllers/` del modulo Passdoo.

### API Endpoints

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/passdoo/api/extension/auth` | GET | Avvia autenticazione |
| `/passdoo/api/extension/validate` | GET | Valida sessione |
| `/passdoo/api/extension/passwords` | GET | Lista password |
| `/passdoo/api/extension/password/<id>` | GET | Dettaglio password |
| `/passdoo/api/extension/passwords/search` | POST | Cerca password |
| `/passdoo/api/extension/user` | GET | Info utente |

## 🛠️ Sviluppo

### Build per produzione

Per Chrome:
```bash
# Crea un file .crx o .zip per il Chrome Web Store
zip -r passdoo-extension.zip . -x "*.git*" -x "*.md"
```

Per Firefox:
```bash
# Crea un file .xpi per Firefox Add-ons
web-ext build
```

### Debug

1. Apri gli strumenti sviluppatore dell'estensione
2. Per Chrome: `chrome://extensions/` → Dettagli → Service worker
3. Per Firefox: `about:debugging` → Ispeziona

## 📄 Licenza

© 2025 NovaCS S.r.l. - Tutti i diritti riservati

## 🔗 Link Utili

- [Passdoo Desktop App](https://github.com/balduz84/Passdoo-desktop)
- [Pagina Download](https://portal.novacs.net/passdoo/downloads)
- [NovaCS](https://www.novacs.net)

## 📝 Note

- L'estensione è progettata per funzionare con ODOO 18 Enterprise Edition
- Richiede il modulo Passdoo installato e configurato
- L'autenticazione sfrutta l'integrazione Entra ID già configurata in ODOO

## 📄 Licenza

Copyright © 2025 NovaCS

Tutti i diritti riservati.

## 🤝 Supporto

Per problemi o richieste, contatta il supporto tecnico NovaCS.
