
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET all stylists
router.get('/', async (req, res) => {
    try {
        const [stylists] = await db.query(`
            SELECT
                st.Stylist_id AS stylist_id,
                CONCAT(u.First_name, ' ', u.Last_name)
                    AS stylist_name,
                sa.Name AS salon_name,
                ratings.avg_rating,
                COALESCE(ratings.review_count, 0)
                    AS review_count,
                prices.starting_price
            FROM STYLIST st

            JOIN USER_ACCOUNT u
                ON st.Stylist_id = u.User_id

            LEFT JOIN SALON sa
                ON st.Salon_id = sa.Salon_id

            LEFT JOIN (
                SELECT
                    sv.Stylist_id,
                    ROUND(AVG(r.Rating), 2) AS avg_rating,
                    COUNT(r.Appointment_id) AS review_count
                FROM REVIEW r
                JOIN APPOINTMENT a
                    ON r.Appointment_id = a.Appointment_id
                JOIN SERVICE_VARIANT sv
                    ON a.Variant_id = sv.Variant_id
                GROUP BY sv.Stylist_id
            ) ratings
                ON st.Stylist_id = ratings.Stylist_id

            LEFT JOIN (
                SELECT
                    Stylist_id,
                    MIN(Price) AS starting_price
                FROM SERVICE_VARIANT
                WHERE Is_active = 1
                GROUP BY Stylist_id
            ) prices
                ON st.Stylist_id = prices.Stylist_id

            ORDER BY st.Stylist_id
        `);

        const [services] = await db.query(`
            SELECT DISTINCT
                sv.Stylist_id AS stylist_id,
                s.Name AS service_name
            FROM SERVICE_VARIANT sv
            JOIN SERVICE s
                ON sv.Service_id = s.Service_id
            WHERE sv.Is_active = 1
            ORDER BY sv.Stylist_id, s.Name
        `);

        const data = stylists.map(stylist => ({
            stylist_id: stylist.stylist_id,
            stylist_name: stylist.stylist_name,
            salon_name: stylist.salon_name,

            avg_rating: stylist.avg_rating === null
                ? null
                : Number(stylist.avg_rating),

            review_count: Number(stylist.review_count),

            starting_price: stylist.starting_price === null
                ? null
                : Number(stylist.starting_price),

            services: services
                .filter(service =>
                    service.stylist_id === stylist.stylist_id
                )
                .map(service => service.service_name)
        }));

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Stylist error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve stylists'
        });
    }
});

// GET individual stylist profile
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);

    if (!/^\d+$/.test(req.params.id) ||
        !Number.isSafeInteger(id) ||
        id <= 0 || id > 2147483647) {

        return res.status(400).json({
            success: false,
            message: 'Invalid stylist ID'
        });
    }

    try {
        const [rows] = await db.query(`
            SELECT
                st.Stylist_id AS stylist_id,
                CONCAT(u.First_name, ' ', u.Last_name)
                    AS stylist_name,
                sa.Name AS salon_name,
                CASE
                    WHEN sa.Salon_id IS NULL THEN NULL
                    ELSE CONCAT_WS(', ',
                        sa.Street,
                        sa.City,
                        sa.Province
                    )
                END AS location,
                st.Bio AS bio,
                ratings.avg_rating,
                COALESCE(ratings.review_count, 0)
                    AS review_count

            FROM STYLIST st

            JOIN USER_ACCOUNT u
                ON st.Stylist_id = u.User_id

            LEFT JOIN SALON sa
                ON st.Salon_id = sa.Salon_id

            LEFT JOIN (
                SELECT
                    sv.Stylist_id,
                    ROUND(AVG(r.Rating), 2) AS avg_rating,
                    COUNT(r.Appointment_id) AS review_count
                FROM REVIEW r
                JOIN APPOINTMENT a
                    ON r.Appointment_id = a.Appointment_id
                JOIN SERVICE_VARIANT sv
                    ON a.Variant_id = sv.Variant_id
                GROUP BY sv.Stylist_id
            ) ratings
                ON st.Stylist_id = ratings.Stylist_id

            WHERE st.Stylist_id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Stylist not found'
            });
        }

        const stylist = rows[0];

        stylist.avg_rating = stylist.avg_rating === null
            ? null
            : Number(stylist.avg_rating);

        stylist.review_count = Number(stylist.review_count);

        res.json({
            success: true,
            data: stylist
        });

    } catch (error) {
        console.error('Stylist profile error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve stylist profile'
        });
    }
});

module.exports = router;
