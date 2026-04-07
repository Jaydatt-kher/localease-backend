import mongoose from "mongoose";
const providerServiceSchema = new mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceProvider",
        required: true
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    priceType: {
        type: String,
        enum: ["fixed", "hourly", "inspection"],
        default: "inspection"
    },
    duration: {
        type: Number,
        default: 60
    },
    description: {
        type: String,
        trim: true,
        maxLength: 500
    },
    experienceYears: {
        type: Number
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    totalBookings: {
        type: Number,
        default: 0
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
providerServiceSchema.index({ providerId: 1, serviceId: 1 }, { unique: true })
providerServiceSchema.index({ providerId: 1 });
providerServiceSchema.index({ serviceId: 1 });
const ProviderService = mongoose.model("ProviderService", providerServiceSchema);
export default ProviderService;