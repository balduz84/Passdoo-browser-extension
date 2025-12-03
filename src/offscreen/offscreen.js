/**
 * Passdoo Offscreen Script
 * Gestisce operazioni che richiedono DOM, come la copia negli appunti
 */

// Ascolta messaggi dal service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'copyToClipboardOffscreen') {
    copyToClipboard(message.text)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indica che la risposta sarà asincrona
  }
});

/**
 * Copia il testo negli appunti usando l'API document.execCommand
 * (più affidabile nel contesto offscreen)
 */
async function copyToClipboard(text) {
  try {
    // Prima prova con l'API moderna
    await navigator.clipboard.writeText(text);
    console.log('Passdoo Offscreen: Copied to clipboard using Clipboard API');
  } catch (error) {
    // Fallback con document.execCommand
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const success = document.execCommand('copy');
      if (!success) {
        throw new Error('execCommand copy failed');
      }
      console.log('Passdoo Offscreen: Copied to clipboard using execCommand');
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
