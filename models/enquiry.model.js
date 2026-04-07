import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema({
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
    providers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceProvider"
    }],
    prefferedTime: {
        type: String,
        required: true
    },
    prefferedDate: {
        type: Date,
        required: true
    },
    message: {
        type: String,
        trim: true
    },
    location: {
        address: { type: String, default: null },
        city: { type: String, default: null },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
    },

    status: {
        type: String,
        enum: ["open", "closed", "booked"],
        default: "open"
    }

}, { timestamps: true });
enquirySchema.index({ user: 1, status: 1 })
enquirySchema.index({ status: 1 });
enquirySchema.index({ user: 1, service: 1 })

export const Enquiry = mongoose.model("Enquiry", enquirySchema);