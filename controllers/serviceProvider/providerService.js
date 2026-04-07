import ProviderService from "../../models/providerService.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";

export const createProviderService = async (req, res) => {
    try {
        const userId = req.userId;
        const { serviceId, price, priceType, duration, description } = req.body;
        const resolvedPriceType = priceType || "fixed";

        if (!serviceId) {
            return res.status(400).json({ success: false, message: "Service ID is required." });
        }
        if (resolvedPriceType !== "inspection" && (price === undefined || price === null || price === "" || Number(price) <= 0)) {
            return res.status(400).json({
                success: false,
                message: `Price is required and must be greater than 0 for ${resolvedPriceType} pricing.`,
            });
        }
        const provider = await ServiceProvider.findOne({ userId, isDeleted: false })
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Provider not found please create a profile before adding services"
            })
        }
        const existingService = await ProviderService.findOne({
            providerId: provider._id,
            serviceId: serviceId
        })
        if (existingService) {
            if (!existingService.isDeleted) {
                return res.status(400).json({
                    success: false,
                    message: "You have already added this service to your profile."
                });
            }
            existingService.isDeleted = false;
            existingService.isAvailable = true;
            existingService.price = resolvedPriceType === "inspection" ? (price != null && price !== "" ? Number(price) : 0) : Number(price);
            existingService.priceType = resolvedPriceType;
            existingService.duration = duration || 60;
            existingService.description = description;
            await existingService.save();
            return res.status(201).json({
                success: true,
                message: "Service successfully added to your profile.",
                providerService: existingService
            });
        }
        const newProviderService = new ProviderService({
            providerId: provider._id,
            serviceId,
            price: resolvedPriceType === "inspection" ? (price != null && price !== "" ? Number(price) : 0) : Number(price),
            priceType: resolvedPriceType,
            duration: duration || 60,
            description
        })
        await newProviderService.save();
        return res.status(201).json({
            success: true,
            message: "Service successfully added to your profile.",
            providerService: newProviderService
        })
    } catch (error) {
        console.error("createProviderService Error:", error);
        if (error.kind === "ObjectId") {
            return res.status(400).json({ message: "Invalid Service ID format." });
        }
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const updateProviderService = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const updates = req.body;
        const provider = await ServiceProvider.findOne({ userId, isDeleted: false });
        if (!provider) {
            return res.status(404).json({
                message: "Provider profile not found."
            });
        }
        const allowedFields = ["price", "priceType", "duration", "description", "isAvailable"];
        const updateData = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                message: "No valid fields provided for update."
            });
        }
        const updatedProviderService = await ProviderService.findOneAndUpdate(
            {
                _id: id,
                providerId: provider._id
            },
            {
                $set: updateData
            },
            {
                new: true,
                runValidators: true
            }
        )
        if (!updatedProviderService) {
            return res.status(404).json({
                success: false,
                message: "Service offering not found or you do not have permission to edit it."
            })
        }
        return res.status(200).json({
            success: true,
            message: "Service updated successfully.",
            providerService: updatedProviderService
        });
    } catch (error) {
        console.error("updateProviderService Error:", error);
        if (error.kind === "ObjectId") {
            return res.status(400).json({ message: "Invalid ID format provided." });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: "Validation Error",
                details: error.message
            });
        }
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const deleteProviderService = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const provider = await ServiceProvider.findOne({
            userId,
            isDeleted: false
        })
        if (!provider) {
            return res.status(404).json({
                message: "Provider profile not found."
            });
        }
        const deletedService = await ProviderService.findOneAndUpdate({ providerId: provider._id, _id: id, isDeleted: false }, { $set: { isDeleted: true, isAvailable: false } }, { new: true, runValidators: true })
        if (!deletedService) {
            return res.status(404).json({
                message: "Service not found or you do not have permission to delete it."
            });
        }
        return res.status(200).json({
            message: "Service successfully removed from your profile."
        });
    } catch (error) {
        console.error("deleteProviderService Error:", error);
        if (error.kind === "ObjectId") {
            return res.status(400).json({ message: "Invalid ID format provided." });
        }
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const getProviderServiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const provider = await ServiceProvider.findOne({ userId, isDeleted: false });
        if (!provider) {
            return res.status(400).json({
                success: false,
                message: "Provider profile not found."
            })
        }
        const services = await ProviderService.findOne({ _id: id, providerId: provider._id, isDeleted: false })
            .populate({
                path: "serviceId",
                select: "name category image",
                populate: {
                    path: "category",
                    select: "name"
                }
            })
        return res.status(200).json({
            message: "Services fetched successfully.",
            services
        });

    } catch (error) {
        console.error("getProviderService Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const getMyServices = async (req, res) => {
    try {
        const userId = req.userId;
        const provider = await ServiceProvider.findOne({ userId, isDeleted: false });
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Provider profile not found."
            });
        }
        const services = await ProviderService.find({
            providerId: provider._id,
            isDeleted: false
        })
            .populate({
                path: "serviceId",
                select: "name category image description",
                populate: {
                    path: "category",
                    select: "name"
                }
            })
            .sort({ updatedAt: -1 });
        return res.status(200).json({
            success: true,
            message: "Services fetched successfully.",
            count: services.length, services
        });
    } catch (error) {
        console.error("getMyservices Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};