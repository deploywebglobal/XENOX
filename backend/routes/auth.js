const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
 process.env.SUPABASE_URL,
 process.env.SUPABASE_ANON_KEY
);
// Email signup
router.post('/signup', async (req, res) => {
 const { email, password } = req.body;

 const { data, error } = await supabase.auth.signUp({
 email,
 password
 });
 if (error) return res.status(400).json({ error: error.message });
 res.json({ message: 'Signup successful! Check your email.', data
});
});
// Email login
router.post('/login', async (req, res) => {
 const { email, password } = req.body;
 const { data, error } = await supabase.auth.signInWithPassword({
 email,
 password
 });
 if (error) return res.status(400).json({ error: error.message });
 res.json({ message: 'Login successful!', session: data.session });
});

// Google login — returns a URL, frontend opens it
router.get('/google', async (req, res) => {
 const { data, error } = await supabase.auth.signInWithOAuth({
 provider: 'google',
 options: {
 redirectTo: 'https://xenox-chat.pages.dev/dashboard.html'
 }
 });
 if (error) return res.status(400).json({ error: error.message });
 res.json({ url: data.url });
});
module.exports = router;