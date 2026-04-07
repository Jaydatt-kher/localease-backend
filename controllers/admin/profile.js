import User from "../../models/user.model.js";
import bcrypt from "bcryptjs";

export const getAdminProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select("-password -__v");

        if (!user) {
            return res.status(404).json({ success: false, message: "Admin user not found" });
        }

        return res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("getAdminProfile Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const updateAdminProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const { fullName, email, mobileNo, photoUrl } = req.body;

        if (email) {
            const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
            if (existingEmail) {
                return res.status(400).json({ success: false, message: "Email already in use by another account" });
            }
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { fullName, email, mobileNo, photoUrl },
            { new: true, runValidators: true }
        ).select("-password -__v");

        if (!user) {
            return res.status(404).json({ success: false, message: "Admin user not found" });
        }

        return res.status(200).json({ success: true, message: "Profile updated successfully", user });
    } catch (error) {
        console.error("updateAdminProfile Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const updateAdminPassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Admin user not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid current password" });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        return res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("updateAdminPassword Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};
