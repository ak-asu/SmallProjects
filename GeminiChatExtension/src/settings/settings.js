document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveKey');
  const clearButton = document.getElementById('clearKey');
  const statusDiv = document.getElementById('status');
  const togglePassword = document.querySelector('.toggle-password');

  // Load existing API key
  chrome.storage.local.get('apiKey', ({ apiKey }) => {
    if (apiKey) {
      apiKeyInput.value = apiKey;
    }
  });

  // Show status message
  function showStatus(message, isError = false) {
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = isError ? 'error' : 'check_circle';
    
    statusDiv.textContent = '';
    statusDiv.appendChild(icon);
    statusDiv.appendChild(document.createTextNode(message));
    
    statusDiv.className = `status ${isError ? 'error' : 'success'}`;
    statusDiv.style.display = 'flex';
    
    // Hide status after 3 seconds
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  // Validate API key format
  function validateApiKey(key) {
    // Basic validation for Gemini API key format
    return key && key.length > 0 && key.startsWith('AIza');
  }

  // Save API key
  saveButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!validateApiKey(apiKey)) {
      showStatus('Please enter a valid Gemini API key', true);
      return;
    }

    try {
      // Test the API key with a simple request
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
      
      if (!response.ok) {
        throw new Error('Invalid API key');
      }

      // Save the API key
      await chrome.storage.local.set({ apiKey });
      showStatus('API key saved successfully');
    } catch (error) {
      console.error('Error saving API key:', error);
      showStatus('Failed to save API key. Please check if it\'s valid.', true);
    }
  });

  // Clear API key
  clearButton.addEventListener('click', async () => {
    try {
      await chrome.storage.local.remove('apiKey');
      apiKeyInput.value = '';
      showStatus('API key cleared successfully');
    } catch (error) {
      console.error('Error clearing API key:', error);
      showStatus('Failed to clear API key', true);
    }
  });

  // Handle Enter key
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveButton.click();
    }
  });

  // Toggle password visibility
  togglePassword.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
    
    const icon = togglePassword.querySelector('.material-icons');
    icon.textContent = type === 'password' ? 'visibility_off' : 'visibility';
    
    togglePassword.setAttribute('title', `${type === 'password' ? 'Show' : 'Hide'} API key`);
  });
});
