const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Save user's WhatsApp connection
router.post('/whatsapp', async (req, res) => {
  const { user_id, phone_number_id, access_token, business_name, ai_persona } = req.body;

  if (!user_id || !phone_number_id || !access_token) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if user already has a connection — update it
  const { data: existing } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('whatsapp_connections')
      .update({ phone_number_id, access_token, business_name, ai_persona })
      .eq('user_id', user_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ message: '✅ WhatsApp connection updated!' });
  }

  // New connection
  const { error } = await supabase
    .from('whatsapp_connections')
    .insert([{ user_id, phone_number_id, access_token, business_name, ai_persona }]);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '✅ WhatsApp connected successfully!' });
});

// Get user's WhatsApp connection
router.get('/whatsapp/:user_id', async (req, res) => {
  const { user_id } = req.params;

  const { data, error } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (error) return res.status(404).json({ error: 'No connection found' });
  res.json(data);
});

// Toggle AI on/off
router.post('/toggle', async (req, res) => {
  const { user_id, is_active } = req.body;

  const { error } = await supabase
    .from('whatsapp_connections')
    .update({ is_active })
    .eq('user_id', user_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: `✅ AI ${is_active ? 'activated' : 'deactivated'}!` });
});

module.exports = router;