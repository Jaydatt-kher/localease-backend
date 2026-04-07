import ProviderService from "../../models/providerService.model.js";
import Review from "../../models/review.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";
import Service from "../../models/services.model.js";
import User from "../../models/user.model.js";
import Booking from "../../models/booking.model.js";
import { ProviderResponse } from "../../models/providerResponse.model.js";

function pctChange(current, prev) {
    if (prev === 0) return current > 0 ? 100 : null;
    return parseFloat((((current - prev) / prev) * 100).toFixed(1));
}

export const getProviderStats = async (req, res) => {
    try {
        const now = new Date();
        const cmStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const pmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const pmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        const [total, approved, pending, blocked, newThisMonth, newLastMonth] = await Promise.all([
            ServiceProvider.countDocuments({ isDeleted: false }),
            ServiceProvider.countDocuments({ isDeleted: false, isVerified: true, isBlocked: false }),
            ServiceProvider.countDocuments({ isDeleted: false, isVerified: false, isBlocked: false }),
            ServiceProvider.countDocuments({ isDeleted: false, isBlocked: true }),
            ServiceProvider.countDocuments({ isDeleted: false, joinedAt: { $gte: cmStart } }),
            ServiceProvider.countDocuments({ isDeleted: false, joinedAt: { $gte: pmStart, $lte: pmEnd } }),
        ]);

        return res.status(200).json({
            total,
            approved,
            pending,
            blocked,
            newThisMonth,
            newThisMonthTrend: pctChange(newThisMonth, newLastMonth),
        });
    } catch (error) {
        console.error("getProviderStats Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const getPendingProviders = async (req, res) => {
    try {
        const providers = await ServiceProvider.find({
            isDeleted: false,
            isVerified: false,
            isBlocked: false,
        })
            .sort({ joinedAt: 1 }).limit(10)
            .select("_id businessName joinedAt")
            .populate("city", "name");

        return res.status(200).json({ success: true, providers });
    } catch (error) {
        console.error("getPendingProviders Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const getAllServiceProviders = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 5;
        const skip = (page - 1) * limit;
        const { city, isVerified, isActive, isBlocked, search, sortBy = "createdAt", order = "desc" } = req.query;
        let filter = { isDeleted: false };
        if (city) {
            filter.city = city;
        }
        if (isVerified !== undefined) filter.isVerified = isVerified === "true";
        if (isActive !== undefined) filter.isActive = isActive === "true";
        if (isBlocked !== undefined) filter.isBlocked = isBlocked === "true";
        if (search) {
            filter.$or = [
                { businessName: { $regex: search, $options: "i" } }
            ]
        }
        if (req.query.categoryId) {
            const serviceInCategory = await Service.find({
                category: req.query.categoryId
            }).select("_id")
            const serviceIds = serviceInCategory.map(service => service._id)
            const providerServices = await ProviderService.find({
                serviceId: { $in: serviceIds }
            }).select("providerId")
            const providerIds = providerServices.map(ps => ps.providerId);
            filter._id = { $in: providerIds };
        }
        const sortOrder = order === "asc" ? 1 : -1;
        const providers = await ServiceProvider.find(filter)
            .populate("userId", "fullName email mobileNo")
            .populate("city", "name")
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit);

        const totalProviders = await ServiceProvider.countDocuments(filter)
        res.status(200).json({
            success: true,
            providers,
            pagination: {
                totalProviders,
                totalPages: Math.ceil(totalProviders / limit),
                currentPage: page,
                limit
            }
        })

    } catch (error) {
        console.error("getAllServiceProvider Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const getProviderDetailsById = async (req, res) => {
    try {
        const { id } = req.params;
        const provider = await ServiceProvider.findOne({ _id: id, isDeleted: false })
            .populate("userId", "fullName email mobileNo")
            .populate("city", "name")

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Provider not found"
            });
        }

        const [
            services,
            reviews,
            totalBookings,
            completedJobs,
            pendingEnquiries
        ] = await Promise.all([
            ProviderService.find({ provider: id }).populate("service", "name"),

            Review.find({ provider: id })
                .populate("user", "fullName name")
                .sort({ createdAt: -1 })
                .limit(5),

            Booking.countDocuments({ provider: id }).catch(() => 0),

            Booking.countDocuments({ provider: id, bookingStatus: "completed" }).catch(() => 0),

            ProviderResponse.countDocuments({
                provider: id,
                status: { $in: ["pending", "responded"] }
            }).catch(() => 0),
        ]);

        return res.status(200).json({
            success: true,
            provider,
            services,
            reviews,
            stats: {
                totalBookings,
                completedJobs,
                pendingEnquiries
            }
        });
    } catch (error) {
        console.error("getProviderDetailsById Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const rejectProvider = async (req, res) => {
    try {
        const { id } = req.params;
        const provider = await ServiceProvider.findOneAndUpdate(
            { _id: id, isVerified: false, isDeleted: false },
            { isBlocked: true },
            { new: true, select: "_id businessName isBlocked" }
        );
        if (!provider) {
            return res.status(404).json({ success: false, message: "Pending provider not found" });
        }
        res.status(200).json({
            success: true,
            message: `${provider.businessName} has been rejected.`,
            provider,
        });
    } catch (error) {
        console.error("rejectProvider Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const blockProvider = async (req, res) => {
    try {
        const { id } = req.params;

        const provider = await ServiceProvider.findByIdAndUpdate(
            id,
            { isBlocked: true },
            { new: true }
        );

        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found" });
        }

        res.status(200).json({
            success: true,
            message: "Provider blocked successfully",
            provider
        });
    } catch (error) {
        console.error("blockProvider Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const unblockProvider = async (req, res) => {
    try {
        const { id } = req.params;

        const provider = await ServiceProvider.findByIdAndUpdate(
            id,
            { isBlocked: false },
            { new: true }
        );

        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found" });
        }

        res.status(200).json({
            success: true,
            message: "Provider unblocked successfully",
            provider
        });
    } catch (error) {
        console.error("unblockProvider Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const deleteProvider = async (req, res) => {
    try {
        const { id } = req.params;

        const provider = await ServiceProvider.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found" });
        }

        res.status(200).json({
            success: true,
            message: "Provider deleted successfully",
            provider
        });
    } catch (error) {
        console.error("deleteProvider Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const restoreProvider = async (req, res) => {
    try {
        const { id } = req.params;

        const provider = await ServiceProvider.findByIdAndUpdate(
            id,
            { isDeleted: false },
            { new: true }
        );

        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found" });
        }

        res.status(200).json({
            success: true,
            message: "Provider restored successfully",
            provider
        });
    } catch (error) {
        console.error("restoreProvider Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};
export const approveServiceProvider = async (req, res) => {
    try {
        const { id } = req.params;
        const provider = await ServiceProvider.findById(id);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Service Provider not found"
            })
        }
        if (provider.isVerified) {
            return res.status(400).json({
                success: false,
                message: "Provider already approved"
            });
        }
        provider.isVerified = true;
        await provider.save();
        await User.findByIdAndUpdate(
            provider.userId,
            { role: "serviceProvider" },
            { new: true, runValidators: true }
        )
        res.status(200).json({
            success: true,
            message: "Service Provider approved successfully",
            data: provider
        });

    } catch (error) {
        console.error("approveServiceProvider Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};