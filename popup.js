// html2md Popup Script
// Handles popup UI interactions

document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggleButton');

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
        alert('이 페이지에서는 확장 프로그램을 사용할 수 없습니다.\n일반 웹페이지에서 시도해주세요.');
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
        alert('스크립트를 로드하는데 실패했습니다.\n페이지를 새로고침한 후 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('오류가 발생했습니다.\n' + error.message);
    }
  });
});
