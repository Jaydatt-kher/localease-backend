import mongoose from "mongoose";
const serviceProviderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    businessName: {
        type: String,
        default: null,
        trim: true,
        required: true
    },
    serviceLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }
    },
    experienceYears: {
        type: Number,
        default: 0
    },
    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
        required: true
    },
    completedJobs: {
        type: Number,
        default: 0
    },
    serviceRadius: {
        type: Number,
        default: 10
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    profilePicture: { type: String, default: null },
    gallery: [String],
    isVerified: { type: Boolean, default: false },
    documents: [String],
    rating: {
        average: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
            index: -1
        }, count: { type: Number, default: 0 }
    },

    availability: {
        days: [{
            day: { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            isOpen: { type: Boolean, default: true },
            startTime: String,
            endTime: String
        }]
    },

    payoutSettings: {
        method: {
            type: String,
            enum: ['bank_transfer', 'upi', 'paypal'],
            default: "upi"
        },
        upiId: String,
        bankDetails: {
            accountNumber: String,
            ifscCode: String,
            bankName: String,
            holderName: String
        }
    },
    walletBalance: {
        type: Number,
        default: 0
    },
    razorpayLinkedAccountId: {
        type: String,
        default: null
    },
    isFeatured: {
        type: Boolean,
        default: false 
    },
    featuredExpiresAt: Date,
    currentSubscription: {
        planId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan" },
        startDate: Date,
        endDate: Date,
        status: { type: String, enum: ['active', 'expired'], default: 'expired' }
    }
}, { timestamps: true });
serviceProviderSchema.index({ city: 1, isActive: 1, isVerified: 1, isFeatured: 1 });
serviceProviderSchema.index({ serviceLocation: "2dsphere" });
const ServiceProvider = mongoose.model("ServiceProvider", serviceProviderSchema);
export default ServiceProvider;
