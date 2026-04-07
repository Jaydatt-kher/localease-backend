import ServiceCategory from "../../models/serviceCategories.model.js";
import Service from "../../models/services.model.js";
import slugify from "slugify"

export const getCategoryStats = async (req, res) => {
    try {
        const total = await ServiceCategory.countDocuments();
        const active = await ServiceCategory.countDocuments({ isActive: true });
        const inactive = await ServiceCategory.countDocuments({ isActive: false });
        const featured = await ServiceCategory.countDocuments({ featured: true });

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const newThisMonth = await ServiceCategory.countDocuments({ createdAt: { $gte: startOfMonth } });

        return res.status(200).json({ success: true, total, active, inactive, featured, newThisMonth });
    } catch (error) {
        console.error("getCategoryStats Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const createCategory = async (req, res) => {
    try {
        const { name, icon, description, displayOrder, isActive, featured } = req.body;
        const existing = await ServiceCategory.findOne({ name });
        if (existing) {
            return res.status(400).json({ success: false, message: "Category already exists" })
        };
        const category = await ServiceCategory.create({
            name,
            slug: slugify(name, { lower: true }),
            icon,
            description,
            displayOrder,
            isActive,
            featured
        });
        res.status(201).json({ success: true, category });

    } catch (error) {
        console.error("createCategory Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const getCategories = async (req, res) => {
    try {
        const { page, limit, search = "", isActive } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 5;
        const skip = (pageNum - 1) * limitNum;

        const matchQuery = {
            name: { $regex: search, $options: "i" }
        };

        if (isActive !== undefined) {
            matchQuery.isActive = isActive === "true";
        }

        const categories = await ServiceCategory.aggregate([
            {
                $match: matchQuery
            },
            { $sort: { displayOrder: 1 } },
            { $skip: skip },
            { $limit: limitNum },
            {
                $lookup: {
                    from: "services",
                    localField: "_id",
                    foreignField: "category",
                    as: "services"
                }
            },
            {
                $addFields: {
                    totalServices: { $size: "$services" }
                }
            },
            {
                $project: {
                    services: 0
                }
            }
        ]);
        const total = await ServiceCategory.countDocuments({
            name: { $regex: search, $options: "i" }
        });
        res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            categories
        })

    } catch (error) {
        console.error("getCategories Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        if (req.body.name) {
            req.body.slug = slugify(req.body.name, { lower: true });
        }
        const update = await ServiceCategory.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!update) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        res.status(200).json({ success: true, message: "Category successfully updated", category: update });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Category with this name already exists"
            });
        }
        console.error("updateCategory Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await ServiceCategory.findById(id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        const serviceCount = await Service.countDocuments({ category: id })
        if (serviceCount > 0) {
            return res.status(400).json({ message: "Cannot delete category with existing services" })
        }
        await category.deleteOne();
        return res.status(200).json({ message: "Category deleted successfully", delete: category });

    } catch (error) {
        console.error("deleteCategory Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};