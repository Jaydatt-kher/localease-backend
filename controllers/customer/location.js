import User from "../../models/user.model.js";

export const updateUserLocation = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { lat, lng, address } = req.body;
        if (lat == null || lng == null) {
            return res.status(400).json({
                success: false,
                message: "lat and lng are required.",
            });
        }

        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (
            isNaN(parsedLat) || isNaN(parsedLng) ||
            parsedLat < -90 || parsedLat > 90 ||
            parsedLng < -180 || parsedLng > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Coordinates are out of valid range (lat: -90→90, lng: -180→180).",
            });
        }

        const updatePayload = {
            location: {
                type: "Point",
                coordinates: [parsedLng, parsedLat],
            },
        };

        if (address?.trim()) {
            updatePayload.address = address.trim();
        }
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updatePayload },
            { new: true, select: "fullName email address location" }
        );
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Location updated successfully.",
            data: {
                lat: parsedLat,
                lng: parsedLng,
                address: updatedUser.address,
            },
        });
    } catch (error) {
        console.error("updateUserLocation Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};