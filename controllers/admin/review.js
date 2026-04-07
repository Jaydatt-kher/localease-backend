import Review from "../../models/review.model.js";

export const getAdminReviewStats = async (req, res) => {
    try {
        const [total, fiveStar, lowRatings, avgAgg, distribution] = await Promise.all([
            Review.countDocuments(),
            Review.countDocuments({ rating: 5 }),
            Review.countDocuments({ rating: { $lte: 2 } }),
            Review.aggregate([
                { $group: { _id: null, avg: { $avg: "$rating" } } }
            ]),
            Review.aggregate([
                { $group: { _id: "$rating", count: { $sum: 1 } } },
                { $sort: { _id: -1 } }
            ])
        ]);

        const averageRating = avgAgg[0]?.avg ? Number(avgAgg[0].avg.toFixed(1)) : 0;

        const distMap = {};
        distribution.forEach(d => { distMap[d._id] = d.count; });
        const ratingDistribution = [5, 4, 3, 2, 1].map(r => ({
            rating: r,
            count: distMap[r] || 0,
        }));

        res.status(200).json({
            success: true,
            total,
            averageRating,
            fiveStar,
            lowRatings,
            ratingDistribution,
        });
    } catch (error) {
        console.error("getAdminReviewStats Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const getAdminReviews = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            rating = "",
        } = req.query;

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const matchQuery = {};
        if (rating && rating !== "all") {
            matchQuery.rating = parseInt(rating, 10);
        }

        const pipeline = [
            { $match: matchQuery },

            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userDetails",
                }
            },
            { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "serviceproviders",
                    localField: "providerId",
                    foreignField: "_id",
                    as: "providerDetails",
                }
            },
            { $unwind: { path: "$providerDetails", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "services",
                    localField: "serviceId",
                    foreignField: "_id",
                    as: "serviceDetails",
                }
            },
            { $unwind: { path: "$serviceDetails", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "bookings",
                    localField: "bookingId",
                    foreignField: "_id",
                    as: "bookingDetails",
                }
            },
            { $unwind: { path: "$bookingDetails", preserveNullAndEmptyArrays: true } },

            ...(search ? [{
                $match: {
                    $or: [
                        { "userDetails.fullName": { $regex: search, $options: "i" } },
                        { "providerDetails.businessName": { $regex: search, $options: "i" } },
                        { "serviceDetails.name": { $regex: search, $options: "i" } },
                    ]
                }
            }] : []),

            { $sort: { createdAt: -1 } },

            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
                        { $skip: skip },
                        { $limit: limitNum },
                        {
                            $project: {
                                _id: 1,
                                bookingId: "$bookingDetails.bookingId",
                                user: "$userDetails.fullName",
                                provider: "$providerDetails.businessName",
                                service: "$serviceDetails.name",
                                rating: 1,
                                comment: 1,
                                isVisible: 1,
                                createdAt: 1,
                            }
                        }
                    ]
                }
            }
        ];

        const result = await Review.aggregate(pipeline);
        const total = result[0]?.metadata[0]?.total || 0;
        const reviews = result[0]?.data || [];

        res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            reviews,
        });
    } catch (error) {
        console.error("getAdminReviews Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const deleteAdminReview = async (req, res) => {
    try {
        const review = await Review.findByIdAndDelete(req.params.id);
        if (!review) return res.status(404).json({ success: false, message: "Review not found" });
        res.status(200).json({ success: true, message: "Review deleted successfully" });
    } catch (error) {
        console.error("deleteAdminReview Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};
