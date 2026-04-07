import { Payment } from "../models/payment.model.js";
import Booking from "../models/booking.model.js";
import ServiceProvider from "../models/serviceProviders.model.js";
import { AdminSettings } from "../models/adminSettings.model.js";
import { WalletTransaction } from "../models/walletTransaction.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";
import dotenv from "dotenv";
dotenv.config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_dummy_key";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "rzp_test_dummy_secret";

const IS_MOCK_MODE = !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET;

if (IS_MOCK_MODE) {
    console.warn("[PaymentController] ⚠️  RAZORPAY_KEY_ID / KEY_SECRET not set. Running in MOCK mode — real Razorpay calls are skipped.");
}

const razorpayInstance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
});

const createRazorpayOrder = async (options) => {
    if (IS_MOCK_MODE) {
        return {
            id: `order_MOCK_${Date.now()}`,
            amount: options.amount,
            currency: options.currency || "INR",
            receipt: options.receipt
        };
    }
    return razorpayInstance.orders.create(options);
};

const getSettings = async () => {
    const s = await AdminSettings.findOne();
    return {
        platformCommissionRate: s?.platformCommissionRate ?? 0.10,
        minWalletBalance: s?.minWalletBalance ?? 100,
        cashOnServiceThreshold: s?.cashOnServiceThreshold ?? 5000
    };
};

const logWalletTx = async ({
    provider, booking = null, amount, transactionType, purpose, description, closingBalance, razorpayPayoutId = null
}) => {
    await WalletTransaction.create({
        provider, booking, amount, transactionType, purpose, description, closingBalance, razorpayPayoutId
    });
};

