document.addEventListener('DOMContentLoaded', () => {

    //UI elements
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const settingsButton = document.getElementById('settingsButton');
    const messagesContainer = document.getElementById('messages');
    let isProcessing = false;
  
    // Check for API key on load
    chrome.storage.local.get('apiKey', ({ apiKey }) => {
      if (!apiKey) {
        appendMessage('error', 'Please set your API key in the settings to start chatting.');
      }
    });
  
    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = messageInput.scrollHeight + 'px';
    });
  
    // Handle Enter key (Shift+Enter for new line)
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  
    // Load chat history
    chrome.storage.local.get('chatHistory', ({ chatHistory = [] }) => {
      if (chatHistory.length > 0) {
        chatHistory.forEach(msg => appendMessage(msg.role, msg.content));
        scrollToBottom();
      }
    });
  
    // Settings button handler
    settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  
    // Add clear chat button to the chat header
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-button';
    clearButton.title = 'Clear chat';
    clearButton.innerHTML = '<span class="material-icons">delete_sweep</span>';
    document.querySelector('.chat-header').appendChild(clearButton);
  
    clearButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear the chat history?')) {
        messagesContainer.innerHTML = '';
        chrome.runtime.sendMessage({ type: 'CLEAR_CHAT' });
      }
    });
  
    // Send message button handler
    sendButton.addEventListener('click', sendMessage);
  
    /**
     * Send message function
     * 1. Get the message from the input
     * 2. Check if the message is empty or if the message is already being processed
     * 3. Get the api key from the local storage
     * 4. If the api key is not set, send an error message to the side panel
     * 5. Set the processing flag to true
     * 6. Disable the send button and the message input
     * 7. Append the message to the chat history
     * 8. Clear the message input
     * 9. Show the typing indicator
     * 10. Send the message to the chat history
     * 11. Set the processing flag to false
     * 12. Enable the send button and the message input
     * 13. Focus on the message input
     */
    async function sendMessage() {

      // Get the message from the input
      const message = messageInput.value.trim();
      if (!message || isProcessing) return;
        
      // Check for API key before sending
      const { apiKey } = await chrome.storage.local.get('apiKey');
      if (!apiKey) {
        appendMessage('error', 'Please set your API key in the settings to start chatting.');
        return;
      }
  
      // Set the flags to true
      isProcessing = true;
      sendButton.disabled = true;
      messageInput.disabled = true;
  
      // Append the message to the chat history
      appendMessage('user', message);
      messageInput.value = '';
      messageInput.style.height = 'auto';

      // Show typing indicator
      showTypingIndicator();
  
      // Send the message to the chat history this will trigger the service worker to send the message to the api
      chrome.runtime.sendMessage({
        type: 'SEND_MESSAGE',
        message
      });
    }
  
    /**
     * Streaming response handler
     * 1. If the type is STREAM_UPDATE, hide the typing indicator and append the streaming message
     * 2. If the type is ERROR, hide the typing indicator and append the error message
     * 3. Set the processing flag to false
     * 4. Enable the send button and the message input
     * 5. Focus on the message input
     */
    chrome.runtime.onMessage.addListener(({ type, content, done }) => {
      if (type === 'STREAM_UPDATE') {
        hideTypingIndicator();
        appendStreamingMessage(content);
        if (done) {

            //if the streaming is done, set the flags to false
          isProcessing = false;
          sendButton.disabled = false;
          messageInput.disabled = false;
          messageInput.focus();
        }

      } else if (type === 'ERROR') {

        //if there is an error, set the flags to false
        hideTypingIndicator();
        appendMessage('error', content);
        isProcessing = false;
        sendButton.disabled = false;
        messageInput.disabled = false;
      }
    });
  });
  
  //UI elements functions to show and hide the typing indicator
  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;
    document.getElementById('messages').appendChild(indicator);
    scrollToBottom();
  }
  
  //function to hide the typing indicator
  function hideTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }
  
  //function to append the message to the chat history by role and content and timestamp by using DOM elements
  function appendMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Handle code blocks and links
    if (role === 'model') {
      contentDiv.innerHTML = formatMessageContent(content);
    } else {
      contentDiv.textContent = content;
    }
    
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timestamp);
    
    document.getElementById('messages').appendChild(messageDiv);
    scrollToBottom();
  }
  
  //function to append the streaming message to the chat history
  function appendStreamingMessage(content) {
    const lastMessage = document.getElementById('messages').lastChild;
    if (lastMessage?.classList.contains('model')) {
      const contentDiv = lastMessage.querySelector('.message-content');
      contentDiv.innerHTML = formatMessageContent(content);
    } else {
      appendMessage('model', content);
    }
    scrollToBottom();
  }
  
  //function to format the message content
  function formatMessageContent(content) {
    // Convert URLs to links
    content = content.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank">$1</a>'
    );
  
    // Convert code blocks
    content = content.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (match, lang, code) => {
        return `<pre><code class="${lang || ''}">${code.trim()}</code></pre>`;
      }
    );
  
    // Convert inline code
    content = content.replace(
      /`([^`]+)`/g,
      '<code>$1</code>'
    );
  
    return content;
  }
  
  //function to scroll to the bottom of the chat history
  function scrollToBottom() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }