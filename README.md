# 🔐 Passdoo Browser Extension

<p align="center">
  <img src="src/icons/icon-128.png" alt="Passdoo Logo" width="128"/>
</p>

<p align="center">
  <strong>Password Manager for ODOO - Browser Extension</strong><br>
  Access your passwords saved in Passdoo directly from your browser
</p>

<p align="center">
  <a href="https://portal.novacs.net/passdoo/downloads">📥 Download</a> •
  <a href="#-installation">📖 Installation</a> •
  <a href="#-usage">🚀 Usage</a>
</p>

---

## ✨ Features

- **Quick Access**: Access your passwords directly from the extension popup
- **Real-time Search**: Quickly search through all your passwords
- **Grouping**: Passwords organized by client and category (Personal/Shared)
- **Quick Copy**: Copy username and password with one click
- **Client Logos**: Display client logos associated with passwords
- **Security**: Authentication via ODOO with Microsoft Entra ID support

## 🚀 Installation

### Prerequisites

- Google Chrome 88+ or Firefox 109+
- Access to ODOO with Passdoo module installed
- Account configured on https://portal.novacs.net

### Chrome Installation

1. Download the latest version from [Releases](https://github.com/balduz84/Passdoo-browser-extension/releases)
2. Extract the ZIP archive
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked"
6. Select the extracted folder

### Firefox Installation

1. Download the latest version from [Releases](https://github.com/balduz84/Passdoo-browser-extension/releases)
2. Extract the ZIP archive
3. Open Firefox and go to `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the extracted folder

## 📖 Usage

### First Login

1. Click the Passdoo icon in the toolbar
2. Click "Sign in with Entra ID"
3. Log in with your ODOO credentials
4. The extension is now ready to use

### Auto-fill

When you visit a page with a login form:

1. You'll see a Passdoo icon next to the username/password fields
2. Click the icon to see suggested passwords
3. Select a password to auto-fill the fields

### Keyboard Shortcuts

- `Alt+Shift+P`: Open Passdoo popup
- `Alt+Shift+F`: Auto-fill fields on the current page

## 🔒 Security

- Passwords are stored encrypted in the ODOO database
- Session is validated on every request
- Automatic lock after inactivity period
- No passwords are stored locally in plain text
- Complete audit trail of all accesses

## 🏗️ Project Structure

```
passdoo_browser_extension/
├── manifest.json           # Extension manifest (Chrome MV3)
├── src/
│   ├── background/         # Service worker
│   │   ├── service-worker.js
│   │   └── api/           # API Client
│   │       ├── passdoo-api.js
│   │       ├── auth-service.js
│   │       └── storage-service.js
│   ├── popup/             # Popup interface
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── content/           # Content script
│   │   ├── content-script.js
│   │   └── content-styles.css
│   ├── options/           # Options page
│   │   ├── options.html
│   │   └── options.js
│   └── icons/             # Extension icons
└── README.md
```

## 🔧 ODOO Server Configuration

To use the extension, the Passdoo module on ODOO must expose REST APIs. Add the controllers provided in the `controllers/` directory of the Passdoo module.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/passdoo/api/extension/auth` | GET | Start authentication |
| `/passdoo/api/extension/validate` | GET | Validate session |
| `/passdoo/api/extension/passwords` | GET | List passwords |
| `/passdoo/api/extension/password/<id>` | GET | Password details |
| `/passdoo/api/extension/passwords/search` | POST | Search passwords |
| `/passdoo/api/extension/user` | GET | User info |

## 🛠️ Development

### Production Build

For Chrome:
```bash
# Create a .crx or .zip file for Chrome Web Store
zip -r passdoo-extension.zip . -x "*.git*" -x "*.md"
```

For Firefox:
```bash
# Create a .xpi file for Firefox Add-ons
web-ext build
```

### Debug

1. Open the extension developer tools
2. For Chrome: `chrome://extensions/` → Details → Service worker
3. For Firefox: `about:debugging` → Inspect

## 📝 Notes

- The extension is designed to work with ODOO 18 Enterprise Edition
- Requires the Passdoo module installed and configured
- Authentication leverages the Entra ID integration already configured in ODOO

## 📄 License

Copyright © 2025 NovaCS

All rights reserved.

## 🔗 Useful Links

- [Passdoo Desktop App](https://github.com/balduz84/Passdoo-desktop)
- [Download Page](https://portal.novacs.net/passdoo/downloads)
- [NovaCS](https://www.novacs.net)

## 🤝 Support

For issues or requests, contact NovaCS technical support.
