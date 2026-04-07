import User from "../../models/user.model.js";
import Booking from "../../models/booking.model.js";

function prevMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function pctChange(current, prev) {
  if (prev === 0) return current > 0 ? 100 : null;
  return parseFloat((((current - prev) / prev) * 100).toFixed(1));
}

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id, isDeleted: false })
      .select("fullName email mobileNo role status isEmailVerified isMobileVerified loyaltyPoints address createdAt")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [total, completed, cancelled, inProgress, confirmed] = await Promise.all([
      Booking.countDocuments({ user: id }),
      Booking.countDocuments({ user: id, bookingStatus: "completed" }),
      Booking.countDocuments({ user: id, bookingStatus: "cancelled" }),
      Booking.countDocuments({ user: id, bookingStatus: "in_progress" }),
      Booking.countDocuments({ user: id, bookingStatus: "confirmed" }),
    ]);

    const spentAgg = await Booking.aggregate([
      { $match: { user: user._id, bookingStatus: "completed" } },
      { $group: { _id: null, totalSpent: { $sum: "$finalAmount" } } },
    ]);
    const totalSpent = spentAgg[0]?.totalSpent ?? 0;

    const recentBookings = await Booking.find({ user: id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("service", "name")
      .populate({
        path: "provider",
        select: "businessName userId",
        populate: { path: "userId", select: "fullName" },
      })
      .select("bookingId bookingStatus scheduledTime completedAt finalAmount priceType createdAt service provider")
      .lean();

    const bookings = recentBookings.map((b) => ({
      _id: b._id,
      bookingId: b.bookingId,
      serviceName: b.service?.name ?? "—",
      providerName: b.provider?.businessName ?? b.provider?.userId?.fullName ?? "—",
      status: b.bookingStatus,
      scheduledTime: b.scheduledTime,
      completedAt: b.completedAt,
      amount: b.finalAmount,
      priceType: b.priceType,
      createdAt: b.createdAt,
    }));

    return res.status(200).json({
      user,
      stats: { total, completed, cancelled, inProgress, confirmed, totalSpent },
      recentBookings: bookings,
    });
  } catch (error) {
    console.error("getUserById Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const { start: cmStart, end: cmEnd } = currentMonthRange();
    const { start: pmStart, end: pmEnd } = prevMonthRange();

    const [totalUsers, activeUsers, blockedUsers, newThisMonth, newLastMonth] =
      await Promise.all([
        User.countDocuments({ role: "customer", isDeleted: false }),
        User.countDocuments({ role: "customer", status: "active", isDeleted: false }),
        User.countDocuments({ role: "customer", status: "blocked", isDeleted: false }),
        User.countDocuments({ role: "customer", isDeleted: false, createdAt: { $gte: cmStart, $lte: cmEnd } }),
        User.countDocuments({ role: "customer", isDeleted: false, createdAt: { $gte: pmStart, $lte: pmEnd } }),
      ]);

    return res.status(200).json({
      totalUsers,
      activeUsers,
      blockedUsers,
      newThisMonth,
      newThisMonthTrend: pctChange(newThisMonth, newLastMonth),
    });
  } catch (error) {
    console.error("getUserStats Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all", } = req.query;

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter = { role: "customer", isDeleted: false };
    if (status !== "all") filter.status = status;
    if (search.trim()) {
      filter.$or = [
        { fullName: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
        { mobileNo: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("fullName email mobileNo status isEmailVerified isMobileVerified createdAt loyaltyPoints")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const userIds = users.map((u) => u._id);
    const bookingCounts = await Booking.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]);
    const bookingMap = {};
    bookingCounts.forEach((b) => { bookingMap[b._id.toString()] = b.count; });

    const enriched = users.map((u) => ({
      _id: u._id,
      fullName: u.fullName,
      email: u.email,
      mobileNo: u.mobileNo || "—",
      status: u.status,
      isEmailVerified: u.isEmailVerified,
      isMobileVerified: u.isMobileVerified,
      loyaltyPoints: u.loyaltyPoints,
      bookings: bookingMap[u._id.toString()] ?? 0,
      joinedAt: u.createdAt,
    }));

    return res.status(200).json({
      users: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("getAllUsers Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOneAndUpdate(
      { _id: id, role: "customer", isDeleted: false },
      { status: "blocked" },
      { new: true, select: "_id fullName status" }
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, message: `${user.fullName} has been blocked.`, user });
  } catch (error) {
    console.error("blockUser Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOneAndUpdate(
      { _id: id, role: "customer", isDeleted: false },
      { status: "active" },
      { new: true, select: "_id fullName status" }
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, message: `${user.fullName} has been unblocked.`, user });
  } catch (error) {
    console.error("unblockUser Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};
