const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');

const {
    requireAuth,
    requireClient
} = require('../middleware/auth');

const router = express.Router();

// Validate positive integer IDs
function isValidId(value) {
    return (
        (typeof value === 'number' ||
         typeof value === 'string') &&
        /^\d+$/.test(String(value)) &&
        Number.isInteger(Number(value)) &&
        Number(value) > 0 &&
        Number(value) <= 2147483647
    );
}

// Validate appointment date
function isValidDate(value) {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value &&
        Number(value.slice(0, 4)) >= 1000
    );
}

// Standard booking error
function bookingError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}


// ==================================================
// POST /api/appointments
// ==================================================

router.post('/', requireAuth, requireClient, async (req, res) => {

    let connection;
    let transactionStarted = false;

    try {

        const {
            stylist_id,
            service_id,
            slot_id,
            appointment_date,
            start_time,
            notes = '',
            payment_method
        } = req.body || {};

        // Validate stylist and service
        if (
            !isValidId(stylist_id) ||
            !isValidId(service_id)
        ) {
            throw bookingError(
                400,
                'Invalid stylist or service ID'
            );
        }

        // Validate appointment date
        if (!isValidDate(appointment_date)) {
            throw bookingError(
                400,
                'Invalid appointment date'
            );
        }

        // Validate appointment time
        if (
            typeof start_time !== 'string' ||
            !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(start_time)
        ) {
            throw bookingError(
                400,
                'Invalid appointment start time'
            );
        }

        // Normalize time to HH:MM:SS
        const normalizedTime = start_time.length === 5
            ? `${start_time}:00`
            : start_time;

        // Validate booking notes
        if (
            typeof notes !== 'string' ||
            notes.length > 500
        ) {
            throw bookingError(
                400,
                'Notes cannot exceed 500 characters'
            );
        }

        // Validate payment method
        if (!['cash', 'card'].includes(payment_method)) {
            throw bookingError(
                400,
                'Invalid payment method'
            );
        }

        const stylistId = Number(stylist_id);
        const serviceId = Number(service_id);

        // Retrieve customer ID from authenticated session
        const clientId = req.user.User_id;

        // Validate generated slot identifier
        const expectedSlotId =
            `${stylistId}_${appointment_date}_${normalizedTime}`;

        if (slot_id !== expectedSlotId) {
            throw bookingError(
                400,
                'Invalid appointment slot'
            );
        }

        const startDateTime =
            `${appointment_date} ${normalizedTime}`;

        // Obtain a dedicated database connection
        connection = await db.getConnection();

        // Begin transaction
        await connection.beginTransaction();
        transactionStarted = true;

        // Lock stylist row to serialize bookings
        // for the same stylist
        const [stylists] = await connection.query(`
            SELECT Stylist_id
            FROM STYLIST
            WHERE Stylist_id = ?
            FOR UPDATE
        `, [stylistId]);

        if (stylists.length === 0) {
            throw bookingError(
                404,
                'Stylist not found'
            );
        }

        // Verify customer record
        const [clients] = await connection.query(`
            SELECT Client_id
            FROM CLIENT
            WHERE Client_id = ?
            FOR UPDATE
        `, [clientId]);

        if (clients.length === 0) {
            throw bookingError(
                403,
                'Customer account not found'
            );
        }

        // Retrieve the cheapest active service variant
        // Matches the stylist services endpoint
        const [variants] = await connection.query(`
            SELECT
                Variant_id,
                Price,
                Duration_min,
                Deposit_amount
            FROM SERVICE_VARIANT
            WHERE Stylist_id = ?
                AND Service_id = ?
                AND Is_active = 1
            ORDER BY Price ASC, Variant_id ASC
            LIMIT 1
            FOR UPDATE
        `, [stylistId, serviceId]);

        if (variants.length === 0) {
            throw bookingError(
                404,
                'Service not offered by this stylist'
            );
        }

        const variant = variants[0];

        const variantId = variant.Variant_id;
        const price = variant.Price;
        const duration = Number(variant.Duration_min);

        // Calculate appointment end time using MySQL
        const [dateTimes] = await connection.query(`
            SELECT
                DATE_FORMAT(
                    TIMESTAMPADD(MINUTE, ?, ?),
                    '%Y-%m-%d %H:%i:%s'
                ) AS end_datetime,

                (? > NOW()) AS is_future
        `, [
            duration,
            startDateTime,
            startDateTime
        ]);

        const endDateTime = dateTimes[0].end_datetime;

        // Reject appointments in the past
        if (!dateTimes[0].is_future) {
            throw bookingError(
                409,
                'Appointment time is no longer available'
            );
        }

        // Check that the appointment fits completely
        // inside an open availability window.
        // Also enforce the existing 30-minute intervals.
        const [openSlots] = await connection.query(`
            SELECT Stylist_id
            FROM TIME_SLOT
            WHERE Stylist_id = ?
                AND Slot_date = ?
                AND Status = 'open'

                AND TIMESTAMP(
                    Slot_date,
                    Start_time
                ) <= ?

                AND TIMESTAMP(
                    Slot_date,
                    End_time
                ) >= ?

                AND MOD(
                    TIMESTAMPDIFF(
                        SECOND,
                        TIMESTAMP(Slot_date, Start_time),
                        ?
                    ),
                    1800
                ) = 0

            FOR UPDATE
        `, [
            stylistId,
            appointment_date,
            startDateTime,
            endDateTime,
            startDateTime
        ]);

        if (openSlots.length === 0) {
            throw bookingError(
                409,
                'Selected appointment time is unavailable'
            );
        }

        // Check for blocked availability periods
        const [blockedSlots] = await connection.query(`
            SELECT Stylist_id
            FROM TIME_SLOT
            WHERE Stylist_id = ?
                AND Status = 'blocked'

                AND TIMESTAMP(
                    Slot_date,
                    Start_time
                ) < ?

                AND TIMESTAMP(
                    Slot_date,
                    End_time
                ) > ?

            FOR UPDATE
        `, [
            stylistId,
            endDateTime,
            startDateTime
        ]);

        if (blockedSlots.length > 0) {
            throw bookingError(
                409,
                'Selected appointment time is blocked'
            );
        }

        // Check for overlapping stylist appointments
        const [existingAppointments] =
            await connection.query(`
                SELECT a.Appointment_id

                FROM APPOINTMENT a

                JOIN SERVICE_VARIANT sv
                    ON a.Variant_id = sv.Variant_id

                WHERE sv.Stylist_id = ?
                    AND a.Status <> 'cancelled'
                    AND a.Start_datetime < ?
                    AND a.End_datetime > ?

                FOR UPDATE
            `, [
                stylistId,
                endDateTime,
                startDateTime
            ]);

        if (existingAppointments.length > 0) {
            throw bookingError(
                409,
                'This appointment time has already been booked'
            );
        }

        // Create appointment
        const [appointmentResult] =
            await connection.query(`
                INSERT INTO APPOINTMENT (
                    Client_id,
                    Variant_id,
                    Start_datetime,
                    End_datetime,
                    Quoted_price,
                    Status,
                    Client_notes
                )
                VALUES (?, ?, ?, ?, ?, 'confirmed', ?)
            `, [
                clientId,
                variantId,
                startDateTime,
                endDateTime,
                price,
                notes.trim() || null
            ]);

        const appointmentId =
            appointmentResult.insertId;

        // Generate unique internal payment reference
        // No real Stripe integration
        const paymentReference =
            `${payment_method}_${crypto.randomBytes(16).toString('hex')}`;

        // Cash is unpaid; card payment is simulated
        const paymentStatus = payment_method === 'cash'
            ? 'pending'
            : 'succeeded';

        // Record payment
        await connection.query(`
            INSERT INTO PAYMENT (
                Appointment_id,
                Stripe_payment_id,
                Payment_type,
                Amount,
                Currency,
                Status,
                Paid_at,
                Payment_method
            )
            VALUES (
                ?,
                ?,
                'balance',
                ?,
                'CAD',
                ?,
                CASE
                    WHEN ? = 'succeeded'
                    THEN NOW()
                    ELSE NULL
                END,
                ?
            )
        `, [
            appointmentId,
            paymentReference,
            price,
            paymentStatus,
            paymentStatus,
            payment_method
        ]);

        // Save appointment and payment together
        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            data: {
                appointment_id: appointmentId
            },
            message: 'Appointment booked successfully'
        });

    } catch (error) {

        // Undo changes if anything fails
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Rollback error:',
                    rollbackError.code
                );
            }
        }

        // Handle database double-booking trigger
        if (
            error.sqlState === '45000' &&
            error.message.includes(
                'This stylist is already booked'
            )
        ) {
            return res.status(409).json({
                success: false,
                message: 'This appointment time has already been booked'
            });
        }

        // Handle temporary database locking conflicts
        if (
            error.code === 'ER_LOCK_DEADLOCK' ||
            error.code === 'ER_LOCK_WAIT_TIMEOUT'
        ) {
            return res.status(503).json({
                success: false,
                message: 'Booking temporarily unavailable. Please try again.'
            });
        }

        // Handle validation and availability errors
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                message: error.message
            });
        }

        console.error(
            'Appointment booking error:',
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: 'Failed to book appointment'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;