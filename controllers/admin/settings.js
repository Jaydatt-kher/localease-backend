import { AdminSettings } from "../../models/adminSettings.model.js";

export const getAdminSettings = async (req, res) => {
    try {
        let settings = await AdminSettings.findOne();
        if (!settings) {
            settings = await AdminSettings.create({});
        }

        res.status(200).json({
            success: true,
            settings
        });
    } catch (error) {
        console.error("getAdminSettings Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const updateAdminSettings = async (req, res) => {
    try {
        const updates = req.body;

        let settings = await AdminSettings.findOne();

        if (!settings) {
            settings = await AdminSettings.create(updates);
        } else {
            Object.assign(settings, updates);
            await settings.save();
        }

        res.status(200).json({
            success: true,
            message: "Settings updated successfully",
            settings
        });
    } catch (error) {
        console.error("updateAdminSettings Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};
