const express = require('express');
const db = require('../db/connection');
const PDFDocument = require('pdfkit');
const { stringify } = require('csv-stringify/sync');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Protect every admin endpoint
router.use(requireAuth, requireAdmin);

const allowedViews = new Set([
    'vw_appointment_details',
    'vw_top_rated_stylists',
    'vw_value_picks',
    'vw_salon_stylist_directory',
    'vw_clients_to_rebook',
    'vw_stylist_revenue',
    'vw_open_availability',
    'vw_busiest_days',
    'vw_service_popularity',
    'vw_upcoming_prep_checklist'
]);

function fail(status, message) {
    throw Object.assign(new Error(message), { status });
}

function handleError(res, error) {
    console.error('Admin error:', error.message);

    if (res.headersSent) {
        return res.end();
    }

    return res.status(error.status || 500).json({
        success: false,
        message: error.status
            ? error.message
            : 'Administrator operation failed'
    });
}

function identifier(name) {
    return '`' + name.replace(/`/g, '``') + '`';
}

// Retrieve actual SQL view results and metadata
async function getViewData(viewName, search = '') {
    if (!allowedViews.has(viewName)) {
        fail(400, 'Invalid report name');
    }

    if (typeof search !== 'string' || search.length > 300) {
        fail(400, 'Invalid search keyword');
    }

    const view = identifier(viewName);

    const [, metadata] = await db.query(
        `SELECT * FROM ${view} LIMIT 0`
    );

    const columns = metadata.map(field => field.name);

    let sql = `SELECT * FROM ${view}`;
    let params = [];

    if (search.trim()) {
        const conditions = columns.map(column =>
            `LOCATE(LOWER(?), LOWER(CAST(${identifier(column)} AS CHAR))) > 0`
        );

        sql += ' WHERE (' + conditions.join(' OR ') + ')';
        params = columns.map(() => search.trim());
    }

    const [rows] = await db.execute(sql, params);

    return { columns, rows };
}

// Administrator test
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Administrator access granted'
    });
});

