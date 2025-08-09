const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({
            status: 401,
            success: false,
            message: 'Not authorized, no token'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user || user.tenantId.toString() !== req.tenant._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this tenant.' });
        }

        const tokenIssuedAt = decoded.iat;

        if (user.passwordChangedAt) {
            const passwordChangedAt = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
            if (tokenIssuedAt < passwordChangedAt) {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Token expired due to password change.'
                });
            }
        }

        if (user.lastLoginAt) {
            const lastLoginAt = parseInt(user.lastLoginAt.getTime() / 1000, 10);
            if (tokenIssuedAt < lastLoginAt) {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Token expired due to new login.'
                });
            }
        }

        req.user = user;
        next();
    } catch (error) {
        console.error(error);
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: `User role ${req.user.role} is not authorized to access this route` });
        }
        next();
    };
};

module.exports = { protect, authorizeRoles };
