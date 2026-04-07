import express from 'express';
import { isAuth } from "../middleware/isAuth.js";
import { getAllCategories, getAllServices, getServiceDetails, getServicesByCategory, searchService, searchUnified } from "../controllers/customer/service.js";
import { getFilteredProvidersForServices, getNearbyProivders, getProviderByServices, getProviderDetails } from "../controllers/customer/provider.js";
import { acceptProviderBids, cancelEnquiry, createEnquiry, getAllServiceRequest, getEnquiryById } from "../controllers/customer/enquiry.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import { getBookingById, getMyBookings, cancelBooking } from '../controllers/customer/booking.js';
import { updateUserLocation } from '../controllers/customer/location.js';
import { deleteMyAccount, getMyProfile, updateMyProfile } from '../controllers/customer/profile.js';
import { addReview } from '../controllers/customer/review.js';
import { actionLimiter, searchLimiter, servicesLimiter } from '../middleware/rateLimiter.js';
const customerRouter = express.Router();

customerRouter.get("/profile", isAuth, authorizeRoles("customer", "serviceProvider"), getMyProfile)
customerRouter.patch("/update-profile", isAuth, authorizeRoles("customer", "serviceProvider"), updateMyProfile)
customerRouter.delete("/delete-account", isAuth, authorizeRoles("customer", "serviceProvider"), deleteMyAccount)

customerRouter.get("/services/categories", servicesLimiter, getAllCategories)
customerRouter.get("/categories/:categoryId/services", servicesLimiter, getServicesByCategory);
customerRouter.get("/services/all", servicesLimiter, getAllServices);
customerRouter.get("/services/search-unified", searchLimiter, searchUnified)
customerRouter.get("/services/search", searchLimiter, searchService);
customerRouter.get("/services/:serviceId", servicesLimiter, getServiceDetails);

customerRouter.get("/providers/nearby", getNearbyProivders);
customerRouter.get("/providers/:serviceId", getProviderByServices)
customerRouter.get("/provider-details/:id", getProviderDetails)
customerRouter.get("/filter-providers/:serviceId", getFilteredProvidersForServices)

customerRouter.post("/create-enquiry", isAuth, authorizeRoles("customer"), actionLimiter, createEnquiry)
customerRouter.delete("/cancel-enquiry/:enquiryId", isAuth, authorizeRoles("customer"), actionLimiter, cancelEnquiry)
customerRouter.get("/all-request", isAuth, authorizeRoles("customer"), getAllServiceRequest)
customerRouter.get("/enquiry/:enquiryId", isAuth, authorizeRoles("customer"), getEnquiryById)
customerRouter.post("/enquiry/:responseId/accept", isAuth, authorizeRoles("customer"), actionLimiter, acceptProviderBids)

customerRouter.get("/bookings", isAuth, authorizeRoles("customer"), getMyBookings)
customerRouter.get("/bookings/:id", isAuth, authorizeRoles("customer"), getBookingById)
customerRouter.patch("/bookings/:id/cancel", isAuth, authorizeRoles("customer"), actionLimiter, cancelBooking)

customerRouter.patch("/update-location", isAuth, authorizeRoles("customer"), updateUserLocation)

customerRouter.post("/reviews", isAuth, authorizeRoles("customer"), addReview)

export default customerRouter;