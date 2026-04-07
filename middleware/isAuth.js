import jwt from "jsonwebtoken"
export const isAuth = async (req, res, next) => {
    try {
        const token = req.cookies.accessToken;
        if (!token) {
            console.warn("isAuth warning: Authentication denied. No token provided.");
            return res.status(401).json({ message: "Authentication denied. No token provided." })
        }
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
        req.user = decoded;
        req.userId = decoded.userId; req.role = decoded.role;
        next();
    } catch (error) {
        console.error("isAuth Error:", error);
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Session expired. Please log in again.",
                code: "TOKEN_EXPIRED"
            });
        }
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token. Authentication failed."
            });
        }
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};