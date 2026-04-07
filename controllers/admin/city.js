import City from "../../models/city.model.js";

export const getAdminCityStats = async (req, res) => {
    try {
        const [total, active, inactive] = await Promise.all([
            City.countDocuments(),
            City.countDocuments({ status: true }),
            City.countDocuments({ status: false }),
        ]);

        res.status(200).json({
            success: true,
            total,
            active,
            inactive
        });
    } catch (error) {
        console.error("getAdminCityStats Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const getAdminCities = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "" } = req.query;

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { state: { $regex: search, $options: "i" } },
            ];
        }

        const cities = await City.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await City.countDocuments(query);

        res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            cities,
        });
    } catch (error) {
        console.error("getAdminCities Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const createCity = async (req, res) => {
    try {
        const { name, state, status } = req.body;

        const existingCity = await City.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingCity) {
            return res.status(400).json({
                success: false,
                message: "City already exists"
            });
        }

        const city = new City({
            name,
            state,
            status: status !== undefined ? status : true
        });
        await city.save();

        return res.status(201).json({
            success: true,
            message: "City successfully created",
            city
        });
    } catch (error) {
        console.error("createCity Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const updateCity = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.name) {
            const existing = await City.findOne({
                name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
                _id: { $ne: id }
            });
            if (existing) {
                return res.status(400).json({ success: false, message: "Another city with this name already exists" });
            }
        }

        const city = await City.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!city) {
            return res.status(404).json({ success: false, message: "City not found" });
        }

        return res.status(200).json({ success: true, message: "City updated successfully", city });
    } catch (error) {
        console.error("updateCity Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const deleteCity = async (req, res) => {
    try {
        const { id } = req.params;
        const city = await City.findByIdAndDelete(id);

        if (!city) {
            return res.status(404).json({ success: false, message: "City not found" });
        }

        return res.status(200).json({ success: true, message: "City deleted successfully" });
    } catch (error) {
        console.error("deleteCity Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
