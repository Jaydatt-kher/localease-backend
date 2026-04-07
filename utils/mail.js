import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
const transporter = nodemailer.createTransport({
  service: "Gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASS
  }
});
export const sendMailOtp = async (to, otp) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL,
      to,
      subject: "Email Validation",
      html: `
       <div style="font-family: Arial, sans-serif; padding:20px;">
        <h2 style="color:#333;">OTP Verification</h2>
        <p>Your verification code is:</p>

          <div style="font-size:24px; font-weight:bold; background:#f4f4f4; padding:10px 20px;display:inline-block; border-radius:6px; letter-spacing:3px; color:#2E86C1;"> ${otp} </div>
          <p style="margin-top:15px; color:#555;">This code expires in <b>5 minutes</b>.</p>
      </div>`
    });
  } catch (error) {
    console.error("Error in sendMailOtp:", error);
  }
};