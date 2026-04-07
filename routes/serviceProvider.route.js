import express from "express";
import { isAuth } from "../middleware/isAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import { createProfile, deleteProfile, getCities, getProfile, updateProfile, linkProviderBank } from "../controllers/serviceProvider/profile.js";
import { createProviderService, deleteProviderService, getMyServices, getProviderServiceById, updateProviderService } from "../controllers/serviceProvider/providerService.js";
import { getMyBidHistory, getNewRequest, ignoreRequest, respondToEnquiry, updateMyBid } from "../controllers/serviceProvider/response.js";
import { getProviderBookingById, getProviderBookings, setFinalAmount, cancelProviderBooking, startJob, generateCompleteOtp } from "../controllers/serviceProvider/booking.js";
import { sendOtpMobile, verifyOtpMobile } from "../controllers/auth.controller.js";
import { actionLimiter, otpLimiter } from "../middleware/rateLimiter.js";
const serviceProviderRouter = express.Router();
serviceProviderRouter.post("/profile", isAuth, authorizeRoles("customer"), createProfile);
serviceProviderRouter.put("/update-profile", isAuth, authorizeRoles("serviceProvider"), updateProfile);
serviceProviderRouter.delete("/delete-profile", isAuth, authorizeRoles("serviceProvider"), deleteProfile);
serviceProviderRouter.get("/get-profile", isAuth, authorizeRoles("serviceProvider"), getProfile);
serviceProviderRouter.get("/cities", getCities);
serviceProviderRouter.post("/link-bank", isAuth, authorizeRoles("serviceProvider"), actionLimiter, linkProviderBank);
serviceProviderRouter.post("/send-otp-mobile", isAuth, authorizeRoles("serviceProvider"), otpLimiter, sendOtpMobile);
serviceProviderRouter.post("/verify-otp-mobile", isAuth, authorizeRoles("serviceProvider"), otpLimiter, verifyOtpMobile);

serviceProviderRouter.post("/create-service", isAuth, authorizeRoles("serviceProvider"), createProviderService);
serviceProviderRouter.put("/update-service/:id", isAuth, authorizeRoles("serviceProvider"), updateProviderService);
serviceProviderRouter.delete("/delete-service/:id", isAuth, authorizeRoles("serviceProvider"), deleteProviderService);
serviceProviderRouter.get("/get-service/:id", isAuth, authorizeRoles("serviceProvider"), getProviderServiceById);
serviceProviderRouter.get("/get-all-service", isAuth, authorizeRoles("serviceProvider"), getMyServices);

serviceProviderRouter.get("/new-request", isAuth, authorizeRoles("serviceProvider"), getNewRequest);
serviceProviderRouter.put("/requests/:responseId/respond", isAuth, authorizeRoles("serviceProvider"), actionLimiter, respondToEnquiry)
serviceProviderRouter.put("/requests/:responseId/update", isAuth, authorizeRoles("serviceProvider"), actionLimiter, updateMyBid)
serviceProviderRouter.put("/requests/:responseId/ignore", isAuth, authorizeRoles("serviceProvider"), actionLimiter, ignoreRequest)
serviceProviderRouter.get("/get-my-bid", isAuth, authorizeRoles("serviceProvider"), getMyBidHistory)

serviceProviderRouter.get("/bookings", isAuth, authorizeRoles("serviceProvider"), getProviderBookings)
serviceProviderRouter.get("/bookings/:id", isAuth, authorizeRoles("serviceProvider"), getProviderBookingById)
serviceProviderRouter.patch("/bookings/:id/set-final-amount", isAuth, authorizeRoles("serviceProvider"), actionLimiter, setFinalAmount);
serviceProviderRouter.patch("/bookings/:id/cancel", isAuth, authorizeRoles("serviceProvider"), actionLimiter, cancelProviderBooking);

serviceProviderRouter.post("/bookings/:id/start-job", isAuth, authorizeRoles("serviceProvider"), actionLimiter, startJob);
serviceProviderRouter.post("/bookings/:id/generate-complete-otp", isAuth, authorizeRoles("serviceProvider"), otpLimiter, generateCompleteOtp);

export default serviceProviderRouter;