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
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

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

  // Format timestamp to relative time
  function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return chrome.i18n.getMessage('timeJustNow');
    if (diffMins < 60) return chrome.i18n.getMessage('timeMinutesAgo', [diffMins.toString()]);
    if (diffHours < 24) return chrome.i18n.getMessage('timeHoursAgo', [diffHours.toString()]);
    if (diffDays < 7) return chrome.i18n.getMessage('timeDaysAgo', [diffDays.toString()]);
    return date.toLocaleDateString();
  }

  // Load and display history
  async function loadHistory() {
    try {
      const result = await chrome.storage.local.get(['conversionHistory']);
      const history = result.conversionHistory || [];

      console.log('[html2md] Loaded history:', history.length, 'items');

      if (history.length === 0) {
        historyList.innerHTML = `<div class="history-empty">${chrome.i18n.getMessage('popupHistoryEmpty')}</div>`;
        clearHistoryBtn.style.display = 'none';
        return;
      }

      clearHistoryBtn.style.display = 'block';
      historyList.innerHTML = '';

      history.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'history-item';

        itemDiv.innerHTML = `
          <div class="history-header">
            <div class="history-title" title="${item.title}">${item.title}</div>
            <div class="history-time">${formatTimestamp(item.timestamp)}</div>
          </div>
          <div class="history-url" title="${item.url}">${item.url}</div>
          <div class="history-preview" title="${item.preview}">${item.preview}</div>
          <div class="history-actions">
            <button class="history-action-btn copy-btn" data-index="${index}">📋 ${chrome.i18n.getMessage('popupHistoryCopy')}</button>
            <button class="history-action-btn download-btn" data-index="${index}">💾 ${chrome.i18n.getMessage('popupHistoryDownload')}</button>
            <button class="history-action-btn delete" data-index="${index}">🗑️</button>
          </div>
        `;

        historyList.appendChild(itemDiv);
      });

      // Add event listeners to buttons
      document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          await copyHistoryItem(history[index]);
        });
      });

      document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          await downloadHistoryItem(history[index]);
        });
      });

      document.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          await deleteHistoryItem(index);
        });
      });

    } catch (error) {
      console.error('[html2md] Error loading history:', error);
      historyList.innerHTML = `<div class="history-empty">${chrome.i18n.getMessage('popupHistoryLoadError')}</div>`;
    }
  }

  // Copy history item to clipboard
  async function copyHistoryItem(item) {
    try {
      await navigator.clipboard.writeText(item.markdown);
      showNotification(chrome.i18n.getMessage('notificationCopied'));
    } catch (error) {
      console.error('[html2md] Copy failed:', error);
      showNotification(chrome.i18n.getMessage('notificationCopyFailed'), true);
    }
  }

  // Download history item
  async function downloadHistoryItem(item) {
    try {
      const title = item.title.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 50) || 'download';
      const date = new Date(item.timestamp).toISOString().split('T')[0].replace(/-/g, '');
      const filename = `${title}_${date}.md`;

      const blob = new Blob([item.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('[html2md] Download error:', chrome.runtime.lastError);
          showNotification(chrome.i18n.getMessage('notificationDownloadFailed'), true);
        } else {
          showNotification(chrome.i18n.getMessage('notificationDownloadStarted'));
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      });
    } catch (error) {
      console.error('[html2md] Download failed:', error);
      showNotification(chrome.i18n.getMessage('notificationDownloadFailed'), true);
    }
  }

  // Delete single history item
  async function deleteHistoryItem(index) {
    try {
      const result = await chrome.storage.local.get(['conversionHistory']);
      let history = result.conversionHistory || [];

      history.splice(index, 1);

      await chrome.storage.local.set({ conversionHistory: history });
      await loadHistory();
      showNotification(chrome.i18n.getMessage('notificationDeleted'));
    } catch (error) {
      console.error('[html2md] Delete failed:', error);
      showNotification(chrome.i18n.getMessage('notificationDeleteFailed'), true);
    }
  }

  // Clear all history
  async function clearAllHistory() {
    if (!confirm(chrome.i18n.getMessage('confirmClearAll'))) {
      return;
    }

    try {
      await chrome.storage.local.set({ conversionHistory: [] });
      await loadHistory();
      showNotification(chrome.i18n.getMessage('notificationAllCleared'));
    } catch (error) {
      console.error('[html2md] Clear history failed:', error);
      showNotification(chrome.i18n.getMessage('notificationClearFailed'), true);
    }
  }

  // Show notification
  function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: ${isError ? '#fee' : '#eff6ff'};
      border: 1px solid ${isError ? '#fcc' : '#3b82f6'};
      color: ${isError ? '#c33' : '#1e40af'};
      border-radius: 6px;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 2000);
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

  // Clear history button
  clearHistoryBtn.addEventListener('click', clearAllHistory);

  // Load history on popup open
  await loadHistory();
});
