const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET /api/services
router.get('/', async (req, res) => {
    try {
        const [services] = await db.query(`
            SELECT *
            FROM SERVICE
            ORDER BY Service_id
        `);

        res.json(services);

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve services'
        });
    }
});

module.exports = router;