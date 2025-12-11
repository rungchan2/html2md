// html2md Side Panel Script
// Displays conversion history

let currentHistory = [];

// Initialize i18n
function initializeI18n() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageKey = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(messageKey);
    if (message) {
      element.textContent = message;
    }
  });
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

// Format file size
function formatFileSize(markdown) {
  const bytes = new Blob([markdown]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Load and display history
async function loadHistory() {
  try {
    console.log('[html2md-sidepanel] Loading history...');
    const result = await chrome.storage.local.get(['conversionHistory']);
    currentHistory = result.conversionHistory || [];

    console.log('[html2md-sidepanel] Loaded', currentHistory.length, 'items');

    // Update item count
    const itemCount = document.getElementById('itemCount');
    const countMessage = chrome.i18n.getMessage('sidepanelItemCount', [currentHistory.length.toString()]);
    itemCount.textContent = countMessage || `${currentHistory.length} items`;

    const container = document.getElementById('historyContainer');
    const emptyState = document.getElementById('emptyState');

    if (currentHistory.length === 0) {
      emptyState.style.display = 'flex';
      // Remove all history items
      container.querySelectorAll('.history-card').forEach(card => card.remove());
      return;
    }

    emptyState.style.display = 'none';

    // Clear existing items
    container.querySelectorAll('.history-card').forEach(card => card.remove());

    // Create history cards
    currentHistory.forEach((item, index) => {
      const card = createHistoryCard(item, index);
      container.appendChild(card);
    });

    console.log('[html2md-sidepanel] History displayed');
  } catch (error) {
    console.error('[html2md-sidepanel] Error loading history:', error);
    showNotification(chrome.i18n.getMessage('sidepanelLoadError') || 'Failed to load history', true);
  }
}

// Create a history card element
function createHistoryCard(item, index) {
  const card = document.createElement('div');
  card.className = 'history-card';
  card.dataset.index = index;

  const header = document.createElement('div');
  header.className = 'card-header';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = item.title;
  title.title = item.title;

  const time = document.createElement('div');
  time.className = 'card-time';
  time.textContent = formatTimestamp(item.timestamp);

  header.appendChild(title);
  header.appendChild(time);

  const url = document.createElement('div');
  url.className = 'card-url';
  url.textContent = item.url;
  url.title = item.url;

  const preview = document.createElement('div');
  preview.className = 'card-preview';
  preview.textContent = item.preview;

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const size = document.createElement('span');
  size.className = 'card-size';
  size.textContent = formatFileSize(item.markdown);

  const lines = document.createElement('span');
  lines.className = 'card-lines';
  const lineCount = item.markdown.split('\n').length;
  lines.textContent = chrome.i18n.getMessage('sidepanelLines', [lineCount.toString()]) || `${lineCount} lines`;

  meta.appendChild(size);
  meta.appendChild(lines);

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-button primary';
  copyBtn.innerHTML = '📋 ' + (chrome.i18n.getMessage('sidepanelCopy') || 'Copy');
  copyBtn.onclick = (e) => {
    e.stopPropagation();
    copyToClipboard(item);
  };

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'action-button';
  downloadBtn.innerHTML = '💾 ' + (chrome.i18n.getMessage('sidepanelDownload') || 'Download');
  downloadBtn.onclick = (e) => {
    e.stopPropagation();
    downloadMarkdown(item);
  };

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-button danger';
  deleteBtn.innerHTML = '🗑️';
  deleteBtn.title = chrome.i18n.getMessage('sidepanelDelete') || 'Delete';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteItem(index);
  };

  actions.appendChild(copyBtn);
  actions.appendChild(downloadBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(header);
  card.appendChild(url);
  card.appendChild(preview);
  card.appendChild(meta);
  card.appendChild(actions);

  // Click on card to expand/show full preview
  card.addEventListener('click', () => {
    toggleCardExpanded(card);
  });

  return card;
}

// Toggle card expanded state
function toggleCardExpanded(card) {
  const isExpanded = card.classList.contains('expanded');

  // Close all other cards
  document.querySelectorAll('.history-card.expanded').forEach(c => {
    if (c !== card) {
      c.classList.remove('expanded');
    }
  });

  if (!isExpanded) {
    card.classList.add('expanded');
  } else {
    card.classList.remove('expanded');
  }
}

// Copy to clipboard
async function copyToClipboard(item) {
  try {
    await navigator.clipboard.writeText(item.markdown);
    showNotification(chrome.i18n.getMessage('sidepanelCopySuccess') || 'Copied to clipboard');
  } catch (error) {
    console.error('[html2md-sidepanel] Copy failed:', error);
    showNotification(chrome.i18n.getMessage('sidepanelCopyError') || 'Failed to copy', true);
  }
}

// Download markdown
function downloadMarkdown(item) {
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
        console.error('[html2md-sidepanel] Download error:', chrome.runtime.lastError);
        showNotification(chrome.i18n.getMessage('sidepanelDownloadError') || 'Download failed', true);
      } else {
        showNotification(chrome.i18n.getMessage('sidepanelDownloadSuccess') || 'Download started');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  } catch (error) {
    console.error('[html2md-sidepanel] Download failed:', error);
    showNotification(chrome.i18n.getMessage('sidepanelDownloadError') || 'Download failed', true);
  }
}

// Delete a single item
async function deleteItem(index) {
  try {
    const result = await chrome.storage.local.get(['conversionHistory']);
    let history = result.conversionHistory || [];

    history.splice(index, 1);

    await chrome.storage.local.set({ conversionHistory: history });
    await loadHistory();
    showNotification(chrome.i18n.getMessage('sidepanelDeleteSuccess') || 'Deleted');
  } catch (error) {
    console.error('[html2md-sidepanel] Delete failed:', error);
    showNotification(chrome.i18n.getMessage('sidepanelDeleteError') || 'Delete failed', true);
  }
}

// Clear all history
async function clearAllHistory() {
  const confirmMessage = chrome.i18n.getMessage('sidepanelConfirmClearAll') || 'Delete all conversion history?';
  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    await chrome.storage.local.set({ conversionHistory: [] });
    await loadHistory();
    showNotification(chrome.i18n.getMessage('sidepanelClearSuccess') || 'All history cleared');
  } catch (error) {
    console.error('[html2md-sidepanel] Clear all failed:', error);
    showNotification(chrome.i18n.getMessage('sidepanelClearError') || 'Failed to clear history', true);
  }
}

// Show notification
function showNotification(message, isError = false) {
  const notification = document.createElement('div');
  notification.className = `notification ${isError ? 'error' : 'success'}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.conversionHistory) {
    console.log('[html2md-sidepanel] Storage changed, reloading...');
    loadHistory();
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initializeI18n();
  await loadHistory();

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadHistory();
    showNotification(chrome.i18n.getMessage('sidepanelRefreshed') || 'Refreshed');
  });

  // Clear all button
  document.getElementById('clearAllBtn').addEventListener('click', clearAllHistory);
});

console.log('[html2md-sidepanel] Script loaded');
