import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ["NEW_ENQUIRY", "PROVIDER_BID", "BID_ACCEPTED", "BID_REJECTED", "BOOKING_CANCELLED"],
        required: true,
    },

    title: {
        type: String,
        required: true,
    },
    body: {
        type: String,
        required: true,
    },

    senderName: {
        type: String,
        default: null,
    },

    enquiryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Enquiry",
        default: null,
    },
    responseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProviderResponse",
        default: null,
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        default: null,
    },
    bookingRef: {
        type: String,
        default: null,
    },

    meta: {
        type: Object,
        default: {},
    },

    isRead: {
        type: Boolean,
        default: false,
    },
},
    { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

notificationSchema.index({ recipient: 1, isRead: 1 });

notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
