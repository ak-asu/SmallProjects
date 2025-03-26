let activeChat = null;

// Configure side panel behavior
chrome.runtime.onInstalled.addListener(() => {
  // Set up the side panel to open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Error setting panel behavior:', error));
});

// Listen for messages from the side panel if the request is from the side panel and the type is SEND_MESSAGE
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SEND_MESSAGE') {
    handleChatMessage(request.message);
  } else if (request.type === 'CLEAR_CHAT') {
    clearChat();
  }
});

// Clear the chat history from the local storage
async function clearChat() {
  activeChat = null;
  await chrome.storage.local.remove('chatHistory');
}

//function to handle the chat message
/*
* 1. Get the api key from the local storage
* 2. Get the chat history from the local storage
* 3. If the api key is not set, send an error message to the side panel
* 4. If the api key is set, send the message to the chat history
* 5. Send the response back to the side panel
* 6. Update the chat history
* 7. Keep only the last 50 messages to prevent the context from getting too large
* 8. Send the response back to the side panel
*/

async function handleChatMessage(message) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  const { chatHistory = [] } = await chrome.storage.local.get('chatHistory');
  
  if (!apiKey) {
    chrome.runtime.sendMessage({
      type: 'ERROR',
      content: 'Please set your API key in the settings first.'
    });
    return;
  }

  // Send the message to the chat history and get the response from the api
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          ...chatHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })),
          { role: 'user', parts: [{ text: message }] }
        ]
      })
    });

    //Throw an error if the response is not ok
    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    //Get the data from the response
    const data = await response.json();
    
    //Throw an error if the response format is invalid
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response format');
    }

    //Get the generated text from the response
    const generatedText = data.candidates[0].content.parts[0].text;

    // Update chat history to keep the context of the conversation
    const updatedHistory = [
      ...chatHistory,
      { role: 'user', content: message },
      { role: 'model', content: generatedText }
    ];

    // Keep only the last 50 messages to prevent the context from getting too large
    const trimmedHistory = updatedHistory.slice(-50);
    await chrome.storage.local.set({ chatHistory: trimmedHistory });

    // Send the response back
    chrome.runtime.sendMessage({
      type: 'STREAM_UPDATE',
      content: generatedText,
      done: true
    });

  } catch (error) {
    console.error('Error in chat:', error);
    chrome.runtime.sendMessage({
      type: 'ERROR',
      content: 'An error occurred while processing your message.'
    });
  }
}
