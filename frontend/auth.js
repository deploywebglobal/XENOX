const { createClient } = supabase
const SUPABASE_URL = 'https://sezvhuuzdgbsecdtbojf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlenZodXV6ZGdic2VjZHRib2pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTAxOTEsImV4cCI6MjA5OTY4NjE5MX0.aIbOQSCWc_6MNYiGfRTSoEkvBYhH75uG3RxSxyQKM7w' // paste your anon key
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Check if user is already logged in — redirect to dashboard
sb.auth.getSession().then(({ data: { session } }) => {
 if (session && window.location.pathname.includes('index')) {
 window.location.href = '/frontend/dashboard.html'
 }
})

// Open modal
function openModal(type) {
 document.getElementById('modalOverlay').style.display = 'block'
 document.getElementById('authModal').style.display = 'block'
 if (type === 'login') {
 document.getElementById('loginForm').style.display = 'block'
 document.getElementById('signupForm').style.display = 'none'
 } else {
 document.getElementById('loginForm').style.display = 'none'
 document.getElementById('signupForm').style.display = 'block'
 }
}

// ✅ FIX: Close modal function (This was missing!)
function closeModal() {
 document.getElementById('modalOverlay').style.display = 'none'
 document.getElementById('authModal').style.display = 'none'
}

// ✅ FIX: Handle Login function (This was missing!)
async function handleLogin() {
 const email = document.getElementById('loginEmail').value
 const password = document.getElementById('loginPassword').value
 const errorEl = document.getElementById('loginError')

 errorEl.textContent = ''

 if (!email || !password) {
     errorEl.textContent = '⚠️ Please fill in both fields.'
     return
 }

 const { data, error } = await sb.auth.signInWithPassword({ email, password })

 if (error) {
     errorEl.textContent = '❌ ' + error.message
     return
 }

 window.location.href = '/frontend/dashboard.html'
}

// Handle Signup
async function handleSignup() {
 const email = document.getElementById('signupEmail').value
 const password = document.getElementById('signupPassword').value
 const errorEl = document.getElementById('signupError')
 const successEl = document.getElementById('signupSuccess')
 const btn = document.querySelector('#signupForm .btn-primary')

 errorEl.textContent = ''
 successEl.textContent = ''

 if (!email || !password) {
     errorEl.textContent = '⚠️ Please fill in both fields.'
     return
 }
 if (password.length < 6) {
     errorEl.textContent = '⚠️ Password must be at least 6 characters.'
     return
 }

 btn.textContent = 'Creating account...'
 btn.disabled = true

 const { data, error } = await sb.auth.signUp({ email, password })

 if (error) {
     errorEl.textContent = '❌ ' + error.message
     btn.textContent = 'Create Account'
     btn.disabled = false
     return
 }

 successEl.textContent = '✅ Account created! Taking you to dashboard...'
 btn.textContent = 'Success!'
 setTimeout(() => {
     window.location.href = '/frontend/dashboard.html'
 }, 1500)
}

// Google Login
async function handleGoogleLogin() {
 const { data, error } = await sb.auth.signInWithOAuth({
     provider: 'google',
     options: {
         redirectTo: 'http://127.0.0.1:5500/frontend/dashboard.html'
     }
 })
 if (error) alert(error.message)
}