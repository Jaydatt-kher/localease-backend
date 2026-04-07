import Notification from "../../models/notification.model.js";

export const getAdminNotificationStats = async (req, res) => {
    try {
        const [total, unread, typeAgg] = await Promise.all([
            Notification.countDocuments(),
            Notification.countDocuments({ isRead: false }),
            Notification.aggregate([
                { $group: { _id: "$type", count: { $sum: 1 } } }
            ])
        ]);

        const typeMap = {};
        typeAgg.forEach(t => { typeMap[t._id] = t.count; });

        res.status(200).json({
            success: true,
            total,
            unread,
            read: total - unread,
            byType: typeMap,
        });
    } catch (error) {
        console.error("getAdminNotificationStats Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const getAdminNotifications = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            type = "",
            status = "", } = req.query;

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const matchQuery = {};
        if (type && type !== "all") matchQuery.type = type;
        if (status && status !== "all") matchQuery.isRead = status === "read";

        if (search) {
            matchQuery.$or = [
                { title: { $regex: search, $options: "i" } },
                { body: { $regex: search, $options: "i" } },
            ];
        }

        const pipeline = [
            { $match: matchQuery },

            {
                $lookup: {
                    from: "users",
                    localField: "recipient",
                    foreignField: "_id",
                    as: "recipientDetails",
                }
            },
            { $unwind: { path: "$recipientDetails", preserveNullAndEmptyArrays: true } },

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
                                type: 1,
                                title: 1,
                                body: 1,
                                senderName: 1,
                                isRead: 1,
                                bookingRef: 1,
                                meta: 1,
                                createdAt: 1,
                                recipient: "$recipientDetails.fullName",
                                recipientRole: "$recipientDetails.role",
                            }
                        }
                    ]
                }
            }
        ];

        const result = await Notification.aggregate(pipeline);
        const total = result[0]?.metadata[0]?.total || 0;
        const notifications = result[0]?.data || [];

        res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            notifications,
        });
    } catch (error) {
        console.error("getAdminNotifications Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const markNotificationRead = async (req, res) => {
    try {
        const notif = await Notification.findById(req.params.id);
        if (!notif) return res.status(404).json({ success: false, message: "Notification not found" });
        notif.isRead = !notif.isRead;
        await notif.save();
        res.status(200).json({ success: true, message: `Marked as ${notif.isRead ? "read" : "unread"}`, isRead: notif.isRead });
    } catch (error) {
        console.error("markNotificationRead Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

export const deleteAdminNotification = async (req, res) => {
    try {
        const notif = await Notification.findByIdAndDelete(req.params.id);
        if (!notif) return res.status(404).json({ success: false, message: "Notification not found" });
        res.status(200).json({ success: true, message: "Notification deleted." });
    } catch (error) {
        console.error("deleteAdminNotification Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};
