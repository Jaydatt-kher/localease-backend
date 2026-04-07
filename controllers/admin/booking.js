import Booking from "../../models/booking.model.js";
import { Payment } from "../../models/payment.model.js";
import Review from "../../models/review.model.js";

export const getAdminBookingStats = async (req, res) => {
    try {
        const total = await Booking.countDocuments();

        const active = await Booking.countDocuments({ bookingStatus: { $in: ['confirmed', 'in_progress'] } });

        const completed = await Booking.countDocuments({ bookingStatus: 'completed' });
        const cancelled = await Booking.countDocuments({ bookingStatus: 'cancelled' });

        res.status(200).json({
            success: true,
            total,
            active,
            completed,
            cancelled
        });
    } catch (error) {
        console.error("getAdminBookingStats Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const getAdminBookings = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", status = "" } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const matchQuery = {};
        if (status && status !== "all") {
            if (status === "accepted") {
                matchQuery.bookingStatus = { $in: ['confirmed', 'in_progress'] };
            } else {
                matchQuery.bookingStatus = status;
            }
        }

        const pipeline = [
            { $match: matchQuery },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },

            {
                $lookup: {
                    from: "serviceproviders",
                    localField: "provider",
                    foreignField: "_id",
                    as: "providerDetails"
                }
            },
            { $unwind: "$providerDetails" },

            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceDetails"
                }
            },
            { $unwind: "$serviceDetails" },

            {
                $match: {
                    $or: [
                        { bookingId: { $regex: search, $options: "i" } },
                        { "userDetails.fullName": { $regex: search, $options: "i" } },
                        { "providerDetails.businessName": { $regex: search, $options: "i" } }
                    ]
                }
            },

            { $sort: { scheduledTime: -1 } },

            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
                        { $skip: skip },
                        { $limit: limitNum },
                        {
                            $project: {
                                id: "$bookingId",
                                user: "$userDetails.fullName",
                                provider: "$providerDetails.businessName",
                                service: "$serviceDetails.name",
                                scheduledTime: 1,
                                price: "$quotedPrice",
                                finalPrice: "$finalAmount",
                                status: "$bookingStatus",
                                createdAt: 1
                            }
                        }
                    ]
                }
            }
        ];

        const result = await Booking.aggregate(pipeline);
        const total = result[0].metadata[0]?.total || 0;
        const bookings = result[0].data || [];

        res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            bookings
        });

    } catch (error) {
        console.error("getAdminBookings Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const getAdminBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking
            .findOne({ bookingId: id })
            .populate("user", "fullName email mobileNo profilePicture")
            .populate("provider", "businessName email phone profilePhoto")
            .populate("service", "name description category")
            .populate("enquiry", "description preferredDate preferredTime")
            .lean();

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        const payment = booking.payment
            ? await Payment.findById(booking.payment).lean()
            : null;

        const review = await Review.findOne({ bookingId: booking._id }).lean();

        res.status(200).json({
            success: true,
            booking: {
                ...booking,
                payment: payment || null,
                review: review || null,
            }
        });
    } catch (error) {
        console.error("getAdminBookingById Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};
