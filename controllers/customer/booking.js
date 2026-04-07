import Booking from "../../models/booking.model.js";
import Notification from "../../models/notification.model.js";

export const getMyBookings = async (req, res) => {
    try {
        const userId = req.userId;
        const { status } = req.query;

        const filter = { user: userId };
        if (status) filter.bookingStatus = status;

        const bookings = await Booking.find(filter)
            .populate("service", "name description")
            .populate("provider", "businessName profilePicture rating")
            .populate({
                path: "provider",
                populate: { path: "userId", select: "fullName mobileNo" }
            })
            .sort({ scheduledTime: 1 }).lean();

        const cleanBookings = bookings.map(b => {
            if (b.bookingStatus === 'completed' || b.bookingStatus === 'cancelled') {
                if (b.provider && b.provider.userId) {
                    b.provider.userId.mobileNo = null;
                    b.provider.userId.email = null;
                }
            }
            return b;
        });

        return res.status(200).json({
            success: true,
            count: cleanBookings.length,
            data: cleanBookings,
        });
    } catch (error) {
        console.error("getMyBookings Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

export const getBookingById = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const booking = await Booking.findOne({ _id: id, user: userId })
            .populate("service", "name description images")
            .populate("provider", "businessName profilePicture rating experienceYears")
            .populate({
                path: "provider",
                populate: { path: "userId", select: "fullName mobileNo email" }
            })
            .populate("payment")
            .lean();

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found.",
            });
        }

        if (booking.bookingStatus === "completed" || booking.bookingStatus === "cancelled") {
            if (booking.provider && booking.provider.userId) {
                booking.provider.userId.mobileNo = null;
                booking.provider.userId.email = null;
            }
        }

        return res.status(200).json({ success: true, data: booking });
    } catch (error) {
        console.error("getBookingById Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

export const cancelBooking = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { reason } = req.body;

        const booking = await Booking.findOne({ _id: id, user: userId })
            .populate("service", "name")
            .populate("provider", "businessName userId");

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found." });
        }
        if (booking.bookingStatus !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel a booking that is '${booking.bookingStatus}'. Only 'confirmed' bookings can be cancelled.`,
            });
        }

        booking.bookingStatus = "cancelled";
        booking.cancellationReason = reason?.trim() || "Cancelled by customer";
        booking.cancelledAt = new Date();
        booking.cancelledBy = "customer";
        await booking.save();

        setImmediate(async () => {
            try {
                const providerUserId = booking.provider?.userId;
                if (!providerUserId) return;
                await Notification.create({
                    recipient: providerUserId,
                    type: "BOOKING_CANCELLED",
                    title: "Booking Cancelled",
                    body: `Your booking for ${booking.service?.name ?? "a service"} has been cancelled by the customer.`,
                    senderName: "Customer",
                    meta: { bookingId: booking._id, reason: booking.cancellationReason },
                });
            } catch (err) {
                console.error("cancel booking notification error:", err.message);
            }
        });

        return res.status(200).json({
            success: true,
            message: "Booking cancelled successfully.",
            data: { _id: booking._id, bookingStatus: booking.bookingStatus, cancellationReason: booking.cancellationReason },
        });
    } catch (error) {
        console.error("cancelBooking Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};
