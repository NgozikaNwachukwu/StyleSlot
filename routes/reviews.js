const express = require('express');
const db = require('../db/connection');

const {
    requireAuth,
    requireClient
} = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, requireClient, async (req, res) => {

    try {
        const {
            appointment_id,
            rating,
            comment = ''
        } = req.body || {};

        const validInteger = value =>
            ['number', 'string'].includes(typeof value) &&
            /^\d+$/.test(String(value)) &&
            Number.isSafeInteger(Number(value));

        if (
            !validInteger(appointment_id) ||
            Number(appointment_id) < 1 ||
            Number(appointment_id) > 2147483647 ||
            !validInteger(rating) ||
            Number(rating) < 1 ||
            Number(rating) > 5 ||
            typeof comment !== 'string' ||
            comment.length > 300
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid appointment, rating or comment'
            });
        }

        const [result] = await db.query(`
            INSERT INTO REVIEW (
                Appointment_id,
                Rating,
                Comment
            )
            SELECT Appointment_id, ?, ?
            FROM APPOINTMENT
            WHERE Appointment_id = ?
                AND Client_id = ?
                AND Status = 'completed'
        `, [
            Number(rating),
            comment.trim() || null,
            Number(appointment_id),
            req.user.User_id
        ]);

        if (!result.affectedRows) {
            return res.status(403).json({
                success: false,
                message: 'You can only review your own completed appointments'
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully'
        });

    } catch (error) {

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'You have already reviewed this appointment'
            });
        }

        console.error('Review error:', error.code);

        return res.status(500).json({
            success: false,
            message: 'Failed to submit review'
        });
    }
});

module.exports = router;