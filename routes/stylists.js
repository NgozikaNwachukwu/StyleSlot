
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Supported service filters
const serviceKeywords = {
    braids: ['braid', 'cornrow'],
    locs: ['loc', 'retwist'],
    twists: ['twist'],
    wig: ['wig'],
    natural: ['natural', 'wash and go', 'afro'],
    silk: ['silk press']
};

// Supported sorting options
const sortOptions = {
    recommended: 'st.Stylist_id ASC',
    rating: 'ratings.avg_rating IS NULL, ratings.avg_rating DESC, st.Stylist_id ASC',
    'price-low': 'prices.starting_price IS NULL, prices.starting_price ASC, st.Stylist_id ASC',
    'price-high': 'prices.starting_price IS NULL, prices.starting_price DESC, st.Stylist_id ASC',
    name: 'stylist_name ASC, st.Stylist_id ASC'
};

// Validate database IDs
function isValidId(value) {
    return typeof value === 'string' &&
        /^\d+$/.test(value) &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0 &&
        Number(value) <= 2147483647;
}

// Check whether a stylist exists
async function stylistExists(id) {
    const [rows] = await db.query(`
        SELECT Stylist_id
        FROM STYLIST
        WHERE Stylist_id = ?
    `, [id]);

    return rows.length > 0;
}


// ==================================================
// 1. GET ALL STYLISTS
// ==================================================

