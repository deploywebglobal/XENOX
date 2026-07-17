const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const whatsappRoutes = require('./routes/whatsapp');
const connectRoutes = require('./routes/connect');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/connect', connectRoutes);


// Test route
app.get('/', (req, res) => {
  res.json({ message: 'XENOX Backend is running 🚀' });
});

app.listen(PORT, () => {
  console.log(`XENOX server running on port ${PORT}`);
});