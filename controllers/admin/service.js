import mongoose from "mongoose";
import fs from 'fs'
import ProviderService from "../../models/providerService.model.js";
import Service from "../../models/services.model.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../../utils/cloudinary.js";

export const createService = async (req, res) => {
    try {
        const { name, city, category, description, duration } = req.body;
        if (!name || !city || !category || !description) {
            if (req.files) req.files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        const existing = await Service.findOne({ name, city, category });
        if (existing) {
            return res.status(400).json({ success: false, message: "Service already created" })
        }
        let imageUrls = []
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map((file) => uploadOnCloudinary(file.path));
            const results = await Promise.all(uploadPromises);
            imageUrls = results.filter((url) => url !== null);
        }
        const service = new Service({
            name,
            city,
            category,
            description,
            duration,
            images: imageUrls
        });
        await service.save();
        return res.status(201).json({ success: true, message: "Service created successfully" });

    } catch (error) {
        console.error("createService Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, city, category, description, duration, isAvailable, existingImages } = req.body;
        let updateData = {};
        if (name) updateData.name = name;
        if (city) updateData.city = city;
        if (category) updateData.category = category;
        if (description) updateData.description = description;
        if (duration !== undefined) updateData.duration = duration;
        if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
        if (existingImages !== undefined || (req.files && req.files.length > 0)) {
            let updatedImages = [];
            if (existingImages) {
                updatedImages = Array.isArray(existingImages) ? existingImages : [existingImages];
            }
            if (req.files && req.files.length > 0) {
                const uploadPromises = req.files.map((file) => uploadOnCloudinary(file.path));
                const newImageUrls = await Promise.all(uploadPromises);
                const validNewUrls = newImageUrls.filter((url) => url !== null)
                updatedImages = [...updatedImages, ...validNewUrls];
            }
            updateData.images = updatedImages
        }
        const updateService = await Service.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!updateService) {
            return res.status(404).json({ success: false, message: "Service not found" });
        }
        return res.status(200).json({ success: true, message: "Service updated successfully!", updateService })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "A service with this name already exists" });
        }
        console.error("updateService Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        const service = await Service.findByIdAndUpdate(id, { isAvailable: false }, { new: true, runValidators: true });
        if (!service) {
            return res.status(404).json({ success: false, message: "Service not found" })
        }

        return res.status(200).json({ success: true, message: "Service deleted successfully", service })
    } catch (error) {
        console.error("deleteService Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const getServices = async (req, res) => {
    try {
        const { page, limit, search = "", cityId, categoryId, isAvailable } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 5;
        const skip = (pageNum - 1) * limitNum;
        const matchQuery = {
            name: { $regex: search, $options: "i" }
        }
        if (cityId) {
            matchQuery.city = new mongoose.Types.ObjectId(cityId);
        }
        if (categoryId) {
            matchQuery.category = new mongoose.Types.ObjectId(categoryId);
        }
        if (isAvailable !== undefined) {
            matchQuery.isAvailable = isAvailable === "true";
        }
        const service = await Service.aggregate([
            {
                $match: matchQuery
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
            {
                $lookup: {
                    from: "cities",
                    localField: "city",
                    foreignField: "_id",
                    as: "cityDetails"
                }
            },
            {
                $lookup: {
                    from: "servicecategories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            {
                $lookup: {
                    from: "providerservices",
                    localField: "_id",
                    foreignField: "serviceId",
                    as: "providersService"
                }
            },
            {
                $addFields: {
                    totalProviders: { $size: "$providersService" },
                    cityName: { $arrayElemAt: ["$cityDetails.name", 0] },
                    categoryName: { $arrayElemAt: ["$categoryDetails.name", 0] }
                }
            },
            {
                $project: {
                    providersService: 0,
                    categoryDetails: 0,
                    cityDetails: 0
                }
            }
        ]);
        const total = await Service.countDocuments(matchQuery)
        return res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            data: service
        })
    } catch (error) {
        console.error("getServices Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const getAdminServiceStats = async (req, res) => {
    try {
        const total = await Service.countDocuments();
        const active = await Service.countDocuments({ isAvailable: true });
        const inactive = await Service.countDocuments({ isAvailable: false });

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const newThisMonth = await Service.countDocuments({ createdAt: { $gte: startOfMonth } });

        return res.status(200).json({
            success: true,
            total,
            active,
            inactive,
            newThisMonth
        });
    } catch (error) {
        console.error("getAdminServiceStats Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
