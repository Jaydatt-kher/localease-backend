import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceProvider",
        required: true
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        default: null
    },
    amount: {
        type: Number,
        required: true
    },
    transactionType: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    purpose: {
        type: String,
        enum: [
            'commission_deduction', 'platform_payout', 'wallet_recharge', 'wallet_withdrawal', 'refund_penalty'],
        required: true
    },
    description: {
        type: String, required: true
    },
    razorpayPayoutId: {
        type: String,
        default: null
    },
    closingBalance: {
        type: Number,
        required: true
    }
}, { timestamps: true });

walletTransactionSchema.index({ provider: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);