router.get('/', async (req, res) => {
    try {
        const {
            search = '',
            service = 'all',
            sort = 'recommended'
        } = req.query;

        if (
            typeof search !== 'string' ||
            typeof service !== 'string' ||
            typeof sort !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid query parameters'
            });
        }

        if (!Object.hasOwn(sortOptions, sort)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sorting option'
            });
        }

        const conditions = [];
        const parameters = [];

        // Search by stylist, salon, location or service
        if (search.trim()) {
            const keyword = `%${search.trim().toLowerCase()}%`;

            conditions.push(`
                (
                    LOWER(CONCAT(u.First_name, ' ', u.Last_name)) LIKE ?
                    OR LOWER(sa.Name) LIKE ?
                    OR LOWER(CONCAT_WS(' ',
                        sa.Street,
                        sa.City,
                        sa.Province,
                        sa.Postal_code
                    )) LIKE ?
                    OR EXISTS (
                        SELECT 1
                        FROM SERVICE_VARIANT sv
                        JOIN SERVICE s
                            ON sv.Service_id = s.Service_id
                        WHERE sv.Stylist_id = st.Stylist_id
                            AND sv.Is_active = 1
                            AND (
                                LOWER(s.Name) LIKE ?
                                OR LOWER(s.Category) LIKE ?
                            )
                    )
                )
            `);

            parameters.push(
                keyword,
                keyword,
                keyword,
                keyword,
                keyword
            );
        }

        // Filter by service
        const selectedService = service.trim().toLowerCase();

        if (selectedService && selectedService !== 'all') {
            const keywords = Object.hasOwn(
                serviceKeywords,
                selectedService
            )
                ? serviceKeywords[selectedService]
                : [selectedService];

            const serviceConditions = keywords.map(() => `
                (
                    LOWER(s.Name) LIKE ?
                    OR LOWER(s.Category) LIKE ?
                )
            `).join(' OR ');

            conditions.push(`
                EXISTS (
                    SELECT 1
                    FROM SERVICE_VARIANT sv
                    JOIN SERVICE s
                        ON sv.Service_id = s.Service_id
                    WHERE sv.Stylist_id = st.Stylist_id
                        AND sv.Is_active = 1
                        AND (${serviceConditions})
                )
            `);

            keywords.forEach(keyword => {
                parameters.push(
                    `%${keyword}%`,
                    `%${keyword}%`
                );
            });
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Retrieve stylists
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

            ${whereClause}

            ORDER BY ${sortOptions[sort]}
        `, parameters);

        // Retrieve distinct active services
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


// ==================================================
// 2. GET INDIVIDUAL STYLIST PROFILE
// ==================================================

router.get('/:id', async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid stylist ID'
        });
    }

    const id = Number(req.params.id);

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


// ==================================================
// 3. GET STYLIST SERVICES
// ==================================================

router.get('/:id/services', async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid stylist ID'
        });
    }

    const id = Number(req.params.id);

    try {
        if (!(await stylistExists(id))) {
            return res.status(404).json({
                success: false,
                message: 'Stylist not found'
            });
        }

        const [rows] = await db.query(`
            SELECT
                service_id,
                service_name,
                price,
                duration_minutes,
                description
            FROM (
                SELECT
                    s.Service_id AS service_id,
                    s.Name AS service_name,
                    sv.Price AS price,
                    sv.Duration_min AS duration_minutes,
                    s.Description AS description,

                    ROW_NUMBER() OVER (
                        PARTITION BY s.Service_id
                        ORDER BY sv.Price ASC, sv.Variant_id ASC
                    ) AS row_num

                FROM SERVICE_VARIANT sv

                JOIN SERVICE s
                    ON sv.Service_id = s.Service_id

                WHERE sv.Stylist_id = ?
                    AND sv.Is_active = 1
            ) ranked_services

            WHERE row_num = 1
            ORDER BY service_name
        `, [id]);

        const data = rows.map(service => ({
            service_id: Number(service.service_id),
            service_name: service.service_name,
            price: Number(service.price),
            duration_minutes: Number(service.duration_minutes),
            description: service.description
        }));

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Stylist services error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve stylist services'
        });
    }
});


// ==================================================
// 4. GET STYLIST REVIEWS
// ==================================================

router.get('/:id/reviews', async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid stylist ID'
        });
    }

    const id = Number(req.params.id);

    try {
        if (!(await stylistExists(id))) {
            return res.status(404).json({
                success: false,
                message: 'Stylist not found'
            });
        }

        const [rows] = await db.query(`
            SELECT
                CONCAT(
                    u.First_name,
                    ' ',
                    LEFT(u.Last_name, 1),
                    '.'
                ) AS client_name,

                r.Rating AS rating,
                r.Comment AS comment,

                DATE_FORMAT(
                    r.Created_at,
                    '%Y-%m-%d'
                ) AS review_date

            FROM REVIEW r

            JOIN APPOINTMENT a
                ON r.Appointment_id = a.Appointment_id

            JOIN SERVICE_VARIANT sv
                ON a.Variant_id = sv.Variant_id

            JOIN CLIENT c
                ON a.Client_id = c.Client_id

            JOIN USER_ACCOUNT u
                ON c.Client_id = u.User_id

            WHERE sv.Stylist_id = ?

            ORDER BY r.Created_at DESC,
                     r.Appointment_id DESC
        `, [id]);

        const data = rows.map(review => ({
            client_name: review.client_name,
            rating: Number(review.rating),
            comment: review.comment,
            review_date: review.review_date
        }));

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Stylist reviews error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve stylist reviews'
        });
    }
});


// ==================================================
// 5. GET STYLIST AVAILABILITY
// ==================================================

router.get('/:id/availability', async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid stylist ID'
        });
    }

    if (!isValidId(req.query.service_id)) {
        return res.status(400).json({
            success: false,
            message: 'A valid service_id is required'
        });
    }

    const id = Number(req.params.id);
    const serviceId = Number(req.query.service_id);

    try {
        if (!(await stylistExists(id))) {
            return res.status(404).json({
                success: false,
                message: 'Stylist not found'
            });
        }

        // Retrieve the cheapest active service variant
        const [variants] = await db.query(`
            SELECT
                Variant_id,
                Duration_min

            FROM SERVICE_VARIANT

            WHERE Stylist_id = ?
                AND Service_id = ?
                AND Is_active = 1

            ORDER BY Price ASC, Variant_id ASC
            LIMIT 1
        `, [id, serviceId]);

        if (variants.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Service not offered by this stylist'
            });
        }

        const duration = Number(variants[0].Duration_min);

        // Generate appointment starts every 30 minutes
        const [rows] = await db.query(`
            WITH RECURSIVE increments AS (
                SELECT 0 AS minutes_offset

                UNION ALL

                SELECT minutes_offset + 30
                FROM increments
                WHERE minutes_offset < 1410
            ),

            candidates AS (
                SELECT
                    ts.Stylist_id,

                    TIMESTAMPADD(
                        MINUTE,
                        i.minutes_offset,
                        TIMESTAMP(ts.Slot_date, ts.Start_time)
                    ) AS candidate_start,

                    TIMESTAMPADD(
                        MINUTE,
                        i.minutes_offset + ?,
                        TIMESTAMP(ts.Slot_date, ts.Start_time)
                    ) AS candidate_end,

                    TIMESTAMP(
                        ts.Slot_date,
                        ts.End_time
                    ) AS slot_end

                FROM TIME_SLOT ts

                CROSS JOIN increments i

                WHERE ts.Stylist_id = ?
                    AND ts.Status = 'open'
                    AND ts.Slot_date >= CURRENT_DATE()
            )

            SELECT DISTINCT
                DATE_FORMAT(
                    c.candidate_start,
                    '%Y-%m-%d'
                ) AS date,

                DATE_FORMAT(
                    c.candidate_start,
                    '%H:%i:%s'
                ) AS start_time

            FROM candidates c

            WHERE c.candidate_start > NOW()

                AND c.candidate_end <= c.slot_end

                AND NOT EXISTS (
                    SELECT 1
                    FROM APPOINTMENT a

                    JOIN SERVICE_VARIANT sv
                        ON a.Variant_id = sv.Variant_id

                    WHERE sv.Stylist_id = c.Stylist_id
                        AND a.Status <> 'cancelled'
                        AND a.Start_datetime < c.candidate_end
                        AND a.End_datetime > c.candidate_start
                )

                AND NOT EXISTS (
                    SELECT 1
                    FROM TIME_SLOT blocked

                    WHERE blocked.Stylist_id = c.Stylist_id
                        AND blocked.Status = 'blocked'

                        AND TIMESTAMP(
                            blocked.Slot_date,
                            blocked.Start_time
                        ) < c.candidate_end

                        AND TIMESTAMP(
                            blocked.Slot_date,
                            blocked.End_time
                        ) > c.candidate_start
                )

            ORDER BY date, start_time
        `, [duration, id]);

        const data = rows.map(slot => ({
            slot_id: `${id}_${slot.date}_${slot.start_time}`,
            date: slot.date,
            start_time: slot.start_time
        }));

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Stylist availability error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve stylist availability'
        });
    }
});

module.exports = router;
