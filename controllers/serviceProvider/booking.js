import Booking from "../../models/booking.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";
import Notification from "../../models/notification.model.js";
import bcrypt from "bcryptjs";

export const getProviderBookings = async (req, res) => {
    try {
        const userId = req.userId;
        const { status } = req.query;

        const provider = await ServiceProvider.findOne({
            userId,
            isDeleted: false,
            isActive: true,
            isBlocked: false,
            isVerified: true
        });

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Provider profile not found.",
            });
        }

        const filter = { provider: provider._id };
        if (status) filter.bookingStatus = status;

        const bookings = await Booking.find(filter)
            .populate("service", "name description")
            .populate("user", "fullName mobileNo email")
            .sort({ scheduledTime: 1 })
            .lean();

        const cleanBookings = bookings.map(b => {
            if (b.bookingStatus === 'completed' || b.bookingStatus === 'cancelled') {
                if (b.user) {
                    b.user.mobileNo = null;
                    b.user.email = null;
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
        console.error("getProviderBookings Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

export const getProviderBookingById = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const provider = await ServiceProvider.findOne({
            userId,
            isDeleted: false,
        });

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Provider profile not found.",
            });
        }

        const booking = await Booking.findOne({ _id: id, provider: provider._id })
            .populate("service", "name description images")
            .populate("user", "fullName mobileNo email address")
            .populate("payment")
            .lean();

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found.",
            });
        }

        if (booking.bookingStatus === "completed" || booking.bookingStatus === "cancelled") {
            if (booking.user) {
                booking.user.mobileNo = null;
                booking.user.email = null;
            }
        }

        return res.status(200).json({ success: true, data: booking });
    } catch (error) {
        console.error("getProviderBookingById Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

export const setFinalAmount = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { hoursWorked, finalAmount } = req.body;
        const provider = await ServiceProvider.findOne({ userId, isActive: true, isBlocked: false, isDeleted: false, isVerified: true })
        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider profile not found." })
        }
        const booking = await Booking.findOne({ _id: id, provider: provider._id })
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found or you do not have permission." });
        }
        if (!["confirmed", "in_progress"].includes(booking.bookingStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot set final amount when booking status is '${booking.bookingStatus}'.`,
            });
        }

        if (booking.priceType === "fixed") {
            return res.status(400).json({
                success: false,
                message: "Fixed-price bookings already have a confirmed amount. No adjustment is possible.",
            });
        }
        if (booking.priceType === "hourly") {
            if (hoursWorked == null || Number(hoursWorked) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "hoursWorked must be greater than 0 for hourly bookings.",
                });
            }
            if (booking.quotedPrice == null) {
                return res.status(400).json({
                    success: false,
                    message: "Hourly rate (quotedPrice) is missing on this booking. Cannot calculate.",
                });
            }
            const computedAmount = parseFloat((booking.quotedPrice * Number(hoursWorked)).toFixed(2));
            booking.hoursWorked = Number(hoursWorked);
            booking.finalAmount = computedAmount;
            await booking.save();
            return res.status(200).json({
                success: true,
                message: "Final amount calculated and saved.",
                data: {
                    priceType: "hourly",
                    hourlyRate: booking.quotedPrice,
                    hoursWorked: booking.hoursWorked,
                    finalAmount: booking.finalAmount,
                }
            })
        }
        if (booking.priceType === "inspection") {
            if (finalAmount == null || Number(finalAmount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "finalAmount must be greater than 0 for inspection bookings.",
                });
            }
            booking.finalAmount = parseFloat(Number(finalAmount).toFixed(2));
            await booking.save();

            return res.status(200).json({
                success: true,
                message: "Final amount saved after inspection.",
                data: {
                    priceType: "inspection",
                    finalAmount: booking.finalAmount,
                },
            });
        }
        return res.status(400).json({ success: false, message: "Unknown priceType on this booking." });
    } catch (error) {
        console.error("setFinalAmount Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const cancelProviderBooking = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { reason } = req.body;

        const provider = await ServiceProvider.findOne({
            userId,
            isDeleted: false,
        });
        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider profile not found." });
        }

        const booking = await Booking.findOne({ _id: id, provider: provider._id })
            .populate("service", "name")
            .populate("provider", "businessName");

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found or you do not have permission." });
        }
        if (booking.bookingStatus !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel a booking that is '${booking.bookingStatus}'. Only 'confirmed' bookings can be cancelled.`,
            });
        }

        booking.bookingStatus = "cancelled";
        booking.cancellationReason = reason?.trim() || "Cancelled by provider";
        booking.cancelledAt = new Date();
        booking.cancelledBy = "provider";
        await booking.save();

        setImmediate(async () => {
            try {
                await Notification.create({
                    recipient: booking.user,
                    type: "BOOKING_CANCELLED",
                    title: "Booking Cancelled by Provider",
                    body: `${provider.businessName ?? "Your provider"} has cancelled your booking for ${booking.service?.name ?? "a service"}. Reason: ${booking.cancellationReason}`,
                    senderName: provider.businessName ?? "Provider",
                    meta: { bookingId: booking._id, reason: booking.cancellationReason },
                });
            } catch (err) {
                console.error("provider cancel booking notification error:", err.message);
            }
        });

        return res.status(200).json({
            success: true,
            message: "Booking cancelled successfully.",
            data: { _id: booking._id, bookingStatus: booking.bookingStatus, cancellationReason: booking.cancellationReason },
        });
    } catch (error) {
        console.error("cancelProviderBooking Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const startJob = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ success: false, message: "Provide the Start OTP." });
        }

        const provider = await ServiceProvider.findOne({ userId, isDeleted: false });
        if (!provider) return res.status(404).json({ success: false, message: "Provider not found." });

        const booking = await Booking.findOne({ _id: id, provider: provider._id }).populate("user", "fullName");
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

        if (booking.bookingStatus !== "confirmed") {
            return res.status(400).json({ success: false, message: `Booking status is '${booking.bookingStatus}', cannot start.` });
        }

        if (booking.startOtp.isUsed) {
            return res.status(400).json({ success: false, message: "Start OTP already used." });
        }

        if (booking.startOtp.expires && new Date() > booking.startOtp.expires) {
            return res.status(400).json({ success: false, message: "Start OTP has expired." });
        }

        const isMatch = await bcrypt.compare(otp, booking.startOtp.code);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid Start OTP." });
        }

        booking.startOtp.isUsed = true;
        booking.bookingStatus = "in_progress";
        await booking.save();

        return res.status(200).json({
            success: true,
            message: "Job started successfully.",
            data: {
                bookingId: booking._id,
                bookingStatus: booking.bookingStatus
            }
        });

    } catch (error) {
        console.error("startJob Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const generateCompleteOtp = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const provider = await ServiceProvider.findOne({ userId, isDeleted: false });
        if (!provider) return res.status(404).json({ success: false, message: "Provider not found." });

        const booking = await Booking.findOne({ _id: id, provider: provider._id });
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

        if (booking.bookingStatus !== "in_progress") {
            return res.status(400).json({ success: false, message: `Booking status is '${booking.bookingStatus}'. Cannot generate complete OTP.` });
        }

        if (booking.priceType !== "fixed" && booking.finalAmount == null) {
            return res.status(400).json({ success: false, message: "Please set the final amount before completing the job." });
        }

        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const hashedOtp = await bcrypt.hash(generatedOtp, 10);

        const otpExpiry = new Date();
        otpExpiry.setHours(otpExpiry.getHours() + 24);

        booking.completedOtp = {
            code: hashedOtp,
            expires: otpExpiry,
            isUsed: false
        };
        await booking.save();

        return res.status(200).json({
            success: true,
            message: "Completion OTP generated. Please provide this to the user.",
            otp: generatedOtp
        });

    } catch (error) {
        console.error("generateCompleteOtp Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};