// html2md Background Service Worker
// Handles extension icon clicks and keyboard shortcuts

// Inject content scripts into a tab
async function injectScripts(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['lib/turndown.js', 'lib/turndown-plugin-gfm.js', 'content.js']
    });

    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['content.css']
    });

    // Wait a bit for scripts to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  } catch (error) {
    console.log('Script injection failed (might already be injected):', error);
    return false;
  }
}

// Toggle selection mode on a tab
async function toggleSelectionMode(tab) {
  if (!tab || !tab.id) {
    console.error('Invalid tab');
    return;
  }

  // Check if we can inject scripts (not on chrome:// pages)
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.log('Cannot inject on chrome:// or extension pages');
    return;
  }

  // Try to inject scripts first
  await injectScripts(tab.id);

  // Send message to content script
  chrome.tabs.sendMessage(tab.id, { action: 'toggleSelectionMode' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error communicating with content script:', chrome.runtime.lastError);
    }
  });
}

// Handle extension icon click
// Note: This won't be called if default_popup is set in manifest
// The popup handles the interaction instead
chrome.action.onClicked.addListener(async (tab) => {
  await toggleSelectionMode(tab);
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-selection-mode') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await toggleSelectionMode(tab);
    }
  }
});

// Log when extension is installed and check shortcuts
chrome.runtime.onInstalled.addListener((details) => {
  console.log('html2md extension installed');

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    checkCommandShortcuts();
  }
});

// Check if commands are properly registered
function checkCommandShortcuts() {
  chrome.commands.getAll((commands) => {
    console.log('[html2md] Registered commands:', commands);

    let missingShortcuts = [];

    for (let { name, shortcut } of commands) {
      console.log(`[html2md] Command "${name}": ${shortcut || 'NOT ASSIGNED'}`);
      if (shortcut === '') {
        missingShortcuts.push(name);
      }
    }

    if (missingShortcuts.length > 0) {
      console.warn('[html2md] Some commands have no shortcuts assigned:', missingShortcuts);
      console.log('[html2md] User can assign shortcuts at chrome://extensions/shortcuts');
    }
  });
}

// Handle download requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download') {
    console.log('[html2md] Download request received:', message.filename);

    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: false // Auto-save to default downloads folder
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[html2md] Download error:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('[html2md] Download started with ID:', downloadId);
        sendResponse({ success: true, downloadId: downloadId });
      }
    });

    // Return true to indicate async response
    return true;
  }
});
