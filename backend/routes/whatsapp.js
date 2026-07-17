const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// ========================
//  Environment Validation
// ========================
const REQUIRED_ENV_VARS = [
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_TOKEN',
  'GROQ_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];
REQUIRED_ENV_VARS.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

// ========================
//  Clients (singletons)
// ========================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ========================
//  Utility Functions
// ========================
/**
 * Verify the incoming webhook signature (Meta sends X-Hub-Signature-256)
 * @param {string} signature - The signature header value
 * @param {string} body - Raw request body string
 * @param {string} appSecret - Your Facebook App Secret
 * @returns {boolean} - True if valid
 */
function verifySignature(signature, body, appSecret) {
  if (!signature || !appSecret) return false;
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Send a WhatsApp text message via Cloud API
 */
async function sendWhatsAppMessage(phoneNumberId, to, text, token) {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10s timeout
    });
    return response.data;
  } catch (error) {
    // Log detailed error from WhatsApp
    const errMsg = error.response?.data?.error?.message || error.message;
    throw new Error(`WhatsApp API error: ${errMsg}`);
  }
}

/**
 * Generate an AI reply using Groq
 */
async function generateAiReply(prompt, persona) {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: persona },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });
    return response.choices[0].message.content;
  } catch (error) {
    throw new Error(`Groq AI error: ${error.message}`);
  }
}

// ========================
//  Webhook Routes
// ========================

/**
 * GET /webhook - Meta webhook verification
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified by Meta!');
    res.status(200).send(challenge);
  } else {
    console.warn('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * POST /webhook - Incoming messages
 */
router.post('/webhook', async (req, res) => {
  // 1. Verify signature for security (recommended)
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = process.env.FACEBOOK_APP_SECRET; // Add this to your env
  if (appSecret && signature) {
    const rawBody = JSON.stringify(req.body); // must use raw body; use express.raw() middleware for this route
    if (!verifySignature(signature, rawBody, appSecret)) {
      console.warn('❌ Invalid webhook signature – ignoring');
      return res.sendStatus(403);
    }
  } else if (appSecret) {
    console.warn('⚠️ Missing signature header – ignoring (set FACEBOOK_APP_SECRET to enforce)');
  }

  // 2. Acknowledge receipt immediately (WhatsApp expects 200)
  res.sendStatus(200);

  // 3. Process the webhook asynchronously (non-blocking)
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
      console.log('Ignoring non-WhatsApp event');
      return;
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log('No message found in webhook payload');
      return;
    }

    // Extract metadata
    const phoneNumberId = value.metadata.phone_number_id;
    const from = message.from;
    const messageType = message.type;

    // 4. Lookup connection in Supabase
    const { data: connection, error: dbError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('phone_number_id', phoneNumberId)
      .single();

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('❌ Supabase error:', dbError.message);
      return;
    }

    if (!connection) {
      console.warn(`⚠️ No connection found for phone_number_id: ${phoneNumberId}`);
      // Optionally reply with a default message or ignore
      return;
    }

    const token = connection.access_token || process.env.WHATSAPP_TOKEN;
    const aiPersona = connection.ai_persona || 'You are a helpful business assistant. Reply professionally and keep responses under 150 words.';

    // 5. Handle different message types
    let replyText = null;

    switch (messageType) {
      case 'text': {
        const userText = message.text.body;
        console.log(`📨 Text from ${from}: ${userText}`);
        try {
          replyText = await generateAiReply(userText, aiPersona);
        } catch (aiError) {
          console.error('❌ AI generation failed:', aiError.message);
          replyText = 'I’m having trouble thinking right now. Please try again in a moment.';
        }
        break;
      }
      case 'image':
      case 'audio':
      case 'video':
      case 'document':
        replyText = `I received your ${messageType}. I’m a text-based assistant, but I’ll pass this to a human if needed.`;
        break;
      case 'interactive': {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') {
          replyText = `You selected: ${interactive.button_reply.title}`;
        } else if (interactive.type === 'list_reply') {
          replyText = `You chose: ${interactive.list_reply.title}`;
        } else {
          replyText = 'I see you interacted with a menu.';
        }
        break;
      }
      default:
        console.log(`ℹ️ Unhandled message type: ${messageType}`);
        return; // No reply needed
    }

    // 6. Send the reply (if any)
    if (replyText) {
      await sendWhatsAppMessage(phoneNumberId, from, replyText, token);
      console.log(`✅ Reply sent to ${from}`);
    }
  } catch (error) {
    // Log any unexpected errors but don't fail the webhook (already sent 200)
    console.error('❌ Webhook processing error:', error.message);
  }
});

module.exports = router;