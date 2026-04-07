import Booking from "../../models/booking.model.js";
import User from "../../models/user.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";
import { Payment } from "../../models/payment.model.js";
import { AdminSettings } from "../../models/adminSettings.model.js";

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function prevMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pctChange(current, prev) {
  if (prev === 0) return current > 0 ? 100 : null;
  return parseFloat((((current - prev) / prev) * 100).toFixed(1));
}

export const getAdminKPIs = async (req, res) => {
  try {
    const { start: cmStart, end: cmEnd } = currentMonthRange();
    const { start: pmStart, end: pmEnd } = prevMonthRange();
    const last30Start = daysAgo(30);

    const totalUsers = await User.countDocuments({ role: "customer" });
    const newUsersThisMonth = await User.countDocuments({ role: "customer", createdAt: { $gte: cmStart, $lte: cmEnd } });
    const newUsersLastMonth = await User.countDocuments({ role: "customer", createdAt: { $gte: pmStart, $lte: pmEnd } });

    const activeProviders = await ServiceProvider.countDocuments({ isVerified: true, isBlocked: false, isDeleted: false });
    const pendingProviders = await ServiceProvider.countDocuments({ isVerified: false, isDeleted: false });
    const blockedProviders = await ServiceProvider.countDocuments({ isBlocked: true, isDeleted: false });

    const activeProvidersLastMonth = await ServiceProvider.countDocuments({
      isVerified: true, isBlocked: false, isDeleted: false,
      createdAt: { $lte: pmEnd }
    });

    const totalBookings = await Booking.countDocuments();
    const bookingsThisMonth = await Booking.countDocuments({ createdAt: { $gte: cmStart, $lte: cmEnd } });
    const bookingsLastMonth_val = await Booking.countDocuments({ createdAt: { $gte: pmStart, $lte: pmEnd } });

    const bookingsLast30 = await Booking.countDocuments({ createdAt: { $gte: last30Start } });

    const revenueAgg = await Booking.aggregate([
      { $match: { bookingStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } }
    ]);
    const totalRevenue = revenueAgg[0]?.total ?? 0;

    const revenueThisMonthAgg = await Booking.aggregate([
      { $match: { bookingStatus: "completed", completedAt: { $gte: cmStart, $lte: cmEnd } } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } }
    ]);
    const revenueThisMonth = revenueThisMonthAgg[0]?.total ?? 0;

    const revenueLastMonthAgg = await Booking.aggregate([
      { $match: { bookingStatus: "completed", completedAt: { $gte: pmStart, $lte: pmEnd } } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } }
    ]);
    const revenueLastMonth = revenueLastMonthAgg[0]?.total ?? 0;

    const settings = await AdminSettings.findOne();
    const rate = settings?.platformCommissionRate ?? 0.15;

    const totalEarnings = revenueAgg[0]?.total ? revenueAgg[0].total * rate : 0;
    const earningsThisMonth = revenueThisMonthAgg[0]?.total ? revenueThisMonthAgg[0].total * rate : 0;
    const earningsLastMonth = revenueLastMonthAgg[0]?.total ? revenueLastMonthAgg[0].total * rate : 0;

    return res.status(200).json({
      totalUsers,
      usersTrend: pctChange(newUsersThisMonth, newUsersLastMonth),

      activeProviders,
      pendingProviders,
      blockedProviders,
      activeProvidersTrend: pctChange(activeProviders, activeProvidersLastMonth),

      totalBookings,
      bookingsTrend: pctChange(bookingsThisMonth, bookingsLastMonth_val),

      totalRevenue,
      revenueTrend: pctChange(revenueThisMonth, revenueLastMonth),

      totalEarnings,
      earningsTrend: pctChange(earningsThisMonth, earningsLastMonth),

      bookingsLast30,
    });
  } catch (error) {
    console.error("getAdminKPIs Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const getBookingsTrend = async (req, res) => {
  try {
    const range = req.query.range || "last7days";
    let matchStage, groupStage, labelKey;

    if (range === "last7days") {
      const start = daysAgo(6); matchStage = { $match: { createdAt: { $gte: start } } };
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          bookings: { $sum: 1 }
        }
      };
      labelKey = "date";
    } else if (range === "currentMonth") {
      const { start, end } = currentMonthRange();
      matchStage = { $match: { createdAt: { $gte: start, $lte: end } } };
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          bookings: { $sum: 1 }
        }
      };
      labelKey = "date";
    } else {
      const start = new Date();
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      matchStage = { $match: { createdAt: { $gte: start } } };
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          bookings: { $sum: 1 }
        }
      };
      labelKey = "month";
    }

    const raw = await Booking.aggregate([
      matchStage,
      groupStage,
      { $sort: { _id: 1 } }
    ]);

    const data = raw.map(d => ({ [labelKey]: d._id, bookings: d.bookings }));
    return res.status(200).json({ range, data });
  } catch (error) {
    console.error("getBookingsTrend Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const getRevenueTrend = async (req, res) => {
  try {
    const range = req.query.range || "last7days";

    let matchStage, groupStage, labelKey;

    if (range === "last7days") {
      const start = daysAgo(6);
      matchStage = { $match: { bookingStatus: "completed", completedAt: { $gte: start } } };
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          revenue: { $sum: "$finalAmount" }
        }
      };
      labelKey = "date";
    } else if (range === "currentMonth") {
      const { start, end } = currentMonthRange();
      matchStage = { $match: { bookingStatus: "completed", completedAt: { $gte: start, $lte: end } } };
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          revenue: { $sum: "$finalAmount" }
        }
      };
      labelKey = "date";
    } else {
      const start = new Date();
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      matchStage = { $match: { bookingStatus: "completed", completedAt: { $gte: start } } };
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$completedAt" } },
          revenue: { $sum: "$finalAmount" }
        }
      };
      labelKey = "month";
    }

    const raw = await Booking.aggregate([
      matchStage,
      groupStage,
      { $sort: { _id: 1 } }
    ]);

    const data = raw.map(d => ({ [labelKey]: d._id, revenue: d.revenue ?? 0 }));
    return res.status(200).json({ range, data });
  } catch (error) {
    console.error("getRevenueTrend Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const getProviderStatus = async (req, res) => {
  try {
    const active = await ServiceProvider.countDocuments({ isVerified: true, isBlocked: false, isDeleted: false });
    const pending = await ServiceProvider.countDocuments({ isVerified: false, isDeleted: false });
    const blocked = await ServiceProvider.countDocuments({ isBlocked: true, isDeleted: false });

    return res.status(200).json([
      { name: "Active", value: active },
      { name: "Pending", value: pending },
      { name: "Blocked", value: blocked },
    ]);
  } catch (error) {
    console.error("getProviderStatus Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const getBookingStatus = async (req, res) => {
  try {
    const [completed, confirmed, inProgress, cancelled] = await Promise.all([
      Booking.countDocuments({ bookingStatus: "completed" }),
      Booking.countDocuments({ bookingStatus: "confirmed" }),
      Booking.countDocuments({ bookingStatus: "in_progress" }),
      Booking.countDocuments({ bookingStatus: "cancelled" }),
    ]);

    return res.status(200).json([
      { name: "Completed", value: completed },
      { name: "Confirmed", value: confirmed },
      { name: "In Progress", value: inProgress },
      { name: "Cancelled", value: cancelled },
    ]);
  } catch (error) {
    console.error("getBookingStatus Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const getCategoryPopularity = async (req, res) => {
  try {
    const data = await Booking.aggregate([
      {
        $lookup: {
          from: "services",
          localField: "service",
          foreignField: "_id",
          as: "serviceData"
        }
      },
      { $unwind: "$serviceData" },
      {
        $lookup: {
          from: "servicecategories",
          localField: "serviceData.category",
          foreignField: "_id",
          as: "categoryData"
        }
      },
      { $unwind: "$categoryData" },
      {
        $group: {
          _id: "$categoryData.name",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1
        }
      }
    ]);

    return res.status(200).json(data);
  } catch (error) {
    console.error("getCategoryPopularity Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};