// 1. ADMIN STATISTICS
router.get('/stats', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM APPOINTMENT)
                    AS total_appointments,

                (SELECT COUNT(*) FROM CLIENT)
                    AS total_customers,

                (SELECT COUNT(*) FROM STYLIST)
                    AS total_stylists,

                (
                    SELECT COALESCE(SUM(
                        CASE
                            WHEN Payment_type = 'refund'
                                THEN -Amount
                            ELSE Amount
                        END
                    ), 0)
                    FROM PAYMENT
                    WHERE Status = 'succeeded'
                ) AS total_revenue
        `);

        const stats = rows[0];

        res.json({
            success: true,
            data: {
                total_appointments: Number(stats.total_appointments),
                total_customers: Number(stats.total_customers),
                total_stylists: Number(stats.total_stylists),
                total_revenue: Number(stats.total_revenue)
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

// 2. ALL TEN PHASE II VIEWS
router.get('/views/:viewName', async (req, res) => {
    try {
        const data = await getViewData(
            req.params.viewName,
            req.query.search || ''
        );

        res.json({
            success: true,
            data
        });

    } catch (error) {
        handleError(res, error);
    }
});

// 3. CHART.JS ANALYTICS
router.get('/analytics', async (req, res) => {
    try {
        const [[revenue], [popularity], [days]] =
            await Promise.all([
                db.query(`
                    SELECT stylist_name, net_revenue
                    FROM vw_stylist_revenue
                    ORDER BY net_revenue DESC
                `),

                db.query(`
                    SELECT service, bookings
                    FROM vw_service_popularity
                    ORDER BY bookings DESC
                `),

                db.query(`
                    SELECT day_name, bookings
                    FROM vw_busiest_days
                    ORDER BY day_no ASC
                `)
            ]);

        res.json({
            success: true,
            data: {
                stylist_revenue: revenue.map(row => ({
                    label: row.stylist_name,
                    value: Number(row.net_revenue)
                })),

                service_popularity: popularity.map(row => ({
                    label: row.service,
                    value: Number(row.bookings)
                })),

                busiest_days: days.map(row => ({
                    label: row.day_name,
                    value: Number(row.bookings)
                }))
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

// Convert database values for exports
function displayValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return String(value);
}

// Prevent spreadsheet formula injection
function safeCSV(value) {
    if (typeof value === 'number') {
        return value;
    }

    const text = displayValue(value);

    if (/^[\s\uFEFF]*[=+\-@]/.test(text) ||
        /^[\t\r\n]/.test(text)) {
        return "'" + text;
    }

    return text;
}

// 4. CSV AND PDF EXPORTS
router.get('/export/:viewName', async (req, res) => {
    try {
        const viewName = req.params.viewName;
        const format = req.query.format || 'csv';

        if (!['csv', 'pdf'].includes(format)) {
            fail(400, 'Format must be csv or pdf');
        }

        const { columns, rows } = await getViewData(
            viewName,
            req.query.search || ''
        );

        // CSV export
        if (format === 'csv') {
            const records = [
                columns.map(safeCSV),
                ...rows.map(row =>
                    columns.map(column => safeCSV(row[column]))
                )
            ];

            const csv = stringify(records);

            res.setHeader(
                'Content-Type',
                'text/csv; charset=utf-8'
            );

            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${viewName}.csv"`
            );

            return res.send('\uFEFF' + csv);
        }

        // PDF export
        const doc = new PDFDocument({
            size: 'A3',
            layout: 'landscape',
            margin: 30
        });

        res.setHeader('Content-Type', 'application/pdf');

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${viewName}.pdf"`
        );

        doc.on('error', error => {
            console.error('PDF error:', error.message);
            res.destroy(error);
        });

        doc.pipe(res);

        const left = 30;
        const width = doc.page.width - 60;
        const columnWidth = width / columns.length;

        let y = 30;

        function drawHeader() {
            doc.font('Helvetica-Bold')
                .fontSize(20)
                .fillColor('#222222')
                .text('StyleSlot Administrator Report', left, 30);

            doc.fontSize(12)
                .text(viewName, left, 58);

            doc.fontSize(9)
                .text(`Records: ${rows.length}`, left, 78);

            y = 105;

            doc.font('Helvetica-Bold').fontSize(9);

            const height = Math.max(
                30,
                ...columns.map(column =>
                    doc.heightOfString(column, {
                        width: columnWidth - 10
                    }) + 12
                )
            );

            columns.forEach((column, index) => {
                const x = left + index * columnWidth;

                doc.rect(x, y, columnWidth, height)
                    .fillAndStroke('#EEEEEE', '#AAAAAA');

                doc.fillColor('#222222')
                    .text(column, x + 5, y + 6, {
                        width: columnWidth - 10
                    });
            });

            y += height;
        }

        drawHeader();

        if (rows.length === 0) {
            doc.font('Helvetica')
                .fontSize(11)
                .text('No records found.', left, y + 15);
        }

        rows.forEach(row => {
            doc.font('Helvetica').fontSize(9);

            const height = Math.max(
                24,
                ...columns.map(column =>
                    doc.heightOfString(
                        displayValue(row[column]),
                        { width: columnWidth - 10 }
                    ) + 12
                )
            );

            if (y + height > doc.page.height - 30) {
                doc.addPage();
                drawHeader();
            }

            doc.font('Helvetica').fontSize(9);

            columns.forEach((column, index) => {
                const x = left + index * columnWidth;

                doc.rect(x, y, columnWidth, height)
                    .stroke('#AAAAAA');

                doc.fillColor('#222222')
                    .text(
                        displayValue(row[column]),
                        x + 5,
                        y + 6,
                        { width: columnWidth - 10 }
                    );
            });

            y += height;
        });

        doc.end();

    } catch (error) {
        handleError(res, error);
    }
});

// 5. SERVICE CRUD

const categories = [
    'Locs',
    'Braids',
    'Twists',
    'Colour',
    'Wig Install',
    'Treatment',
    'Cut'
];

const serviceFields = [
    {
        name: 'Name',
        label: 'Service Name',
        type: 'text',
        required: true,
        maxlength: 60
    },
    {
        name: 'Category',
        label: 'Category',
        type: 'select',
        required: true,
        options: categories.map(category => ({
            label: category,
            value: category
        }))
    },
    {
        name: 'Description',
        label: 'Description',
        type: 'textarea',
        required: false,
        maxlength: 300
    },
    {
        name: 'Requires_client_materials',
        label: 'Requires Client Materials',
        type: 'select',
        required: true,
        options: [
            { label: 'No', value: '0' },
            { label: 'Yes', value: '1' }
        ]
    },
    {
        name: 'Prep_instructions',
        label: 'Preparation Instructions',
        type: 'textarea',
        required: false,
        maxlength: 300
    }
];

