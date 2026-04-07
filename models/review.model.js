import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true
    },
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
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    comment: String,
    isVisible: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })
reviewSchema.index({ bookingId: 1 }, { unique: true });
reviewSchema.index({ providerId: 1, rating: -1 });
const Review = mongoose.model("Review", reviewSchema);
export default Review;