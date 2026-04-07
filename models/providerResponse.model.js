import mongoose from "mongoose";

const providerResponseSchema = new mongoose.Schema({
    enquiry: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Enquiry",
        required: true
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceProvider",
        required: true
    },
    priceType: {
        type: String,
        enum: ["fixed", "inspection", "hourly"],
        default: "inspection"
    },
    price: {
        type: Number,
        default: null
    },

    availableTime: {
        type: Date
    },

    message: {
        type: String
    },

    status: {
        type: String,
        enum: [
            "pending",
            "responded",
            "accepted_by_user",
            "rejected_by_user"
        ],
        default: "pending"
    }

}, { timestamps: true });
providerResponseSchema.index({ enquiry: 1, provider: 1 });
providerResponseSchema.index({ status: 1 });
export const ProviderResponse = mongoose.model("ProviderResponse", providerResponseSchema);