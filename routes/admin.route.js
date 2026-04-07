import express from "express";
import { isAuth } from "../middleware/isAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import upload from "../middleware/multer.js";
import {
  getAdminKPIs,
  getBookingsTrend,
  getRevenueTrend,
  getProviderStatus,
  getBookingStatus,
  getCategoryPopularity,
} from "../controllers/admin/dashboard.js";
import { createService, deleteService, getServices, updateService, getAdminServiceStats } from "../controllers/admin/service.js";
import { createCategory, deleteCategory, getCategories, updateCategory, getCategoryStats } from "../controllers/admin/category.js";
import { getAdminBookings, getAdminBookingStats, getAdminBookingById } from "../controllers/admin/booking.js";
import { getAdminPaymentStats, getAdminPayments } from "../controllers/admin/payment.js";
import { getAdminReviewStats, getAdminReviews, deleteAdminReview } from "../controllers/admin/review.js";
import { getAdminNotificationStats, getAdminNotifications, markNotificationRead, deleteAdminNotification } from "../controllers/admin/notification.js";
import { getAdminSettings, updateAdminSettings } from "../controllers/admin/settings.js";
import { getAdminProfile, updateAdminProfile, updateAdminPassword } from "../controllers/admin/profile.js";
import { sendOtpMobile, verifyOtpMobile } from "../controllers/auth.controller.js";
import { getAdminCities, getAdminCityStats, createCity, updateCity, deleteCity } from "../controllers/admin/city.js";
import {
  approveServiceProvider, blockProvider, deleteProvider,
  getAllServiceProviders, getProviderDetailsById, getProviderStats,
  rejectProvider, restoreProvider, unblockProvider, getPendingProviders
} from "../controllers/admin/serviceProvider.js";

import { getAllUsers, getUserById, getUserStats, blockUser, unblockUser } from "../controllers/admin/users.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";

const adminRouter = express.Router();
const adminAuth = [isAuth, authorizeRoles("admin")];

adminRouter.get("/dashboard/kpis", ...adminAuth, getAdminKPIs);
adminRouter.get("/dashboard/bookings-trend", ...adminAuth, getBookingsTrend);
adminRouter.get("/dashboard/revenue-trend", ...adminAuth, getRevenueTrend);
adminRouter.get("/dashboard/provider-status", ...adminAuth, getProviderStatus);
adminRouter.get("/dashboard/booking-status", ...adminAuth, getBookingStatus);
adminRouter.get("/dashboard/category-popularity", ...adminAuth, getCategoryPopularity);

adminRouter.get("/profile", ...adminAuth, getAdminProfile);
adminRouter.put("/profile", ...adminAuth, updateAdminProfile);
adminRouter.put("/profile/password", ...adminAuth, updateAdminPassword);
adminRouter.post("/profile/send-otp-mobile", ...adminAuth, sendOtpMobile);
adminRouter.post("/profile/verify-otp-mobile", ...adminAuth, verifyOtpMobile);

adminRouter.get("/users/stats", ...adminAuth, getUserStats);
adminRouter.get("/users", ...adminAuth, getAllUsers);
adminRouter.get("/users/:id", ...adminAuth, getUserById);
adminRouter.patch("/users/:id/block", ...adminAuth, blockUser);
adminRouter.patch("/users/:id/unblock", ...adminAuth, unblockUser);

adminRouter.get("/categories/stats", ...adminAuth, getCategoryStats);
adminRouter.post("/categories", ...adminAuth, createCategory);
adminRouter.get("/categories", ...adminAuth, getCategories);
adminRouter.put("/categories/:id", ...adminAuth, updateCategory);
adminRouter.delete("/categories/:id", ...adminAuth, deleteCategory);

adminRouter.get("/services/stats", ...adminAuth, getAdminServiceStats);
adminRouter.get("/services", ...adminAuth, getServices);
adminRouter.post("/services", ...adminAuth, uploadLimiter, upload.array("images", 5), createService);
adminRouter.put("/services/:id", ...adminAuth, uploadLimiter, upload.array("images", 5), updateService);
adminRouter.delete("/services/:id", ...adminAuth, deleteService);

adminRouter.get("/cities/stats", ...adminAuth, getAdminCityStats);
adminRouter.get("/cities", ...adminAuth, getAdminCities);
adminRouter.post("/cities", ...adminAuth, createCity);
adminRouter.put("/cities/:id", ...adminAuth, updateCity);
adminRouter.delete("/cities/:id", ...adminAuth, deleteCity);

adminRouter.get("/get-all-providers", ...adminAuth, getAllServiceProviders);
adminRouter.get("/provider-details/:id", ...adminAuth, getProviderDetailsById);
adminRouter.patch("/block-provider/:id", ...adminAuth, blockProvider);
adminRouter.patch("/unblock-provider/:id", ...adminAuth, unblockProvider);
adminRouter.patch("/delete-provider/:id", ...adminAuth, deleteProvider);
adminRouter.patch("/restore-provider/:id", ...adminAuth, restoreProvider);
adminRouter.patch("/approve-provider/:id", ...adminAuth, approveServiceProvider);

adminRouter.get("/providers/stats", ...adminAuth, getProviderStats);
adminRouter.get("/providers/pending-list", ...adminAuth, getPendingProviders);
adminRouter.get("/providers", ...adminAuth, getAllServiceProviders);
adminRouter.get("/providers/:id", ...adminAuth, getProviderDetailsById);
adminRouter.patch("/providers/:id/approve", ...adminAuth, approveServiceProvider);
adminRouter.patch("/providers/:id/reject", ...adminAuth, rejectProvider);
adminRouter.patch("/providers/:id/block", ...adminAuth, blockProvider);
adminRouter.patch("/providers/:id/unblock", ...adminAuth, unblockProvider);
adminRouter.patch("/providers/:id/delete", ...adminAuth, deleteProvider);

adminRouter.get("/bookings/stats", ...adminAuth, getAdminBookingStats);
adminRouter.get("/bookings", ...adminAuth, getAdminBookings);
adminRouter.get("/bookings/:id", ...adminAuth, getAdminBookingById);

adminRouter.get("/payments/stats", ...adminAuth, getAdminPaymentStats);
adminRouter.get("/payments", ...adminAuth, getAdminPayments);

adminRouter.get("/reviews/stats", ...adminAuth, getAdminReviewStats);
adminRouter.get("/reviews", ...adminAuth, getAdminReviews);
adminRouter.delete("/reviews/:id", ...adminAuth, deleteAdminReview);

adminRouter.get("/notifications/stats", ...adminAuth, getAdminNotificationStats);
adminRouter.get("/notifications", ...adminAuth, getAdminNotifications);
adminRouter.patch("/notifications/:id/toggle-read", ...adminAuth, markNotificationRead);
adminRouter.delete("/notifications/:id", ...adminAuth, deleteAdminNotification);

adminRouter.get("/settings", ...adminAuth, getAdminSettings);
adminRouter.put("/settings", ...adminAuth, updateAdminSettings);

export default adminRouter;