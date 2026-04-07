import cookieParser from "cookie-parser";
import { globalApiLimiter } from "./middleware/rateLimiter.js";
import dotenv from "dotenv";
import express from "express";
import cors from "cors"
import connectDb from "./configs/db.js";
import authRouter from "./routes/auth.route.js";
import adminRouter from "./routes/admin.route.js";
import serviceProviderRouter from "./routes/serviceProvider.route.js";
import customerRouter from "./routes/customer.route.js";
import notificationRouter from "./routes/notification.route.js";
import paymentRouter from "./routes/payment.routes.js";
dotenv.config();
const PORT = process.env.PORT || 3000;
connectDb();
const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));

app.use("/api", globalApiLimiter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/customer", customerRouter)
app.use("/api/provider", serviceProviderRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/payments", paymentRouter);
app.listen(PORT, () => {
})