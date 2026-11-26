require('dotenv').config();

const express = require('express');
const path = require('path');
const db = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Start server
app.listen(PORT, () => {
    console.log(`StyleSlot server running on port ${PORT}`);
});