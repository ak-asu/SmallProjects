// GeminiMultiModalService.js
import axios from "axios";

const API_KEY = "<Your-API-Key>";
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

const chatWithGeminiMultiModal = async (
  prompt,
  message,
  encodedImage = null
) => {
  try {
    const parts = [{ text: `${prompt}\n\n${message}` }];

    if (encodedImage) {
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: encodedImage,
         },
      });
    }

    const requestPayload = {
      contents: [{ parts }],
      generationConfig: {
        response_mime_type: "application/json",
      },
    };

    const response = await axios.post(
      `${API_URL}?key=${API_KEY}`,
      requestPayload,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 60000,
      }
    );

    const candidates = response.data?.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      const jsonPart = candidates[0].content.parts.find((part) => part.text);
    console.log(jsonPart)
      return JSON.parse(jsonPart?.text || "{}");
    }

    return { error: "No response from the API." };
  } catch (error) {
    console.error(
      "Error communicating with the Gemini API:",
      error?.response?.data || error.message
    );
    throw new Error("An error occurred while processing your request.");
  }
};

export { chatWithGeminiMultiModal };
