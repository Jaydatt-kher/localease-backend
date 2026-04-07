import User from "../../models/user.model.js";
import Booking from "../../models/booking.model.js";

export const getMyProfile = async (req, res) => {
    try {

        const user = await User.findById(req.userId)
            .select("-password -otpDetails")
            .lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        const [totalBookings, completedBookings] = await Promise.all([
            Booking.countDocuments({ user: req.userId }),
            Booking.countDocuments({ user: req.userId, bookingStatus: "completed" }),
        ]);

        return res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            data: { ...user, totalBookings, completedBookings }
        })

    } catch (error) {
        console.error("getMyProfile Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const updateMyProfile = async (req, res) => {
    try {
        const { fullName, mobileNo, address, photoUrl } = req.body;
        const allowedUpdates = {};
        if (fullName?.trim()) allowedUpdates.fullName = fullName.trim();
        if (mobileNo !== undefined) allowedUpdates.mobileNo = mobileNo || null;
        if (address !== undefined) allowedUpdates.address = address || null;
        if (photoUrl !== undefined) allowedUpdates.photoUrl = photoUrl || null;

        if (Object.keys(allowedUpdates).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields provided." });
        }
        if (mobileNo !== undefined) allowedUpdates.isMobileVerified = false;
        const updated = await User.findByIdAndUpdate(
            req.userId,
            { $set: allowedUpdates },
            { new: true, runValidators: true }
        ).select("-password -otpDetails").lean();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: updated
        })
    } catch (error) {
        console.error("updateMyProfile Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const deleteMyAccount = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, {
            $set: {
                status: "blocked",
                fullName: "Deleted User",
                mobileNo: null,
                address: null,
            },
        });
        res.clearCookie("token", { httpOnly: true, sameSite: "strict" });

        return res.status(200).json({
            success: true,
            message: "Your account has been deleted. We're sorry to see you go."
        })
    } catch (error) {
        console.error("deleteMyAccount Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};