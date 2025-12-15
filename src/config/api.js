// src/config/api.js

// Automatically detect environment and use correct URL
const getApiUrl = () => {
  // Production: use deployed backend
  if (import.meta.env.PROD) {
    return 'https://abeledoclinic.onrender.com';
  }
  // Development: use Vite proxy (empty string = relative path)
  return '';
};

export const API_BASE_URL = getApiUrl();

// Helper function for sending SMS
export const sendSMS = async (number, message) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, message }),
    });

    // Get response text first to handle both JSON and non-JSON responses
    const responseText = await response.text();

    if (!response.ok) {
      // Try to parse error as JSON
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If not JSON, use the text as error message
        errorMessage = responseText || errorMessage;
      }
      
      console.error('SMS API Error:', response.status, responseText);
      throw new Error(errorMessage);
    }

    // Try to parse success response as JSON
    try {
      const data = responseText ? JSON.parse(responseText) : { success: true };
      console.log('SMS sent successfully:', data);
      return data;
    } catch (parseError) {
      console.warn('Response is not JSON:', responseText);
      // If response is not JSON but status is OK, consider it success
      return { success: true, message: 'SMS sent' };
    }
  } catch (error) {
    console.error('SMS sending failed:', error);
    throw error;
  }
};