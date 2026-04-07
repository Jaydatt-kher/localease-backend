import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        unique: true,
        required: true
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceProvider",
        required: true
    },
    providerResponse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProviderResponse",
        required: true
    },
    enquiry: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Enquiry",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true
    },
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
    },
    offerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Offer",
        default: null
    },
    scheduledTime: {
        type: Date,
        required: true
    },
    bookingStatus: {
        type: String,
        enum: ['confirmed', 'in_progress', 'completed', 'cancelled'],
        default: 'confirmed',
        required: true
    },

    priceType: {
        type: String,
        enum: ["fixed", "hourly", "inspection"],
        default: "inspection",
        required: true
    },
    quotedPrice: {
        type: Number,
        default: null
    },
    hoursWorked: {
        type: Number,
        default: null
    },
    finalAmount: {
        type: Number,
        default: null
    },

    bookingAddress: {
        text: { type: String, required: true },
        latitude: Number,
        longitude: Number
    },
    dispute: {
        isRaised: { type: Boolean, default: false },
        reason: String,
        status: { type: String, enum: ['open', 'resolved', 'refund_processed', 'closed'], default: 'open' },
        adminComment: String
    },
    complaints: {
        type: String,
        default: null
    },
    startOtp: {
        code: { type: String, default: null },
        expires: { type: Date, default: null },
        isUsed: { type: Boolean, default: false }
    },
    completedOtp: {
        code: { type: String, default: null },
        expires: { type: Date, default: null },
        isUsed: { type: Boolean, default: false }
    },
    completedAt: {
        type: Date,
        default: null
    },
    currentLocation: {
        latitude: Number,
        longitude: Number,
        updatedAt: Date
    }
}, { timestamps: true });

bookingSchema.index({ user: 1, bookingStatus: 1 });
bookingSchema.index({ provider: 1, bookingStatus: 1 });
bookingSchema.index({ "dispute.isRaised": 1 });
bookingSchema.index({ bookingStatus: 1, createdAt: -1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;