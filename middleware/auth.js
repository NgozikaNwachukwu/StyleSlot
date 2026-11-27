const db = require('../db/connection');

// Require a logged-in user
async function requireAuth(req, res, next) {

    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }

    try {

        const [users] = await db.query(
            `SELECT User_id, First_name, Last_name, Email, Role
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

        req.user = users[0];

        next();

    } catch (error) {

        console.error('Authentication error:', error.code);

        return res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
}

// Require an administrator
function requireAdmin(req, res, next) {

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }

    if (req.user.Role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Administrator access required'
        });
    }

    next();
}

// Require a customer account
function requireClient(req, res, next) {

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }

    if (req.user.Role !== 'client') {
        return res.status(403).json({
            success: false,
            message: 'Customer access required'
        });
    }

    next();
}

module.exports = {
    requireAuth,
    requireAdmin,
    requireClient
};