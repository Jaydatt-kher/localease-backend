import crypto from "crypto";
export const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
export const hashOtp = (otp) => {
    return crypto.createHash("sha256").update(otp).digest("hex");
};
export const createOTPObject = () => {
    const otp = generateOtp();
    const hashedCode = hashOtp(otp);
    const expire = Date.now() + 5 * 60 * 1000;
    const cooldownExpire = Date.now() + 60 * 1000;
    const attempt = 5;
    return { otp, hashedCode, expire, cooldownExpire, attempt };
}
export const verifyOtp = (storedOtpData, enteredOtp) => {
    if (storedOtpData.attempt <= 0) {
        return { success: false, message: "Too many OTP attempts. Please request a new OTP." };
    }
    if (storedOtpData.expire < Date.now()) {
        return { success: false, message: "OTP has expired." };
    }
    if (storedOtpData.hashedCode !== hashOtp(enteredOtp)) {
        storedOtpData.attempt -= 1;
        return { success: false, message: "Invalid OTP." };
    }
    return { success: true, message: "OTP verified successfully." };
}