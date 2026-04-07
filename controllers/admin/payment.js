import { Payment } from "../../models/payment.model.js";

export const getAdminPaymentStats = async (req, res) => {
    try {
        const [total, completed, pending, failed, refunded, revenueAgg] = await Promise.all([
            Payment.countDocuments(),
            Payment.countDocuments({ paymentStatus: "completed" }),
            Payment.countDocuments({ paymentStatus: "pending" }),
            Payment.countDocuments({ paymentStatus: "failed" }),
            Payment.countDocuments({ paymentStatus: "refunded" }),
            Payment.aggregate([
                { $match: { paymentStatus: "completed" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ])
        ]);

        const totalRevenue = revenueAgg[0]?.total || 0;

        res.status(200).json({
            success: true,
            total,
            completed,
            pending,
            failed,
            refunded,
            totalRevenue,
        });
    } catch (error) {
        console.error("getAdminPaymentStats Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const getAdminPayments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            status = "",
            method = "",
        } = req.query;

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const matchQuery = {};
        if (status && status !== "all") matchQuery.paymentStatus = status;
        if (method && method !== "all") matchQuery.paymentMethod = method;

        const pipeline = [
            { $match: matchQuery },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails",
                }
            },
            { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "serviceproviders",
                    localField: "provider",
                    foreignField: "_id",
                    as: "providerDetails",
                }
            },
            { $unwind: { path: "$providerDetails", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "bookings",
                    localField: "booking",
                    foreignField: "_id",
                    as: "bookingDetails",
                }
            },
            { $unwind: { path: "$bookingDetails", preserveNullAndEmptyArrays: true } },

            {
                $match: {
                    $or: [
                        { "bookingDetails.bookingId": { $regex: search, $options: "i" } },
                        { "userDetails.fullName": { $regex: search, $options: "i" } },
                        { "providerDetails.businessName": { $regex: search, $options: "i" } },
                        { transactionId: { $regex: search, $options: "i" } },
                    ]
                }
            },

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
                                amount: 1,
                                paymentMethod: 1,
                                paymentStatus: 1,
                                transactionId: 1,
                                platformCommission: 1,
                                providerEarning: 1,
                                refund: 1,
                                invoiceUrl: 1,
                                createdAt: 1,
                                updatedAt: 1,
                            }
                        }
                    ]
                }
            }
        ];

        const result = await Payment.aggregate(pipeline);
        const total = result[0]?.metadata[0]?.total || 0;
        const payments = result[0]?.data || [];

        res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            payments,
        });
    } catch (error) {
        console.error("getAdminPayments Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};