export const getPublicAdminSettings = async (req, res) => {
    try {
        const settings = await getSettings();
        return res.status(200).json({ success: true, data: settings });
    } catch (error) {
        console.error("getPublicAdminSettings error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const initiatePayment = async (req, res) => {
    try {
        const userId = req.userId;
        const { bookingId, completeOtp, paymentMethod } = req.body;

        if (!bookingId || !completeOtp || !paymentMethod) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        const booking = await Booking.findOne({ _id: bookingId, user: userId })
            .populate("provider")
            .populate("service");

        if (!booking)
            return res.status(404).json({ success: false, message: "Booking not found." });

        if (booking.bookingStatus !== "in_progress")
            return res.status(400).json({ success: false, message: `Booking status is '${booking.bookingStatus}', cannot pay.` });

        if (!booking.completedOtp?.code)
            return res.status(400).json({ success: false, message: "Job is not marked complete by provider." });

        const isMatch = await bcrypt.compare(completeOtp, booking.completedOtp.code);
        if (!isMatch)
            return res.status(400).json({ success: false, message: "Invalid Complete OTP." });

        const amount = booking.finalAmount || booking.quotedPrice;
        if (!amount)
            return res.status(400).json({ success: false, message: "Final amount is not set for this booking." });

        const { platformCommissionRate, cashOnServiceThreshold } = await getSettings();

        if (paymentMethod === "cash_on_service" && amount >= cashOnServiceThreshold) {
            return res.status(400).json({
                success: false,
                message: `Bookings of ₹${amount} or above must be paid online. Cash on Service is only allowed for amounts below ₹${cashOnServiceThreshold}.`
            });
        }

        const platformCommission = parseFloat((amount * platformCommissionRate).toFixed(2));
        const providerEarning = parseFloat((amount - platformCommission).toFixed(2));

        if (paymentMethod === "cash_on_service") {
            const payment = await Payment.create({
                booking: bookingId,
                user: userId,
                provider: booking.provider._id,
                amount,
                paymentMethod: "cash_on_service",
                paymentStatus: "completed",
                platformCommission,
                providerEarning
            });

            booking.bookingStatus = "completed";
            booking.completedAt = new Date();
            booking.payment = payment._id;
            booking.completedOtp.isUsed = true;
            await booking.save();

            const updatedProvider = await ServiceProvider.findByIdAndUpdate(
                booking.provider._id,
                { $inc: { completedJobs: 1, walletBalance: -platformCommission } },
                { new: true }
            );

            await logWalletTx({
                provider: booking.provider._id,
                booking: bookingId,
                amount: platformCommission,
                transactionType: "debit",
                purpose: "commission_deduction",
                description: `Platform commission (${(platformCommissionRate * 100).toFixed(0)}%) deducted for booking ${booking.bookingId}`,
                closingBalance: updatedProvider.walletBalance
            });

            return res.status(200).json({
                success: true,
                message: "Payment complete via Cash on Service.",
                data: {
                    paymentId: payment._id,
                    walletBalance: updatedProvider.walletBalance
                }
            });
        }

        if (paymentMethod === "online") {
            const options = {
                amount: Math.round(amount * 100),
                currency: "INR",
                receipt: `rcpt_${booking._id}`
            };

            if (booking.provider.razorpayLinkedAccountId) {
                options.transfers = [
                    {
                        account: booking.provider.razorpayLinkedAccountId,
                        amount: Math.round(providerEarning * 100),
                        currency: "INR",
                        notes: { bookingId: booking._id.toString(), purpose: "service_payment" }
                    }
                ];
            }

            const order = await createRazorpayOrder(options);

            const payment = await Payment.create({
                booking: bookingId,
                user: userId,
                provider: booking.provider._id,
                amount,
                paymentMethod: "online",
                paymentStatus: "pending",
                transactionId: order.id,
                platformCommission,
                providerEarning
            });

            booking.payment = payment._id;
            booking.completedOtp.isUsed = true;
            await booking.save();

            return res.status(200).json({
                success: true,
                message: IS_MOCK_MODE
                    ? "[MOCK] Order simulated — no real payment taken."
                    : "Razorpay order created. Please complete payment.",
                data: {
                    orderId: order.id,
                    amount: order.amount,
                    currency: order.currency,
                    paymentId: payment._id,
                    keyId: RAZORPAY_KEY_ID,
                    isMock: IS_MOCK_MODE
                }
            });
        }

        return res.status(400).json({ success: false, message: "Invalid payment method." });

    } catch (error) {
        console.error("initiatePayment error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            paymentId
        } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "rzp_test_dummy_secret")
            .update(body)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid payment signature." });
        }

        const payment = await Payment.findById(paymentId);
        if (!payment)
            return res.status(404).json({ success: false, message: "Payment record not found." });

        payment.paymentStatus = "completed";
        payment.transactionId = razorpay_payment_id;
        await payment.save();

        const booking = await Booking.findById(payment.booking);
        booking.bookingStatus = "completed";
        booking.completedAt = new Date();
        await booking.save();

        const updatedProvider = await ServiceProvider.findByIdAndUpdate(
            booking.provider,
            { $inc: { completedJobs: 1 } },
            { new: true }
        );

        await logWalletTx({
            provider: booking.provider,
            booking: booking._id,
            amount: payment.providerEarning,
            transactionType: "credit",
            purpose: "platform_payout",
            description: `Online payment routed to bank for booking ${booking.bookingId}`,
            closingBalance: updatedProvider.walletBalance
        });

        return res.status(200).json({
            success: true,
            message: "Payment verified and booking completed.",
            data: {
                paymentId: payment._id,
                bookingId: booking._id
            }
        });

    } catch (error) {
        console.error("verifyPayment error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getProviderPayments = async (req, res) => {
    try {
        const userId = req.userId;
        const provider = await ServiceProvider.findOne({ userId });
        if (!provider)
            return res.status(404).json({ success: false, message: "Provider not found." });

        const payments = await Payment.find({ provider: provider._id })
            .populate({ path: "booking", select: "bookingId service", populate: { path: "service", select: "name" } })
            .populate("user", "fullName")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: payments });
    } catch (error) {
        console.error("getProviderPayments error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getWalletTransactions = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 20 } = req.query;

        const provider = await ServiceProvider.findOne({ userId });
        if (!provider)
            return res.status(404).json({ success: false, message: "Provider not found." });

        const skip = (Number(page) - 1) * Number(limit);
        const total = await WalletTransaction.countDocuments({ provider: provider._id });

        const transactions = await WalletTransaction.find({ provider: provider._id })
            .populate("booking", "bookingId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        return res.status(200).json({
            success: true,
            data: {
                walletBalance: provider.walletBalance,
                transactions,
                pagination: {
                    total,
                    totalPages: Math.ceil(total / Number(limit)),
                    currentPage: Number(page)
                }
            }
        });
    } catch (error) {
        console.error("getWalletTransactions error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const rechargeWallet = async (req, res) => {
    try {
        const userId = req.userId;
        const { amount } = req.body;

        if (!amount || Number(amount) <= 0)
            return res.status(400).json({ success: false, message: "Please provide a valid amount greater than 0." });

        const provider = await ServiceProvider.findOne({ userId });
        if (!provider)
            return res.status(404).json({ success: false, message: "Provider not found." });

        const ts = Date.now().toString().slice(-8);
        const pid = provider._id.toString().slice(-8);
        const order = await createRazorpayOrder({
            amount: Math.round(Number(amount) * 100),
            currency: "INR",
            receipt: `rch_${pid}_${ts}`
        });

        return res.status(200).json({
            success: true,
            message: IS_MOCK_MODE ? "[MOCK] Recharge order simulated." : "Recharge order created.",
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: RAZORPAY_KEY_ID,
                isMock: IS_MOCK_MODE
            }
        });
    } catch (error) {
        console.error("rechargeWallet error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyRecharge = async (req, res) => {
    try {
        const userId = req.userId;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

        if (!IS_MOCK_MODE) {
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac("sha256", RAZORPAY_KEY_SECRET)
                .update(body)
                .digest("hex");

            if (expectedSignature !== razorpay_signature)
                return res.status(400).json({ success: false, message: "Invalid recharge signature." });
        }

        const rechargeAmount = Number(amount);

        const provider = await ServiceProvider.findOneAndUpdate(
            { userId },
            { $inc: { walletBalance: rechargeAmount } },
            { new: true }
        );

        await logWalletTx({
            provider: provider._id,
            amount: rechargeAmount,
            transactionType: "credit",
            purpose: "wallet_recharge",
            description: `Wallet recharged via Razorpay (ID: ${razorpay_payment_id})`,
            closingBalance: provider.walletBalance
        });

        return res.status(200).json({
            success: true,
            message: `₹${rechargeAmount} credited to your wallet.`,
            walletBalance: provider.walletBalance
        });
    } catch (error) {
        console.error("verifyRecharge error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const initiateWithdrawal = async (req, res) => {
    try {
        const userId = req.userId;
        const { amount } = req.body;

        if (!amount || Number(amount) <= 0)
            return res.status(400).json({ success: false, message: "Please provide a valid withdrawal amount." });

        const withdrawAmount = Number(amount);

        const provider = await ServiceProvider.findOne({ userId });
        if (!provider)
            return res.status(404).json({ success: false, message: "Provider not found." });

        const { minWalletBalance } = await getSettings();

        if (provider.walletBalance < withdrawAmount)
            return res.status(400).json({ success: false, message: `Insufficient wallet balance. Your balance is ₹${provider.walletBalance}.` });

        if ((provider.walletBalance - withdrawAmount) < 0) {
            return res.status(400).json({
                success: false,
                message: `You cannot withdraw this amount. Wallet would go negative.`
            });
        }

        const updatedProvider = await ServiceProvider.findByIdAndUpdate(
            provider._id,
            { $inc: { walletBalance: -withdrawAmount } },
            { new: true }
        );

        const simulatedPayoutId = `pout_test_${Date.now()}`;

        await logWalletTx({
            provider: provider._id,
            amount: withdrawAmount,
            transactionType: "debit",
            purpose: "wallet_withdrawal",
            description: `Wallet withdrawal of ₹${withdrawAmount} (Test Mode — Payout: ${simulatedPayoutId})`,
            closingBalance: updatedProvider.walletBalance,
            razorpayPayoutId: simulatedPayoutId
        });

        return res.status(200).json({
            success: true,
            message: `₹${withdrawAmount} withdrawal processed (Test Mode).`,
            walletBalance: updatedProvider.walletBalance,
            payoutId: simulatedPayoutId
        });
    } catch (error) {
        console.error("initiateWithdrawal error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const downloadReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await Payment.findById(id)
            .populate("booking", "bookingId scheduledTime")
            .populate("user", "fullName email mobileNo")
            .populate("provider", "businessName");

        if (!payment)
            return res.status(404).json({ success: false, message: "Payment not found." });

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader("Content-Disposition", `attachment; filename="Receipt_${payment._id}.pdf"`);
        res.setHeader("Content-Type", "application/pdf");
        doc.pipe(res);

        doc.fontSize(22).font("Helvetica-Bold").text("LocalEase", { align: "center" });
        doc.fontSize(11).font("Helvetica").fillColor("#666666").text("Official Payment Receipt", { align: "center" });
        doc.moveDown(1.5);

        const statusColor = payment.paymentStatus === "completed" ? "#16a34a" : "#d97706";
        doc.fontSize(12).font("Helvetica-Bold").fillColor(statusColor)
            .text(`Status: ${payment.paymentStatus.toUpperCase()}`, { align: "center" });
        doc.moveDown(1);
        doc.fillColor("#000000");

        const row = (label, value) => {
            doc.fontSize(10).font("Helvetica-Bold").text(`${label}: `, { continued: true });
            doc.font("Helvetica").text(value || "N/A");
        };

        row("Receipt ID", `${payment._id}`);
        row("Booking ID", payment.booking?.bookingId || "—");
        row("Date", new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }));
        row("Payment Method", payment.paymentMethod === "online" ? "Online (Razorpay)" : "Cash on Service");
        row("Transaction ID", payment.transactionId || "N/A");
        doc.moveDown(0.8);

        row("Customer", payment.user?.fullName);
        row("Service Provider", payment.provider?.businessName);
        doc.moveDown(0.8);

        doc.fontSize(11).font("Helvetica-Bold").text("Financial Breakdown");
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#e5e7eb");
        doc.moveDown(0.5);

        row("Total Amount Paid", `Rs. ${payment.amount?.toLocaleString("en-IN")}`);
        row("Platform Commission", `Rs. ${payment.platformCommission?.toLocaleString("en-IN")}`);
        row("Provider Earning", `Rs. ${payment.providerEarning?.toLocaleString("en-IN")}`);

        doc.moveDown(2);
        doc.fontSize(9).font("Helvetica").fillColor("#666666")
            .text("This is a system-generated receipt and does not require a signature.", { align: "center" });
        doc.text("Thank you for using LocalEase!", { align: "center" });

        doc.end();

    } catch (error) {
        console.error("downloadReceipt error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
