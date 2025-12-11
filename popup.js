// html2md Popup Script
// Handles popup UI interactions

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize i18n
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageKey = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(messageKey);
    if (message) {
      element.textContent = message;
    }
  });

  const toggleButton = document.getElementById('toggleButton');
  const viewHistoryButton = document.getElementById('viewHistoryButton');
  const shortcutLink = document.querySelector('.shortcut-link');

  // Handle shortcut settings link
  if (shortcutLink) {
    shortcutLink.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }

  // Send message with retry logic
  async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
        return response;
      } catch (error) {
        console.log(`Attempt ${i + 1} failed:`, error.message);
        if (i < maxRetries - 1) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          throw error;
        }
      }
    }
  }

  // Open side panel
  async function openSidePanel() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        window.close(); // Close popup after opening side panel
      }
    } catch (error) {
      console.error('[html2md] Failed to open side panel:', error);
    }
  }

  // Handle toggle button click
  toggleButton.addEventListener('click', async () => {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        console.error('No active tab found');
        return;
      }

      // Check if we can inject scripts (not on chrome:// pages)
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        alert(chrome.i18n.getMessage('popupChromePageError'));
        return;
      }

      console.log('Injecting scripts into tab:', tab.id);

      // Try to inject content script if not already injected
      let scriptsInjected = false;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['lib/turndown.js', 'lib/turndown-plugin-gfm.js', 'content.js']
        });

        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });

        scriptsInjected = true;
        console.log('Scripts injected successfully');

        // Wait longer for scripts to initialize after first injection
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        // Scripts might already be injected, which is fine
        console.log('Script injection skipped (might already be injected):', e.message);
      }

      // Send message to content script with retry
      try {
        console.log('Sending message to content script...');
        await sendMessageWithRetry(tab.id, { action: 'toggleSelectionMode' });
        console.log('Message sent successfully');

        // Close popup after activating
        window.close();
      } catch (error) {
        console.error('Failed to communicate with content script:', error.message);
        alert(chrome.i18n.getMessage('popupScriptLoadError'));
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      alert(chrome.i18n.getMessage('popupUnexpectedError') + error.message);
    }
  });

  // View history button
  viewHistoryButton.addEventListener('click', openSidePanel);
});
