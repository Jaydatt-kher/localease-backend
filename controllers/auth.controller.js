import crypto from "crypto";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import generateTokens from "../utils/token.js";
import jwt from "jsonwebtoken";
import { sendMailOtp } from "../utils/mail.js";
import { createOTPObject, verifyOtp } from "../utils/otp.js";
import { sendSMSOtp } from "../utils/twilio.js";
const generateRefferalCode = async () => {
    let code;
    let exists = true;
    while (exists) {
        code = crypto.randomBytes(4).toString("hex");
        exists = await User.findOne({ referralCode: code });
    }
    return code;
}
export const signUp = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exits" });
        }
        if (password.length < 6 || password.length > 16) {
            return res.status(400).json({
                message: "Password must be between 6 to 16 characters"
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const otpData = createOTPObject();

        const newUser = await User.create({
            fullName,
            email: email.toLowerCase(),
            password: hashedPassword,
            otpDetails: {
                email: {
                    hashedCode: otpData.hashedCode,
                    expire: otpData.expire,
                    cooldownExpire: otpData.cooldownExpire,
                    attempt: otpData.attempt
                }
            },
            referralCode: await generateRefferalCode()
        });
        await sendMailOtp(email, otpData.otp);

        const userResponse = {
            _id: newUser._id,
            fullName: newUser.fullName,
            email: newUser.email,
            mobileNo: newUser.mobileNo,
            photoUrl: newUser.photoUrl,
            role: newUser.role,
            referralCode: newUser.referralCode,
            isMobileVerified: newUser.isMobileVerified,
            isEmailVerified: newUser.isEmailVerified,
            otpAttempt: newUser.otpAttempt,
        }
        return res.status(201).json({ message: "Signup successful. Please verify OTP sent to email.", userResponse });

    } catch (error) {
        console.error("signUp Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const signIn = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: "User not exists" });
        }
        const isMatched = await bcrypt.compare(password, user.password);
        if (!isMatched) {
            console.warn(`signIn warning: Invalid credentials for ${email}`);
            return res.status(401).json({ message: "Invalid Email or Password" });
        }
        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Please verify your email first"
            });
        }
        const { accessToken, refreshToken } = generateTokens(user._id, user.role);
        user.refreshTokens.push(refreshToken);
        await user.save();

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: 15 * 60 * 1000
        });
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        const userResponse = {
            _id: user._id,
            fullName: user.fullName,
            mobileNo: user.mobileNo,
            email: user.email,
            photoUrl: user.photoUrl,
            role: user.role,
            loyaltyPoints: user.loyaltyPoints,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified
        };

        return res.status(200).json({ message: "User signIn successfully!", userResponse });

    } catch (error) {
        console.error("signIn Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const signOut = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            const user = await User.findOne({ refreshTokens: refreshToken });
            if (user) {
                user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
                await user.save();
            }
        }
        res.clearCookie("accessToken", { httpOnly: true, secure: false, sameSite: "strict" });
        res.clearCookie("refreshToken", { httpOnly: true, secure: false, sameSite: "strict" });
        return res.status(200).json({ message: "User signOut successfully" })
    } catch (error) {
        console.error("signOut Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const sendOtpEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                message: "Email are required!"
            })
        }
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({ message: "User not exists" })
        }
        if (user.otpDetails.email.cooldownExpire > Date.now()) {
            return res.status(400).json({
                message: "Please wait for 1 minute before requesting new OTP"
            });
        }
        const otpData = createOTPObject();
        user.otpDetails.email = {
            hashedCode: otpData.hashedCode,
            expire: otpData.expire,
            cooldownExpire: otpData.cooldownExpire,
            attempt: otpData.attempt
        };

        await user.save();
        await sendMailOtp(user.email, otpData.otp);
        return res.status(200).json({
            message: "OTP sent successfully to your email "
        });

    } catch (error) {
        console.error("sendOtp Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const verifyOtpEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        };
        const storedOtpData = user.otpDetails.email;
        if (!storedOtpData) {
            return res.status(404).json({ message: "OTP data not found. Please request a new OTP." });
        };
        const { success, message } = verifyOtp(storedOtpData, otp);
        if (!success) {
            await user.save(); return res.status(400).json({ message });
        }
        user.isEmailVerified = true;
        user.otpDetails.email = undefined; await user.save();
        return res.status(200).json({
            message: "OTP verified Successfully",
            isEmailVerified: user.isEmailVerified
        });
    } catch (error) {
        console.error("verifyOtpEmail Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const googleAuth = async (req, res) => {
    try {
        const { fullName, email, photoUrl } = req.body;
        let user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            user = await User.create({
                fullName,
                email: email.toLowerCase(),
                photoUrl: photoUrl || null,
                isEmailVerified: true
            });
        } else if (photoUrl && !user.photoUrl) {
            user.photoUrl = photoUrl;
            await user.save();
        }
        const { accessToken, refreshToken } = generateTokens(user._id, user.role);
        user.refreshTokens.push(refreshToken);
        await user.save();

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: false,
            maxAge: 15 * 60 * 1000
        });
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        const userResponse = {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            mobileNo: user.mobileNo,
            photoUrl: user.photoUrl,
            role: user.role,
            loyaltyPoints: user.loyaltyPoints,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified
        }
        return res.status(200).json({ message: "User signin successfull", user: userResponse });
    } catch (error) {
        console.error("googleAuth Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) {
            return res.status(400).json({
                message: "Email and new password are required!"
            });
        }
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const samePassword = await bcrypt.compare(newPassword, user.password);
        if (samePassword) {
            return res.status(400).json({ message: "New password must be different from the old password" });
        }
        user.password = hashedPassword;
        await user.save();
        return res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("resetPassword Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const resetPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                message: "Email is required!"
            })
        }
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.otpDetails.resetPasswordOtp.cooldownExpire > Date.now()) {
            return res.status(400).json({
                message: "Please wait for 1 minute before requesting new OTP"
            });
        }
        const otpData = createOTPObject();
        user.otpDetails.resetPasswordOtp = {
            hashedCode: otpData.hashedCode,
            expire: otpData.expire,
            cooldownExpire: otpData.cooldownExpire,
            attempt: otpData.attempt
        };
        await user.save();
        await sendMailOtp(user.email, otpData.otp);
        return res.status(200).json({
            message: "OTP sent successfully to your email "
        });
    } catch (error) {
        console.error("resetPasswordOtp Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const verifyResetPasswordOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const storedOtpData = user.otpDetails.resetPasswordOtp;
        if (!storedOtpData) {
            return res.status(404).json({ message: "OTP data not found. Please request a new OTP." });
        }
        const { success, message } = verifyOtp(storedOtpData, otp);
        if (!success) {
            await user.save(); return res.status(400).json({ message });
        }
        user.otpDetails.resetPasswordOtp = undefined; await user.save();
        return res.status(200).json({
            message: "OTP verified Successfully",
        });
    } catch (error) {
        console.error("verifyResetPasswordOtp Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const changePassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Please provide both old and new passwords" });
        }
        const user = await User.findOne({ _id: userId, status: "active" });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }
        const compareOldPassword = await bcrypt.compare(oldPassword, user.password);
        if (!compareOldPassword) {
            return res.status(400).json({ success: false, message: "Password not matched" })
        }
        const compareNewPassword = await bcrypt.compare(newPassword, user.password);
        if (compareNewPassword) {
            return res.status(400).json({ success: false, message: "New password cannot be the same as the old password" })
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        })
    } catch (error) {
        console.error("changePassword Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const sendOtpMobile = async (req, res) => {
    try {
        const userId = req.userId; const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (!user.mobileNo) {
            return res.status(400).json({ success: false, message: "Please update your profile with a mobile number first." });
        }

        if (!user.otpDetails) user.otpDetails = {};
        if (!user.otpDetails.phone) user.otpDetails.phone = {};

        if (user.otpDetails.phone.cooldownExpire > Date.now()) {
            return res.status(400).json({
                success: false,
                message: "Please wait for 1 minute before requesting new OTP"
            });
        }

        const otpData = createOTPObject();
        user.otpDetails.phone = {
            hashedCode: otpData.hashedCode,
            expire: otpData.expire,
            cooldownExpire: otpData.cooldownExpire,
            attempt: otpData.attempt
        };

        await user.save();
        await sendSMSOtp(user.mobileNo, otpData.otp);
        return res.status(200).json({
            success: true,
            message: "OTP sent successfully to your mobile number."
        });
    } catch (error) {
        console.error("sendOtpMobile Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const verifyOtpMobile = async (req, res) => {
    try {
        const userId = req.userId;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ success: false, message: "OTP is required" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const storedOtpData = user.otpDetails?.phone;
        if (!storedOtpData || !storedOtpData.hashedCode) {
            return res.status(404).json({ success: false, message: "OTP data not found. Please request a new OTP." });
        }

        const { success, message } = verifyOtp(storedOtpData, otp);
        if (!success) {
            await user.save(); return res.status(400).json({ success: false, message });
        }

        user.isMobileVerified = true;
        user.otpDetails.phone = undefined; await user.save();

        return res.status(200).json({
            success: true,
            message: "Mobile number verified successfully!",
            isMobileVerified: user.isMobileVerified
        });
    } catch (error) {
        console.error("verifyOtpMobile Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const refreshAccessToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            console.warn("refreshAccessToken warning: No refresh token provided");
            return res.status(401).json({ message: "No refresh token provided" });
        }

        const user = await User.findOne({ refreshTokens: refreshToken });
        if (!user) {
            console.warn("refreshAccessToken warning: Invalid refresh token attempt");
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                await User.findByIdAndUpdate(user._id, {
                    $pull: { refreshTokens: refreshToken }
                });
                return res.status(401).json({ message: "Expired or invalid refresh token" });
            }

            const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, user.role);

            await User.findByIdAndUpdate(user._id, {
                $pull: { refreshTokens: refreshToken }
            });
            await User.findByIdAndUpdate(user._id, {
                $push: { refreshTokens: newRefreshToken }
            });

            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: false,
                sameSite: "strict",
                maxAge: 15 * 60 * 1000
            });
            res.cookie("refreshToken", newRefreshToken, {
                httpOnly: true,
                secure: false,
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.status(200).json({ message: "Token refreshed successfully" });
        });
    } catch (error) {
        console.error("refreshAccessToken Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};