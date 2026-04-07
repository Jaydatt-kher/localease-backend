import twilio from "twilio";

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

export const sendSMSOtp = async (to, otp) => {
    await client.messages.create({
        body: `Your LocalEase OTP is ${otp}. Valid for 5 minutes. Do not share it with anyone.`,
        from: process.env.TWILIO_PHONE,
        to: `+91${to}`,
    });
};