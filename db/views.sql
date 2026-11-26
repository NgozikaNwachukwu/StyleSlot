-- StyleSlot Phase II - Part C: All 10 SQL Views
-- Views 1-5: Required SQL features
-- Views 6-10: Additional application views

USE styleslot;

-- ============================================================
-- VIEW 1: Appointment Details
-- Join of at least three tables.
-- Displays booking, client, stylist, salon and service details.
-- ============================================================

CREATE OR REPLACE VIEW vw_appointment_details AS
SELECT
    a.appointment_id,
    CONCAT(cu.first_name, ' ', cu.last_name) AS client_name,
    CONCAT(su.first_name, ' ', su.last_name) AS stylist_name,
    COALESCE(sa.name, 'Mobile (no salon)') AS salon_name,
    s.name AS service,
    v.variant_name,
    a.start_datetime,
    a.end_datetime,
    a.status,
    a.quoted_price
FROM APPOINTMENT a
JOIN USER_ACCOUNT cu
    ON cu.user_id = a.client_id
JOIN SERVICE_VARIANT v
    ON v.variant_id = a.variant_id
JOIN SERVICE s
    ON s.service_id = v.service_id
JOIN STYLIST st
    ON st.stylist_id = v.stylist_id
JOIN USER_ACCOUNT su
    ON su.user_id = st.stylist_id
LEFT JOIN SALON sa
    ON sa.salon_id = st.salon_id;


-- ============================================================
-- VIEW 2: Top-Rated Stylists
-- Nested query using ALL and GROUP BY.
-- Finds stylists with the highest average review rating.
-- ============================================================

CREATE OR REPLACE VIEW vw_top_rated_stylists AS
SELECT
    v.stylist_id,
    CONCAT(u.first_name, ' ', u.last_name) AS stylist_name,
    ROUND(AVG(r.rating), 2) AS avg_rating,
    COUNT(*) AS num_reviews
FROM REVIEW r
JOIN APPOINTMENT a
    ON a.appointment_id = r.appointment_id
JOIN SERVICE_VARIANT v
    ON v.variant_id = a.variant_id
JOIN USER_ACCOUNT u
    ON u.user_id = v.stylist_id
GROUP BY
    v.stylist_id,
    u.first_name,
    u.last_name
HAVING AVG(r.rating) >= ALL (
    SELECT AVG(r2.rating)
    FROM REVIEW r2
    JOIN APPOINTMENT a2
        ON a2.appointment_id = r2.appointment_id
    JOIN SERVICE_VARIANT v2
        ON v2.variant_id = a2.variant_id
    GROUP BY v2.stylist_id
);


-- ============================================================
-- VIEW 3: Value Picks
-- Correlated nested query.
-- Finds active service variants priced below the average
-- price for the same service.
-- ============================================================

CREATE OR REPLACE VIEW vw_value_picks AS
SELECT
    s.name AS service,
    v.variant_name,
    CONCAT(u.first_name, ' ', u.last_name) AS stylist_name,
    v.price,
    (
        SELECT ROUND(AVG(v2.price), 2)
        FROM SERVICE_VARIANT v2
        WHERE v2.service_id = v.service_id
          AND v2.is_active
    ) AS service_avg_price
FROM SERVICE_VARIANT v
JOIN SERVICE s
    ON s.service_id = v.service_id
JOIN USER_ACCOUNT u
    ON u.user_id = v.stylist_id
WHERE v.is_active
    AND v.price < (
        SELECT AVG(v3.price)
        FROM SERVICE_VARIANT v3
        WHERE v3.service_id = v.service_id
          AND v3.is_active
    );


-- ============================================================
-- VIEW 4: Salon and Stylist Directory
-- FULL OUTER JOIN simulation using UNION.
-- Includes salons without stylists and mobile stylists.
-- MySQL does not support FULL OUTER JOIN directly.
-- ============================================================

CREATE OR REPLACE VIEW vw_salon_stylist_directory AS
SELECT
    sa.salon_id,
    sa.name AS salon_name,
    sa.city,
    st.stylist_id,
    CONCAT(u.first_name, ' ', u.last_name) AS stylist_name
FROM SALON sa
LEFT JOIN (
    STYLIST st
    JOIN USER_ACCOUNT u
        ON u.user_id = st.stylist_id
)
    ON st.salon_id = sa.salon_id

UNION

SELECT
    sa.salon_id,
    sa.name AS salon_name,
    sa.city,
    st.stylist_id,
    CONCAT(u.first_name, ' ', u.last_name) AS stylist_name
