import express from "express";
import { changePassword, googleAuth, resetPassword, resetPasswordOtp, sendOtpEmail, sendOtpMobile, signIn, signOut, signUp, verifyOtpEmail, verifyOtpMobile, verifyResetPasswordOtp, refreshAccessToken } from "../controllers/auth.controller.js";
import { isAuth } from "../middleware/isAuth.js"
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import { loginLimiter, registerLimiter, otpLimiter } from "../middleware/rateLimiter.js";
const authRouter = express.Router();
authRouter.post("/signup", registerLimiter, signUp);
authRouter.post("/signin", loginLimiter, signIn);
authRouter.post("/verify-otp-email", otpLimiter, verifyOtpEmail);
authRouter.post("/resend-otp-email", otpLimiter, sendOtpEmail);
authRouter.post("/google-auth", loginLimiter, googleAuth);
authRouter.patch("/reset-password", otpLimiter, resetPassword);
authRouter.post("/reset-password-otp", otpLimiter, resetPasswordOtp);
authRouter.post("/verify-reset-password-otp", otpLimiter, verifyResetPasswordOtp);
authRouter.post("/signout", signOut);
authRouter.post("/refresh-token", refreshAccessToken);
authRouter.patch("/change-password", isAuth, authorizeRoles("customer", "serviceProvider"), changePassword)
authRouter.post("/send-otp-mobile", isAuth, authorizeRoles("customer", "serviceProvider"), otpLimiter, sendOtpMobile);
authRouter.post("/verify-otp-mobile", isAuth, authorizeRoles("customer", "serviceProvider"), otpLimiter, verifyOtpMobile);
export default authRouter;