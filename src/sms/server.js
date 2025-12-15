// server.js
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

// FIXED: Proper CORS configuration for localhost:5173
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'https://abeledclinic.onrender.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Handle preflight requests explicitly
app.options('*', cors());

const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY;
const SENDER_NAME = process.env.SENDER_NAME || 'Dentavis';
const FALLBACK_SENDER = process.env.FALLBACK_SENDER || null; 
const SEMAPHORE_API_URL = 'https://api.semaphore.co/api/v4/messages';

const normalizeStatus = (status) => {
  if (!status) return 'Unknown';
  const s = String(status).toLowerCase();
  if (s.includes('pending')) return 'Pending';
  if (s.includes('queued')) return 'Queued';
  if (s.includes('failed')) return 'Failed';
  if (s.includes('rejected')) return 'Rejected';
  return status;
};

const isValidPHMobile = (number) => /^(\+?63|0)9\d{9}$/.test(String(number).trim());

const detectSenderError = (apiData) => {
  const text = JSON.stringify(apiData || '').toLowerCase();
  return /sender|sendername|from|sender_id|senderid|sender name|not allowed|not approved|not registered/.test(text);
};

app.post('/api/send-sms', async (req, res) => {
  let { number, message } = req.body;

  console.log('📨 SMS Request received:', { number, messageLength: message?.length });

  if (!number || !message) {
    return res.status(400).json({ success: false, error: 'Missing number or message' });
  }
  if (!isValidPHMobile(number)) {
    return res.status(400).json({ success: false, error: 'Invalid PH phone format (use 09XXXXXXXXX or +639XXXXXXXXX)' });
  }
  if (!SEMAPHORE_API_KEY) {
    return res.status(500).json({ success: false, error: 'Server misconfiguration: API key missing' });
  }

  // Normalize local 09... format to +63... for gateway
  const normalizedNumber = String(number).trim().replace(/\s+/g, '').replace(/^09/, '+639');

  const sendToGateway = async (sendername) => {
    return axios.post(
      SEMAPHORE_API_URL,
      { apikey: SEMAPHORE_API_KEY, number: normalizedNumber, message, sendername },
      { timeout: 10000 }
    );
  };

  try {
    const response = await sendToGateway(SENDER_NAME);
    const payload = Array.isArray(response.data) ? response.data[0] : response.data;
    const status = normalizeStatus(payload?.status);
    const messageId = payload?.message_id || payload?.id;

    console.log('✅ SMS sent successfully:', { status, messageId });

    if (status === 'Pending' || status === 'Queued') {
      return res.json({
        success: true,
        status,
        message: `SMS ${status.toLowerCase()} successfully`,
        gateway: { id: messageId, status, raw: response.data }
      });
    }

    return res.status(502).json({
      success: false,
      status,
      error: `Gateway returned status: ${status}`,
      gateway: { id: messageId, status, raw: response.data }
    });

  } catch (error) {
    console.error('❌ SMS Error:', error.message);
    
    const statusCode = error.response?.status || 500;
    const apiData = error.response?.data;
    const apiMsg = apiData?.message || apiData?.error || null;

    if (detectSenderError(apiData)) {
      if (FALLBACK_SENDER && FALLBACK_SENDER !== SENDER_NAME) {
        try {
          console.log('🔄 Trying fallback sender:', FALLBACK_SENDER);
          const fallbackResp = await sendToGateway(FALLBACK_SENDER);
          const fallbackPayload = Array.isArray(fallbackResp.data) ? fallbackResp.data[0] : fallbackResp.data;
          const fallbackStatus = normalizeStatus(fallbackPayload?.status);
          const fallbackMessageId = fallbackPayload?.message_id || fallbackPayload?.id;

          if (fallbackStatus === 'Pending' || fallbackStatus === 'Queued') {
            console.log('✅ SMS sent via fallback sender');
            return res.json({
              success: true,
              status: fallbackStatus,
              message: `SMS ${fallbackStatus.toLowerCase()} successfully (via fallback sender)`,
              gateway: { id: fallbackMessageId, status: fallbackStatus, raw: fallbackResp.data, fallback: true }
            });
          }

          return res.status(502).json({
            success: false,
            status: fallbackStatus,
            error: `Fallback sender returned status: ${fallbackStatus}`,
            gateway: { id: fallbackMessageId, status: fallbackStatus, raw: fallbackResp.data, fallback: true }
          });
        } catch (fallbackErr) {
          const fbStatusCode = fallbackErr.response?.status || 500;
          const fbApiData = fallbackErr.response?.data;
          const fbApiMsg = fbApiData?.message || fbApiData?.error || null;
          return res.status(fbStatusCode).json({
            success: false,
            error: fbApiMsg || fallbackErr.message || 'Fallback sender failed to send SMS',
            details: fbApiData || null
          });
        }
      }

      return res.status(409).json({
        success: false,
        error: 'Sender name not approved by gateway. Please register/approve your sender name in Semaphore or provide a fallback sender.',
        details: apiData || null
      });
    }

    return res.status(statusCode).json({
      success: false,
      error: apiMsg || error.message || 'Failed to send SMS',
      details: apiData || null
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    cors: 'enabled',
    endpoints: ['/api/send-sms', '/api/health', '/api/send-sms/test']
  });
});

app.post('/api/send-sms/test', (req, res) => {
  res.json({ success: true, message: 'Test mode - SMS not actually sent', data: { test: true } });
});

// FIXED: Changed default port from 3001 to 3003
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`🚀 SMS API server running on port ${PORT}`);
  console.log(`📍 Endpoint: http://localhost:${PORT}/api/send-sms`);
  console.log(`🔧 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`✅ CORS enabled for: http://localhost:5173`);
});

export default app;