FROM SALON sa
RIGHT JOIN (
    STYLIST st
    JOIN USER_ACCOUNT u
        ON u.user_id = st.stylist_id
)
    ON st.salon_id = sa.salon_id;


-- ============================================================
-- VIEW 5: Clients to Rebook
-- Nested query using the EXCEPT set operation.
-- Finds clients with completed visits but no upcoming
-- requested or confirmed appointments.
-- Requires MySQL 8.0.31 or newer.
-- ============================================================

CREATE OR REPLACE VIEW vw_clients_to_rebook AS
SELECT
    c.client_id,
    CONCAT(u.first_name, ' ', u.last_name) AS client_name,
    u.email,
    (
        SELECT MAX(a.start_datetime)
        FROM APPOINTMENT a
        WHERE a.client_id = c.client_id
          AND a.status = 'completed'
    ) AS last_visit
FROM CLIENT c
JOIN USER_ACCOUNT u
    ON u.user_id = c.client_id
WHERE c.client_id IN (
    SELECT a.client_id
    FROM APPOINTMENT a
    WHERE a.status = 'completed'

    EXCEPT

    SELECT a.client_id
    FROM APPOINTMENT a
    WHERE a.status IN ('requested', 'confirmed')
      AND a.start_datetime > NOW()
);


-- ============================================================
-- VIEW 6: Stylist Revenue
-- Calculates completed visits, no-shows, retained deposits
-- and net revenue for each stylist.
-- ============================================================

CREATE OR REPLACE VIEW vw_stylist_revenue AS
SELECT
    st.stylist_id,
    CONCAT(u.first_name, ' ', u.last_name) AS stylist_name,

    COUNT(DISTINCT CASE
        WHEN a.status = 'completed'
        THEN a.appointment_id
    END) AS completed_visits,

    COUNT(DISTINCT CASE
        WHEN a.status = 'no_show'
        THEN a.appointment_id
    END) AS no_shows,

    COALESCE(SUM(CASE
        WHEN a.status = 'no_show'
          AND p.payment_type = 'deposit'
          AND p.status = 'succeeded'
        THEN p.amount
    END), 0) AS no_show_deposits_kept,

    COALESCE(SUM(CASE
        WHEN p.status = 'succeeded'
          AND p.payment_type IN ('deposit', 'balance')
        THEN p.amount

        WHEN p.status = 'succeeded'
          AND p.payment_type = 'refund'
        THEN -p.amount
    END), 0) AS net_revenue

FROM STYLIST st
JOIN USER_ACCOUNT u
    ON u.user_id = st.stylist_id
LEFT JOIN SERVICE_VARIANT v
    ON v.stylist_id = st.stylist_id
LEFT JOIN APPOINTMENT a
    ON a.variant_id = v.variant_id
LEFT JOIN PAYMENT p
    ON p.appointment_id = a.appointment_id
GROUP BY
    st.stylist_id,
    u.first_name,
    u.last_name;


-- ============================================================
-- VIEW 7: Open Availability (CORRECTED)
-- Calculates booked and free minutes in upcoming open slots.
-- Correctly counts appointments that partially overlap slots.
-- Assumes active bookings for a stylist do not overlap.
-- ============================================================

CREATE OR REPLACE VIEW vw_open_availability AS
SELECT
    t.stylist_id,
    CONCAT(u.first_name, ' ', u.last_name) AS stylist_name,
    t.slot_date,
    t.start_time,
    t.end_time,

    -- Count only appointment minutes inside the slot
    COALESCE(SUM(
        TIMESTAMPDIFF(
            MINUTE,
            GREATEST(
                a.start_datetime,
                TIMESTAMP(t.slot_date, t.start_time)
            ),
            LEAST(
                a.end_datetime,
                TIMESTAMP(t.slot_date, t.end_time)
            )
        )
    ), 0) AS booked_min,

    -- Subtract booked minutes from total slot duration
    TIMESTAMPDIFF(
        MINUTE,
        TIMESTAMP(t.slot_date, t.start_time),
        TIMESTAMP(t.slot_date, t.end_time)
    )
    - COALESCE(SUM(
        TIMESTAMPDIFF(
            MINUTE,
            GREATEST(
                a.start_datetime,
                TIMESTAMP(t.slot_date, t.start_time)
            ),
            LEAST(
                a.end_datetime,
                TIMESTAMP(t.slot_date, t.end_time)
            )
        )
    ), 0) AS free_min

