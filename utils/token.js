import jwt from "jsonwebtoken";

const generateTokens = (userId, role) => {
    try {
        const accessToken = jwt.sign(
            { userId, role },
            process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const refreshToken = jwt.sign(
            { userId, role },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Token generation error:", error);
        throw new Error("Failed to generate tokens");
    }
};

export default generateTokens;