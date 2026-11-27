require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express session configuration
if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is missing from .env');
}

app.use(session({
    name: 'styleslot.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Serve frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Backend status
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'StyleSlot Backend is running'
    });
});

// Database connection test
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');

        res.json({
            success: true,
            server: 'Running',
            database: 'Connected',
            application: 'StyleSlot'
        });

    } catch (error) {
        console.error('Database error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Database connection failed'
        });
    }
});

// API routes
app.use('/api/services', require('./routes/services'));
app.use('/api/stylists', require('./routes/stylists'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/weather', require('./routes/weather'));
// Administrator access test
const { requireAuth, requireAdmin } = require('./middleware/auth');

app.get('/api/admin/test', requireAuth, requireAdmin, (req, res) => {
    res.json({
        success: true,
        message: 'Administrator access granted'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`StyleSlot server running on port ${PORT}`);
});
