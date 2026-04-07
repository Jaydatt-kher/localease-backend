import Review from "../../models/review.model.js";
import Booking from "../../models/booking.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";

export const addReview = async (req, res) => {
    try {
        const userId = req.userId;
        const { bookingId, rating, comment } = req.body;

        if (!bookingId || !rating) {
            return res.status(400).json({ success: false, message: "Booking ID and rating are required." });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
        }

        const booking = await Booking.findOne({ _id: bookingId, user: userId });
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found." });
        }

        if (booking.bookingStatus !== "completed") {
            return res.status(400).json({ success: false, message: "Only completed bookings can be reviewed." });
        }

        const existingReview = await Review.findOne({ bookingId });
        if (existingReview) {
            return res.status(400).json({ success: false, message: "You have already reviewed this booking." });
        }

        const review = await Review.create({
            bookingId,
            userId,
            providerId: booking.provider,
            serviceId: booking.service,
            rating,
            comment: comment?.trim() || ""
        });

        const providerId = booking.provider;
        const allReviews = await Review.find({ providerId });
        const totalRating = allReviews.reduce((sum, rev) => sum + rev.rating, 0);
        const avgRating = totalRating / allReviews.length;

        await ServiceProvider.findByIdAndUpdate(providerId, {
            "rating.average": avgRating,
            "rating.count": allReviews.length
        });

        return res.status(201).json({
            success: true,
            message: "Review added successfully.",
            data: review
        });

    } catch (error) {
        console.error("addReview error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};
