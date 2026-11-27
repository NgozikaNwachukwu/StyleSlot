const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db/connection');

const router = express.Router();

// Format database user for the frontend
function formatUser(user) {
    return {
        user_id: user.User_id,
        full_name: `${user.First_name} ${user.Last_name}`.trim(),
        email: user.Email,
        role: user.Role === 'client' ? 'user' : user.Role
    };
}

// Handle validation errors
function validateRequest(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: errors.array()[0].msg
        });
    }

    next();
}

// POST /api/auth/register
router.post('/register', [

    body('full_name')
        .isString()
        .bail()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Please enter a valid full name')
        .matches(/\S+\s+\S+/)
        .withMessage('Please enter your first and last name'),

    body('email')
        .isString()
        .bail()
        .trim()
        .isEmail()
        .withMessage('Please enter a valid email address')
        .bail()
        .customSanitizer(value => value.toLowerCase()),

    body('phone')
        .isString()
        .bail()
        .trim()
        .matches(/^\+?[0-9]{10,15}$/)
        .withMessage('Please enter a valid phone number'),

    body('password')
        .isString()
        .bail()
        .isLength({ min: 8 })
        .withMessage('Password must contain at least 8 characters')
        .bail()
        .custom(value => Buffer.byteLength(value, 'utf8') <= 72)
        .withMessage('Password is too long'),

    validateRequest

], async (req, res) => {

    let connection;

    try {
        const { full_name, email, phone, password } = req.body;

        const nameParts = full_name.trim().split(/\s+/);
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ');

        const [existingUsers] = await db.query(
            'SELECT User_id FROM USER_ACCOUNT WHERE Email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        connection = await db.getConnection();

        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO USER_ACCOUNT
                (Email, Password_hash, First_name,
                 Last_name, Phone, Role)
             VALUES (?, ?, ?, ?, ?, 'client')`,
            [
                email,
                passwordHash,
                firstName,
                lastName,
                phone
            ]
        );

        // Create the corresponding client record
        await connection.query(
            'INSERT INTO CLIENT (Client_id) VALUES (?)',
            [result.insertId]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: 'Account created successfully'
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists'
            });
        }

        console.error('Registration error:', error.code);

        return res.status(500).json({
            success: false,
            message: 'Failed to create account'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});


// POST /api/auth/login
router.post('/login', [

    body('email')
        .isString()
        .bail()
        .trim()
        .isEmail()
        .withMessage('Please enter a valid email address')
        .bail()
        .customSanitizer(value => value.toLowerCase()),

    body('password')
        .isString()
        .bail()
        .notEmpty()
        .withMessage('Password is required')
        .bail()
        .custom(value => Buffer.byteLength(value, 'utf8') <= 72)
        .withMessage('Password is too long'),

    validateRequest

], async (req, res) => {

    try {
        const { email, password } = req.body;

        const [users] = await db.query(
            `SELECT User_id, First_name, Last_name,
                    Email, Password_hash, Role
             FROM USER_ACCOUNT
             WHERE Email = ?`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.Password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Regenerate session to prevent session fixation
        req.session.regenerate((error) => {

            if (error) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create session'
                });
            }

            req.session.userId = user.User_id;

            req.session.save((error) => {

                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to save session'
                    });
                }

                return res.json({
                    success: true,
                    data: {
                        user: formatUser(user)
                    }
                });
            });
        });

    } catch (error) {

        console.error('Login error:', error.code);

        return res.status(500).json({
            success: false,
            message: 'Failed to log in'
        });
    }
});


// GET /api/auth/me
router.get('/me', async (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }

    try {

        const [users] = await db.query(
            `SELECT User_id, First_name,
                    Last_name, Email, Role
             FROM USER_ACCOUNT
             WHERE User_id = ?`,
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User account not found'
            });
        }

        return res.json({
            success: true,
            data: {
                user: formatUser(users[0])
            }
        });

    } catch (error) {

        console.error('Current user error:', error.code);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve current user'
        });
    }
});


// POST /api/auth/logout
router.post('/logout', (req, res) => {

    req.session.destroy((error) => {

        if (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to log out'
            });
        }

        res.clearCookie('styleslot.sid', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });

        return res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});


module.exports = router;