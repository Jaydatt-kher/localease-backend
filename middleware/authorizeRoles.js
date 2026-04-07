export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access denied. ${req.user.role}s are not permitted to access this resource.`
            });
        }
        req.userId = req.user.userId;
        next();
    };
};