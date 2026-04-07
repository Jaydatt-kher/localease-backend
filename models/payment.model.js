import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceProvider",
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ["cash_on_service", "online"],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending"
    },
    transactionId: {
        type: String, default: null
    },
    invoiceUrl: {
        type: String,
        default: null
    },
    platformCommission: {
        type: Number,
        default: 0
    },
    providerEarning: {
        type: Number,
        default: 0
    },
    refund: {
        status: {
            type: String,
            enum: ['na', 'requested', 'processed', 'declined'],
            default: 'na'
        },
        amount: { type: Number, default: 0 },
        reason: { type: String, default: null }
    }
}, { timestamps: true });

paymentSchema.index({ booking: 1 });
paymentSchema.index({ provider: 1, paymentStatus: 1 });

export const Payment = mongoose.model("Payment", paymentSchema);