import rateLimit from "express-rate-limit";

const createMessage = (msg) => ({ success: false, message: msg });

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, max: 5,
  message: createMessage("Too many login attempts. Please try again after a minute."),
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: createMessage("Too many accounts created from this IP. Please try again later."),
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: createMessage("Too many OTP/reset requests. Please wait a minute before trying again."),
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: createMessage("Too many payment requests. Please try again later."),
});

export const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: createMessage("Too many actions performed. Please slow down."),
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: createMessage("Too many search requests. Please wait a moment."),
});

export const servicesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: createMessage("Too many requests for generic data. Please slow down."),
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: createMessage("Too many file uploads. Please wait a moment."),
});

export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, message: createMessage("Too many requests from this IP, please try again after a minute."),
});
