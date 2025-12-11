// html2md Content Script
// Handles selection mode, element highlighting, and markdown conversion

(function() {
  'use strict';

  // Prevent duplicate injection
  if (window.html2mdInjected) {
    console.log('html2md already injected, skipping...');
    return;
  }
  window.html2mdInjected = true;

  // State management
  let isSelectionMode = false;
  let hoveredElement = null;
  let selectedElements = [];
  let toolbar = null;
  let popup = null;
  let popupAnchorElement = null; // Track which element popup is anchored to
  let turndownService = null;

  // Initialize Turndown service
  function initTurndown() {
    console.log('[html2md] Initializing Turndown service...');
    console.log('[html2md] TurndownService available:', typeof TurndownService !== 'undefined');
    console.log('[html2md] turndownPluginGfm available:', typeof turndownPluginGfm !== 'undefined');

    if (typeof TurndownService === 'undefined') {
      console.error('[html2md] TurndownService is not loaded!');
      console.error('[html2md] Check if lib/turndown.js is loaded correctly');
      return;
    }

    try {
      turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full'
      });

      console.log('[html2md] TurndownService instance created');

      // Add GFM plugin if available
      if (typeof turndownPluginGfm !== 'undefined') {
        turndownService.use(turndownPluginGfm.gfm);
        console.log('[html2md] GFM plugin loaded - tables will be converted');
      } else {
        console.warn('[html2md] GFM plugin not available - tables may not convert properly');
      }
    } catch (error) {
      console.error('[html2md] Error creating TurndownService:', error);
      return;
    }

    // Use remove() method for cleaner code (Turndown best practice)
    turndownService.remove(['script', 'style', 'noscript']);
    console.log('[html2md] Removed script/style tags');

    // Remove data:image base64 images using remove() with function filter
    turndownService.remove(function(node) {
      return node.nodeName === 'IMG' &&
             node.getAttribute('src') &&
             node.getAttribute('src').startsWith('data:image');
    });
    console.log('[html2md] Removed base64 images');

    // Remove empty links
    turndownService.remove(function(node) {
      return node.nodeName === 'A' &&
             (!node.textContent.trim() || node.textContent.trim() === '#');
    });
    console.log('[html2md] Removed empty links');

    // Custom rule for code blocks with language detection
    // This overrides the default <pre><code> handling
    turndownService.addRule('codeBlock', {
      filter: function(node) {
        return node.nodeName === 'PRE' && node.querySelector('code');
      },
      replacement: function(content, node) {
        const code = node.querySelector('code');
        const language = detectLanguage(code || node);
        const codeContent = code ? code.textContent : node.textContent;
        return '\n\n```' + language + '\n' + codeContent + '\n```\n\n';
      }
    });
    console.log('[html2md] Added code block language detection rule');

    console.log('[html2md] Turndown service initialized with custom rules');
  }

  // Detect programming language from code element
  function detectLanguage(element) {
    // Check class names
    const className = element.className || '';
    const classMatch = className.match(/(?:language-|lang-)(\w+)/);
    if (classMatch) return classMatch[1];

    // Check data attributes
    const dataLang = element.dataset.lang || element.dataset.language;
    if (dataLang) return dataLang;

    // Check parent element
    const parent = element.parentElement;
    if (parent) {
      const parentClass = parent.className || '';
      const parentMatch = parentClass.match(/(?:language-|lang-)(\w+)/);
      if (parentMatch) return parentMatch[1];
    }

    return '';
  }

  // Toggle selection mode
  function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;

    if (isSelectionMode) {
      activateSelectionMode();
    } else {
      deactivateSelectionMode();
    }
  }

  // Activate selection mode
  function activateSelectionMode() {
    document.body.classList.add('html2md-active');
    showToolbar();
    addEventListeners();
  }

  // Deactivate selection mode
  function deactivateSelectionMode() {
    document.body.classList.remove('html2md-active');
    removeHoverEffect();
    hideToolbar();
    hidePopup();
    removeEventListeners();
    clearSelections();
  }

  // Show top toolbar
  function showToolbar() {
    if (toolbar) return;

    toolbar = document.createElement('div');
    toolbar.className = 'html2md-toolbar';
    toolbar.innerHTML = `
      <p class="html2md-toolbar-text">
        ${chrome.i18n.getMessage('toolbarInstruction')}
      </p>
    `;
    document.body.appendChild(toolbar);
  }

  // Hide toolbar
  function hideToolbar() {
    if (toolbar) {
      toolbar.remove();
      toolbar = null;
    }
  }

  // Show action popup
  function showPopup(element) {
    console.log('[html2md] showPopup() called for element:', element);
    hidePopup();

    popupAnchorElement = element;
    popup = document.createElement('div');
    popup.className = 'html2md-popup';

    // Position popup near the selected element
    updatePopupPosition();

    const copyButton = document.createElement('button');
    copyButton.className = 'html2md-popup-button';
    copyButton.innerHTML = '📋 복사';
    copyButton.type = 'button'; // Ensure it's a button type

    // Use addEventListener instead of onclick for better event handling
    copyButton.addEventListener('click', (e) => {
      console.log('[html2md] Copy button click event triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // Prevent other handlers
      handleCopy();
    }, true); // Use capture phase

    const downloadButton = document.createElement('button');
    downloadButton.className = 'html2md-popup-button';
    downloadButton.innerHTML = '💾 다운로드';
    downloadButton.type = 'button'; // Ensure it's a button type

    // Use addEventListener instead of onclick for better event handling
    downloadButton.addEventListener('click', (e) => {
      console.log('[html2md] Download button click event triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // Prevent other handlers
      handleDownload();
    }, true); // Use capture phase

    popup.appendChild(copyButton);
    popup.appendChild(downloadButton);
    document.body.appendChild(popup);

    console.log('[html2md] Popup added to DOM with addEventListener, buttons:', { copyButton, downloadButton });
  }

  // Update popup position (called on scroll/resize)
  function updatePopupPosition() {
    if (!popup || !popupAnchorElement) return;

    const rect = popupAnchorElement.getBoundingClientRect();
    popup.style.left = (rect.left + window.scrollX) + 'px';
    popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  }

  // Hide popup
  function hidePopup() {
    if (popup) {
      popup.remove();
      popup = null;
      popupAnchorElement = null;
    }
  }

  // Show toast notification
  function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'html2md-toast' + (isError ? ' error' : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2000);
  }

  // Handle mouse move - highlight element on hover
  function handleMouseMove(e) {
    if (!isSelectionMode) return;

    const element = e.target;
    if (element === hoveredElement ||
        element.classList.contains('html2md-toolbar') ||
        element.closest('.html2md-toolbar') ||
        element.classList.contains('html2md-popup') ||
        element.closest('.html2md-popup')) {
      return;
    }

    removeHoverEffect();
    hoveredElement = element;
    hoveredElement.classList.add('html2md-hover');
  }

  // Remove hover effect
  function removeHoverEffect() {
    if (hoveredElement) {
      hoveredElement.classList.remove('html2md-hover');
      hoveredElement = null;
    }
  }

  // Handle click - select element
  function handleClick(e) {
    if (!isSelectionMode) return;

    const element = e.target;

    console.log('[html2md] Click detected on:', element.tagName, element.className);

    // Ignore clicks on toolbar and popup - but DON'T prevent default for popup buttons
    if (element.classList.contains('html2md-toolbar') ||
        element.closest('.html2md-toolbar') ||
        element.classList.contains('html2md-popup') ||
        element.classList.contains('html2md-popup-button') ||
        element.closest('.html2md-popup')) {
      console.log('[html2md] Click ignored (toolbar or popup)');
      // Don't preventDefault or stopPropagation for popup buttons
      if (!element.classList.contains('html2md-popup-button')) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // Now prevent default for actual page element clicks
    e.preventDefault();
    e.stopPropagation();

    // Multi-select with Shift key
    if (e.shiftKey) {
      console.log('[html2md] Shift+Click: toggling element selection');
      toggleElementSelection(element);
    } else {
      // Single select - clear previous selections
      console.log('[html2md] Normal click: clearing previous selections and selecting new element');
      clearSelections();
      selectElement(element);
    }

    console.log('[html2md] Total selected elements:', selectedElements.length);

    // Show popup if there are selections
    if (selectedElements.length > 0) {
      // Show popup next to the last selected element
      console.log('[html2md] Showing popup near last selected element');
      showPopup(selectedElements[selectedElements.length - 1]);
    } else {
      console.log('[html2md] No selections, hiding popup');
      hidePopup();
    }
  }

  // Toggle element selection
  function toggleElementSelection(element) {
    const index = selectedElements.indexOf(element);
    if (index > -1) {
      // Deselect
      selectedElements.splice(index, 1);
      element.classList.remove('html2md-selected');
    } else {
      // Select
      selectElement(element);
    }
  }

  // Select element
  function selectElement(element) {
    if (!selectedElements.includes(element)) {
      selectedElements.push(element);
      element.classList.add('html2md-selected');
    }
  }

  // Clear all selections
  function clearSelections() {
    selectedElements.forEach(el => {
      el.classList.remove('html2md-selected');
    });
    selectedElements = [];
  }

  // Handle keyboard events
  function handleKeyDown(e) {
    if (!isSelectionMode) return;

    // ESC to cancel
    if (e.key === 'Escape') {
      deactivateSelectionMode();
      return;
    }

    // Shift + Arrow Up/Down for range adjustment
    if (e.shiftKey && hoveredElement) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const parent = hoveredElement.parentElement;
        if (parent && parent !== document.body) {
          removeHoverEffect();
          hoveredElement = parent;
          hoveredElement.classList.add('html2md-hover');
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const firstChild = hoveredElement.firstElementChild;
        if (firstChild) {
          removeHoverEffect();
          hoveredElement = firstChild;
          hoveredElement.classList.add('html2md-hover');
        }
      }
    }
  }

  // Preprocess HTML before conversion
  function preprocessHTML(element) {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);

    // Remove script tags
    const scripts = clone.querySelectorAll('script, style, noscript');
    scripts.forEach(script => script.remove());

    // Remove data:image base64 images
    const images = clone.querySelectorAll('img[src^="data:image"]');
    images.forEach(img => img.remove());

    // Remove empty links and anchors
    const emptyLinks = clone.querySelectorAll('a:empty, a[href="#"]');
    emptyLinks.forEach(link => {
      if (!link.textContent.trim() || link.textContent.trim() === '#') {
        link.remove();
      }
    });

    // Remove inline event handlers
    const elementsWithEvents = clone.querySelectorAll('[onclick], [onload], [onerror]');
    elementsWithEvents.forEach(el => {
      el.removeAttribute('onclick');
      el.removeAttribute('onload');
      el.removeAttribute('onerror');
    });

    // Fix table headers: replace <br> with spaces in TH elements
    const tableHeaders = clone.querySelectorAll('th');
    tableHeaders.forEach(th => {
      // Replace <br> tags with spaces
      const brs = th.querySelectorAll('br');
      brs.forEach(br => {
        const space = document.createTextNode(' ');
        br.parentNode.replaceChild(space, br);
      });

      // Replace multiple consecutive whitespaces with single space
      th.innerHTML = th.innerHTML.replace(/\s+/g, ' ').trim();
    });

    // Clean up excessive whitespace
    const textNodes = [];
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    textNodes.forEach(textNode => {
      textNode.textContent = textNode.textContent.replace(/\s+/g, ' ');
    });

    console.log('[html2md] HTML preprocessed');
    return clone;
  }

  // Convert selected elements to markdown
  function convertToMarkdown() {
    console.log('[html2md] convertToMarkdown() called');
    console.log('[html2md] selectedElements count:', selectedElements.length);

    if (selectedElements.length === 0) {
      console.error('[html2md] No elements selected!');
      return null;
    }

    if (!turndownService) {
      console.log('[html2md] Turndown service not initialized, initializing...');
      initTurndown();
    }

    if (!turndownService) {
      console.error('[html2md] Failed to initialize turndown service');
      showToast(chrome.i18n.getMessage('toastLibraryLoadFailed'), true);
      return null;
    }

    console.log('[html2md] Turndown service ready');

    let markdown = '';

    selectedElements.forEach((element, index) => {
      console.log(`[html2md] Converting element ${index + 1}/${selectedElements.length}`);
      console.log(`[html2md] Element tag: ${element.tagName}, classes: ${element.className}`);

      // Preprocess HTML to clean it up
      const cleanedElement = preprocessHTML(element);
      const html = cleanedElement.outerHTML;
      console.log(`[html2md] Cleaned HTML length: ${html.length} characters`);

      try {
        console.log(`[html2md] Calling turndownService.turndown()...`);
        const converted = turndownService.turndown(html);
        console.log(`[html2md] Converted markdown length: ${converted.length} characters`);

        if (!converted || converted.trim() === '' || converted === 'null') {
          console.warn(`[html2md] Warning: Element ${index + 1} converted to empty or null`);
          console.warn(`[html2md] HTML preview:`, html.substring(0, 500));
        }

        // Clean up excessive newlines in the result
        const cleanedMarkdown = converted.replace(/\n{3,}/g, '\n\n');
        markdown += cleanedMarkdown;

        // Add spacing between multiple selections
        if (index < selectedElements.length - 1) {
          markdown += '\n\n---\n\n';
        }
      } catch (error) {
        console.error(`[html2md] Error converting element ${index + 1}:`, error);
        console.error(`[html2md] Error stack:`, error.stack);
        console.error(`[html2md] Failed HTML preview:`, html.substring(0, 500));
      }
    });

    // Final cleanup
    markdown = markdown.trim();

    console.log(`[html2md] Total markdown length: ${markdown.length} characters`);
    console.log('[html2md] Markdown preview (first 200 chars):', markdown.substring(0, 200));

    return markdown;
  }

  // Handle copy to clipboard
  async function handleCopy() {
    console.log('[html2md] ========== COPY BUTTON CLICKED ==========');
    console.log('[html2md] selectedElements:', selectedElements);

    const markdown = convertToMarkdown();

    if (!markdown) {
      console.error('[html2md] No markdown returned from convertToMarkdown()');
      showToast(chrome.i18n.getMessage('toastNoContent'), true);
      return;
    }

    if (markdown.trim().length === 0) {
      console.error('[html2md] Markdown is empty after trim');
      showToast(chrome.i18n.getMessage('toastEmptyContent'), true);
      return;
    }

    console.log('[html2md] Markdown ready for copy, length:', markdown.length);

    // Use the Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      console.log('[html2md] Using Clipboard API...');
      try {
        await navigator.clipboard.writeText(markdown);
        console.log('[html2md] ✅ Copy successful via Clipboard API');

        // Save to history after successful copy
        await saveToHistory(markdown, document.title, window.location.href);

        showToast(chrome.i18n.getMessage('toastCopied'));
        deactivateSelectionMode();
      } catch (err) {
        console.error('[html2md] ❌ Clipboard API failed:', err);
        console.error('[html2md] Error name:', err.name);
        console.error('[html2md] Error message:', err.message);
        showToast(chrome.i18n.getMessage('toastCopyFailed') + err.message, true);
      }
    } else {
      // Fallback for older browsers
      console.log('[html2md] Using fallback copy method...');
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        const success = document.execCommand('copy');
        console.log('[html2md] execCommand result:', success);
        if (success) {
          console.log('[html2md] ✅ Copy successful (fallback)');

          // Save to history after successful copy
          await saveToHistory(markdown, document.title, window.location.href);

          showToast(chrome.i18n.getMessage('toastCopied'));
          deactivateSelectionMode();
        } else {
          console.error('[html2md] ❌ execCommand returned false');
          showToast(chrome.i18n.getMessage('toastCopyFailed'), true);
        }
      } catch (err) {
        console.error('[html2md] ❌ Fallback copy failed:', err);
        showToast(chrome.i18n.getMessage('toastCopyFailed'), true);
      }

      document.body.removeChild(textarea);
    }
  }

  // Handle download as file using chrome.downloads API
  function handleDownload() {
    console.log('[html2md] ========== DOWNLOAD BUTTON CLICKED ==========');
    console.log('[html2md] selectedElements:', selectedElements);

    const markdown = convertToMarkdown();

    if (!markdown) {
      console.error('[html2md] No markdown returned from convertToMarkdown()');
      showToast(chrome.i18n.getMessage('toastNoContent'), true);
      return;
    }

    if (markdown.trim().length === 0) {
      console.error('[html2md] Markdown is empty after trim');
      showToast(chrome.i18n.getMessage('toastEmptyContent'), true);
      return;
    }

    console.log('[html2md] Markdown ready for download, length:', markdown.length);

    try {
      // Generate filename
      const title = document.title.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 50) || 'download';
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `${title}_${date}.md`;

      console.log('[html2md] Filename:', filename);

      // Create blob
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      console.log('[html2md] Blob created, size:', blob.size, 'bytes');

      // Use chrome.downloads API (more reliable in extensions)
      const url = URL.createObjectURL(blob);
      console.log('[html2md] Object URL created:', url);

      chrome.runtime.sendMessage({
        action: 'download',
        url: url,
        filename: filename
      }, async (response) => {
        console.log('[html2md] Download response:', response);

        if (chrome.runtime.lastError) {
          console.error('[html2md] ❌ Chrome runtime error:', chrome.runtime.lastError);
          showToast(chrome.i18n.getMessage('toastDownloadFailed'), true);
        } else if (response && response.success) {
          console.log('[html2md] ✅ Download initiated successfully');

          // Save to history after successful download
          await saveToHistory(markdown, document.title, window.location.href);

          showToast(chrome.i18n.getMessage('toastDownloadComplete'));
          deactivateSelectionMode();
        } else {
          console.error('[html2md] ❌ Download failed:', response?.error);
          showToast(chrome.i18n.getMessage('toastDownloadFailed') + (response?.error || 'Unknown error'), true);
        }

        // Clean up the object URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
          console.log('[html2md] Object URL revoked');
        }, 1000);
      });

    } catch (err) {
      console.error('[html2md] ❌ Download failed:', err);
      console.error('[html2md] Error name:', err.name);
      console.error('[html2md] Error message:', err.message);
      console.error('[html2md] Error stack:', err.stack);
      showToast(chrome.i18n.getMessage('toastDownloadFailed') + err.message, true);
    }
  }

  // Add event listeners
  function addEventListeners() {
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', updatePopupPosition, true);
    window.addEventListener('resize', updatePopupPosition, true);
  }

  // Remove event listeners
  function removeEventListeners() {
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('scroll', updatePopupPosition, true);
    window.removeEventListener('resize', updatePopupPosition, true);
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleSelectionMode') {
      toggleSelectionMode();
      sendResponse({ success: true });
    }
  });

  // Listen for keyboard shortcut
  document.addEventListener('keydown', (e) => {
    // Cmd+Shift+X (Mac) or Ctrl+Shift+X (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
      e.preventDefault();
      console.log('[html2md] Keyboard shortcut triggered');
      toggleSelectionMode();
    }
  });

  // Storage utility functions for history management
  const MAX_HISTORY_ITEMS = 10;

  async function saveToHistory(markdown, pageTitle, pageUrl) {
    try {
      console.log('[html2md] Saving to history...');

      // Get current history
      const result = await chrome.storage.local.get(['conversionHistory']);
      let history = result.conversionHistory || [];

      // Create new history item
      const historyItem = {
        id: Date.now(),
        markdown: markdown,
        title: pageTitle,
        url: pageUrl,
        timestamp: new Date().toISOString(),
        preview: markdown.substring(0, 100) + (markdown.length > 100 ? '...' : '')
      };

      // Add to beginning of array
      history.unshift(historyItem);

      // Keep only the latest 10 items
      if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
        console.log('[html2md] Auto-cleanup: removed old history items');
      }

      // Save back to storage
      await chrome.storage.local.set({ conversionHistory: history });
      console.log('[html2md] ✅ Saved to history, total items:', history.length);

    } catch (error) {
      console.error('[html2md] ❌ Error saving to history:', error);
    }
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTurndown);
  } else {
    initTurndown();
  }

  console.log('html2md content script loaded');
})();