function validateService(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        fail(400, 'Invalid service data');
    }

    const allowedFields = serviceFields.map(field => field.name);

    if (Object.keys(body).some(key => !allowedFields.includes(key))) {
        fail(400, 'Unknown or non-editable service field');
    }

    const {
        Name,
        Category,
        Description,
        Requires_client_materials,
        Prep_instructions
    } = body;

    if (typeof Name !== 'string' ||
        !Name.trim() ||
        Name.trim().length > 60) {
        fail(400, 'Service name must contain 1–60 characters');
    }

    if (!categories.includes(Category)) {
        fail(400, 'Invalid service category');
    }

    if (![0, 1, '0', '1'].includes(Requires_client_materials)) {
        fail(400, 'Requires client materials must be 0 or 1');
    }

    function optionalText(value, label) {
        if (value === undefined || value === null || value === '') {
            return null;
        }

        if (typeof value !== 'string' || value.length > 300) {
            fail(400, `${label} must not exceed 300 characters`);
        }

        return value.trim() || null;
    }

    return [
        Name.trim(),
        Category,
        optionalText(Description, 'Description'),
        Number(Requires_client_materials),
        optionalText(Prep_instructions, 'Preparation instructions')
    ];
}

function validateId(value) {
    const id = Number(value);

    if (!/^\d+$/.test(value) ||
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        id > 2147483647) {
        fail(400, 'Invalid service ID');
    }

    return id;
}

// GET all services
router.get('/services', async (req, res) => {
    try {
        const [rows, metadata] = await db.query(`
            SELECT * FROM SERVICE
            ORDER BY Service_id
        `);

        res.json({
            success: true,
            data: {
                columns: metadata.map(field => field.name),
                rows: rows.map(row => ({
                    ...row,
                    service_id: row.Service_id
                })),
                fields: serviceFields
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

// POST create service
router.post('/services', async (req, res) => {
    try {
        const values = validateService(req.body);

        const [result] = await db.execute(`
            INSERT INTO SERVICE (
                Name,
                Category,
                Description,
                Requires_client_materials,
                Prep_instructions
            )
            VALUES (?, ?, ?, ?, ?)
        `, values);

        res.status(201).json({
            success: true,
            data: {
                service_id: result.insertId
            },
            message: 'Service created successfully'
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'A service with this name already exists'
            });
        }

        handleError(res, error);
    }
});

// PUT update service
router.put('/services/:id', async (req, res) => {
    try {
        const id = validateId(req.params.id);
        const values = validateService(req.body);

        const [result] = await db.execute(`
            UPDATE SERVICE
            SET Name = ?,
                Category = ?,
                Description = ?,
                Requires_client_materials = ?,
                Prep_instructions = ?
            WHERE Service_id = ?
        `, [...values, id]);

        if (result.affectedRows === 0) {
            const [existing] = await db.execute(
                'SELECT Service_id FROM SERVICE WHERE Service_id = ?',
                [id]
            );

            if (!existing.length) {
                fail(404, 'Service not found');
            }
        }

        res.json({
            success: true,
            message: 'Service updated successfully'
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'A service with this name already exists'
            });
        }

        handleError(res, error);
    }
});

// DELETE service
router.delete('/services/:id', async (req, res) => {
    let connection;

    try {
        const id = validateId(req.params.id);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [services] = await connection.execute(`
            SELECT Service_id
            FROM SERVICE
            WHERE Service_id = ?
            FOR UPDATE
        `, [id]);

        if (!services.length) {
            fail(404, 'Service not found');
        }

        const [dependencies] = await connection.execute(`
            SELECT Variant_id
            FROM SERVICE_VARIANT
            WHERE Service_id = ?
            LIMIT 1
            FOR UPDATE
        `, [id]);

        if (dependencies.length) {
            fail(
                409,
                'Cannot delete this service because it has dependent service variants or appointments'
            );
        }

        await connection.execute(
            'DELETE FROM SERVICE WHERE Service_id = ?',
            [id]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Service deleted successfully'
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete a service with dependent records'
            });
        }

        handleError(res, error);

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;