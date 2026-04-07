import mongoose from "mongoose"
const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    mobileNo: {
        type: String,
        default: null
    },
    photoUrl: {
        type: String,
        default: null
    },
    password: {
        type: String,
        default: null
    },
    refreshTokens: {
        type: [String],
        default: []
    },
    address: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['customer', 'admin', 'serviceProvider'],
        default: 'customer',
    },
    status: {
        type: String,
        enum: ["active", "blocked"],
        default: "active"
    },
    otpDetails: {
        email: {
            hashedCode: String,
            expire: Date,
            cooldownExpire: Date,
            attempt: Number
        },
        phone: {
            hashedCode: String,
            expire: Date,
            cooldownExpire: Date,
            attempt: Number
        },
        booking: {
            hashedCode: String,
            expire: Date,
            cooldownExpire: Date,
            attempt: Number,
            bookingId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Booking"
            }
        },
        resetPasswordOtp: {
            hashedCode: String,
            expire: Date,
            cooldownExpire: Date,
            attempt: Number
        }
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isMobileVerified: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    referralCode: {
        type: String,
        unique: true,
        default: null
    },
    referredBy: {
        type: String, default: null
    },
    loyaltyPoints: {
        type: Number,
        default: 0
    }
}, { timestamps: true })
userSchema.index({ location: '2dsphere' });
const User = mongoose.model("User", userSchema);
export default User;