FROM TIME_SLOT t
JOIN USER_ACCOUNT u
    ON u.user_id = t.stylist_id

LEFT JOIN (
    APPOINTMENT a
    JOIN SERVICE_VARIANT v
        ON v.variant_id = a.variant_id
)
    ON v.stylist_id = t.stylist_id
    AND a.status IN ('requested', 'confirmed')
    AND a.start_datetime < TIMESTAMP(t.slot_date, t.end_time)
    AND a.end_datetime > TIMESTAMP(t.slot_date, t.start_time)

WHERE t.status = 'open'
    AND t.slot_date >= CURDATE()

GROUP BY
    t.stylist_id,
    u.first_name,
    u.last_name,
    t.slot_date,
    t.start_time,
    t.end_time

HAVING free_min > 0;


-- ============================================================
-- VIEW 8: Busiest Days
-- Calculates bookings, booked hours and total booked value
-- for each weekday, excluding cancelled appointments.
-- ============================================================

CREATE OR REPLACE VIEW vw_busiest_days AS
SELECT
    DAYOFWEEK(a.start_datetime) AS day_no,
    DAYNAME(a.start_datetime) AS day_name,
    COUNT(*) AS bookings,

    ROUND(
        SUM(
            TIMESTAMPDIFF(
                MINUTE,
                a.start_datetime,
                a.end_datetime
            )
        ) / 60, 1
    ) AS booked_hours,

    SUM(a.quoted_price) AS booked_value

FROM APPOINTMENT a
WHERE a.status <> 'cancelled'
GROUP BY
    DAYOFWEEK(a.start_datetime),
    DAYNAME(a.start_datetime);


-- ============================================================
-- VIEW 9: Service Popularity
-- Calculates the number of stylists offering each service,
-- bookings, average price and average rating.
-- ============================================================

CREATE OR REPLACE VIEW vw_service_popularity AS
SELECT
    s.service_id,
    s.name AS service,
    s.category,

    COUNT(DISTINCT v.stylist_id) AS stylists_offering,

    COUNT(DISTINCT CASE
        WHEN a.status <> 'cancelled'
        THEN a.appointment_id
    END) AS bookings,

    (
        SELECT ROUND(AVG(v2.price), 2)
        FROM SERVICE_VARIANT v2
        WHERE v2.service_id = s.service_id
    ) AS avg_price,

    ROUND(AVG(r.rating), 2) AS avg_rating

FROM SERVICE s
LEFT JOIN SERVICE_VARIANT v
    ON v.service_id = s.service_id
LEFT JOIN APPOINTMENT a
    ON a.variant_id = v.variant_id
LEFT JOIN REVIEW r
    ON r.appointment_id = a.appointment_id
GROUP BY
    s.service_id,
    s.name,
    s.category;


-- ============================================================
-- VIEW 10: Upcoming Preparation Checklist
-- Shows upcoming appointments requiring materials,
-- including preparation instructions and supplied items.
-- ============================================================

CREATE OR REPLACE VIEW vw_upcoming_prep_checklist AS
SELECT
    a.appointment_id,
    a.start_datetime,
    CONCAT(cu.first_name, ' ', cu.last_name) AS client_name,
    CONCAT(su.first_name, ' ', su.last_name) AS stylist_name,
    s.name AS service,
    s.prep_instructions,

    GROUP_CONCAT(
        CONCAT(
            m.quantity,
            ' x ',
            m.item_name,
            ' (',
            m.supplied_by,
            ')'
        )
        ORDER BY m.supplied_by, m.item_name
        SEPARATOR '; '
    ) AS materials

FROM APPOINTMENT a
JOIN SERVICE_VARIANT v
    ON v.variant_id = a.variant_id
JOIN SERVICE s
    ON s.service_id = v.service_id
JOIN USER_ACCOUNT cu
    ON cu.user_id = a.client_id
JOIN USER_ACCOUNT su
    ON su.user_id = v.stylist_id
JOIN APPOINTMENT_MATERIAL m
    ON m.appointment_id = a.appointment_id

WHERE a.status IN ('requested', 'confirmed')
    AND a.start_datetime > NOW()

GROUP BY
    a.appointment_id,
    a.start_datetime,
    cu.first_name,
    cu.last_name,
    su.first_name,
    su.last_name,
    s.name,
    s.prep_instructions;


-- ============================================================
-- VERIFY: Check that all 10 views were created.
-- ============================================================

SHOW FULL TABLES FROM styleslot
WHERE Table_type = 'VIEW';