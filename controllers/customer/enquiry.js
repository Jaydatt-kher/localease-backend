import { Enquiry } from "../../models/enquiry.model.js";
import { ProviderResponse } from "../../models/providerResponse.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";
import Service from "../../models/services.model.js";
import User from "../../models/user.model.js";
import Notification from "../../models/notification.model.js";
import { AdminSettings } from "../../models/adminSettings.model.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Booking from "../../models/booking.model.js";

function validateFutureDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr)
    return { valid: false, message: "Preferred date and time are required." };

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    isNaN(hours) || isNaN(minutes) ||
    hours < 0 || hours > 23 || minutes < 0 || minutes > 59
  )
    return { valid: false, message: "Invalid date or time format." };

  const combined = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (isNaN(combined.getTime()))
    return { valid: false, message: "Invalid date or time." };

  if (combined <= new Date(Date.now() + 30 * 60 * 1000))
    return {
      valid: false,
      message: "Preferred date/time must be at least 30 minutes in the future.",
    };

  return { valid: true, date: combined };
}

export const createEnquiry = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId;
    const {
      serviceId,
      providerId,
      message,
      prefferedDate,
      prefferedTime,
      location,
    } = req.body;

    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "A valid Service ID is required." });
    }
    if (!location?.address?.trim()) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Service address is required." });
    }
    if (
      location.lat == null || location.lng == null ||
      isNaN(Number(location.lat)) || isNaN(Number(location.lng))
    ) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({
        success: false,
        message: "Please select an area from the suggestions to confirm the location.",
      });
    }

    const dtCheck = validateFutureDateTime(prefferedDate, prefferedTime);
    if (!dtCheck.valid) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: dtCheck.message });
    }

    const requestingUser = await User.findById(userId).select("mobileNo isMobileVerified").lean();
    if (!requestingUser?.mobileNo || !requestingUser?.isMobileVerified) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({
        success: false,
        message: "Please add and verify your mobile number in your profile before sending an enquiry.",
      });
    }

    const existingQuery = { user: userId, service: serviceId, status: "open" };
    if (providerId) {
      existingQuery.providers = providerId;
    }
    const existingEnquiry = await Enquiry.findOne(existingQuery).session(session);

    if (existingEnquiry) {
      const daysDiff =
        (Date.now() - new Date(existingEnquiry.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysDiff >= 2) {
        existingEnquiry.status = "closed";
        await existingEnquiry.save({ session });
        await ProviderResponse.updateMany(
          { enquiry: existingEnquiry._id, status: "pending" },
          { $set: { status: "rejected_by_user" } },
          { session }
        );
      } else {
        await session.abortTransaction(); session.endSession();
        return res.status(400).json({
          success: false,
          message: providerId
            ? "You already have an active request with this provider for this service. Please wait 2 days before sending another."
            : "You already have an active mass request for this service. Please wait 2 days before sending another.",
        });
      }
    }

    let targetProviders = [];

    if (providerId && mongoose.Types.ObjectId.isValid(providerId)) {
      targetProviders.push(new mongoose.Types.ObjectId(providerId));
    } else {
      const areaCoords = [Number(location.lng), Number(location.lat)];
      const OUTER_CAP_METRES = 100_000;

      const adminSettings = await AdminSettings.findOne();
      const minWalletBalance = adminSettings?.minWalletBalance ?? 100;

      const nearbyProviders = await ServiceProvider.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: areaCoords },
            distanceField: "distanceFromJob",
            maxDistance: OUTER_CAP_METRES,
            spherical: true,
            query: {
              isActive: true,
              isBlocked: false,
              isDeleted: false,
              walletBalance: { $gte: minWalletBalance },
            },
          },
        },
        {
          $match: {
            $expr: {
              $lte: [
                "$distanceFromJob", { $multiply: [{ $ifNull: ["$serviceRadius", 10] }, 1000] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "providerservices",
            localField: "_id",
            foreignField: "providerId",
            as: "services",
          },
        },
        {
          $match: {
            "services.serviceId": new mongoose.Types.ObjectId(serviceId),
            "services.isAvailable": true,
            "services.isDeleted": false,
          },
        },
        { $project: { _id: 1 } },
      ]);

      targetProviders = nearbyProviders.map((p) => p._id);

      if (targetProviders.length === 0) {
        await session.abortTransaction(); session.endSession();
        return res.status(404).json({
          success: false,
          message: "No available providers found in this city for this service. Try a nearby city.",
        });
      }
    }

    const [enquiry] = await Enquiry.create(
      [
        {
          user: userId,
          service: serviceId,
          providers: targetProviders,
          message: message?.trim() || undefined,
          prefferedDate: dtCheck.date,
          prefferedTime,
          location: {
            address: location.address.trim(),
            city: location.city?.trim() || null,
            lat: Number(location.lat),
            lng: Number(location.lng),
          },
          status: "open",
        },
      ],
      { session }
    );

    const providerResponseDocs = await ProviderResponse.insertMany(
      targetProviders.map((pId) => ({
        enquiry: enquiry._id,
        provider: pId,
        price: 0,
        status: "pending",
      })),
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    setImmediate(async () => {
      try {
        const [sender, serviceDoc] = await Promise.all([
          User.findById(userId).select("fullName").lean(),
          Service.findById(serviceId).select("name").lean(),
        ]);

        const userName = sender?.fullName ?? "A customer";
        const serviceName = serviceDoc?.name ?? "a service";

        const responseMap = {};
        for (const r of providerResponseDocs) {
          responseMap[r.provider.toString()] = r._id;
        }

        const providers = await ServiceProvider.find({
          _id: { $in: targetProviders },
        })
          .select("userId")
          .lean();

        const notificationDocs = providers.map((p) => ({
          recipient: p.userId,
          type: "NEW_ENQUIRY",
          title: "New Service Request",
          body: `${userName} needs ${serviceName} at ${location.address || location.city
            } on ${prefferedDate} at ${prefferedTime}.`,
          senderName: userName,
          enquiryId: enquiry._id,
          responseId: responseMap[p._id.toString()] ?? null,
          meta: {
            serviceName,
            address: location.address,
            preferredDate: prefferedDate,
            preferredTime: prefferedTime,
            enquiryMessage: message?.trim() || null,
          },
        }));

        await Notification.insertMany(notificationDocs);
      } catch (err) {
        console.error("NEW_ENQUIRY notification error:", err.message);
      }
    });

    return res.status(201).json({
      success: true,
      message: `Enquiry sent to ${targetProviders.length} provider${targetProviders.length !== 1 ? "s" : ""
        } in your city.`,
      enquiryId: enquiry._id,
    });
  } catch (error) {
    await session.abortTransaction(); session.endSession();
    console.error("createEnquiry Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const cancelEnquiry = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.userId;
    const { enquiryId } = req.params;

    const enquiry = await Enquiry.findOne({ _id: enquiryId, user: userId }).session(session);
    if (!enquiry) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({
        success: false,
        message: "Enquiry not found or you do not have permission to cancel it.",
      });
    }
    if (enquiry.status !== "open") {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({
        success: false,
        message: `This enquiry cannot be cancelled because its status is already '${enquiry.status}'.`,
      });
    }

    enquiry.status = "closed";
    await enquiry.save({ session });
    await ProviderResponse.updateMany(
      { enquiry: enquiryId, status: { $in: ["pending", "responded"] } },
      { $set: { status: "rejected_by_user" } },
      { session }
    );

    await session.commitTransaction(); session.endSession();
    return res.status(200).json({
      success: true,
      message: "Your enquiry has been cancelled successfully.",
    });
  } catch (error) {
    await session.abortTransaction(); session.endSession();
    console.error("cancelEnquiry Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const getAllServiceRequest = async (req, res) => {
  try {
    const userId = req.userId;
    const enquiries = await Enquiry.find({ user: userId })
      .populate("service", "name")
      .sort({ createdAt: -1 })
      .lean();

    if (!enquiries?.length) {
      return res.status(200).json({
        success: true,
        message: "You have no active or past service requests.",
        count: 0,
        data: [],
      });
    }

    const enquiryIds = enquiries.map((e) => e._id);
    const bidCounts = await ProviderResponse.aggregate([
      { $match: { enquiry: { $in: enquiryIds }, status: "responded" } },
      { $group: { _id: "$enquiry", count: { $sum: 1 } } },
    ]);
    const bidCountMap = Object.fromEntries(
      bidCounts.map((b) => [b._id.toString(), b.count])
    );
    const enriched = enquiries.map((e) => ({
      ...e,
      bidsReceived: bidCountMap[e._id.toString()] || 0,
    }));

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error("getAllServiceRequest Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const getEnquiryById = async (req, res) => {
  try {
    const userId = req.userId;
    const { enquiryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(enquiryId))
      return res.status(400).json({ success: false, message: "Invalid Enquiry ID." });

    const enquiry = await Enquiry.findOne({ _id: enquiryId, user: userId })
      .populate("service", "name description category")
      .lean();

    if (!enquiry)
      return res.status(404).json({
        success: false,
        message: "Enquiry not found or you do not have permission to view it.",
      });

    const bids = await ProviderResponse.find({
      enquiry: enquiryId,
      status: { $in: ["responded", "accepted_by_user"] },
    })
      .populate({
        path: "provider",
        select: "businessName profilePicture experienceYears rating completedJobs city",
        populate: { path: "userId", select: "fullName" },
      })
      .sort({ price: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        enquiryDetails: enquiry,
        totalBids: bids.filter((b) => b.provider).length,
        bids: bids.filter((b) => b.provider),
      },
    });
  } catch (error) {
    console.error("getEnquiryById Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const acceptProviderBids = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.userId;
    const { responseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(responseId)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Invalid Bid ID format" });
    }

    const winningBid = await ProviderResponse.findById(responseId)
      .populate("enquiry")
      .session(session);

    if (!winningBid?.enquiry) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({
        success: false,
        message: "Bid or associated enquiry not found.",
      });
    }
    if (winningBid.enquiry.user.toString() !== userId.toString()) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({
        success: false,
        message: "You do not have permission to accept this bid.",
      });
    }
    if (winningBid.enquiry.status !== "open") {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({
        success: false,
        message: `This enquiry is already '${winningBid.enquiry.status}'.`,
      });
    }
    if (winningBid.status !== "responded") {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({
        success: false,
        message: `This bid cannot be accepted — status is '${winningBid.status}'.`,
      });
    }

    const enquiryId = winningBid.enquiry._id;
    winningBid.status = "accepted_by_user";
    await winningBid.save({ session });

    await Enquiry.findByIdAndUpdate(enquiryId, { status: "booked" }, { session });

    const rejectedResponses = await ProviderResponse.find({
      enquiry: enquiryId,
      _id: { $ne: winningBid._id },
      status: "responded",
    })
      .select("provider")
      .session(session)
      .lean();

    await ProviderResponse.updateMany(
      { enquiry: enquiryId, _id: { $ne: winningBid._id } },
      { $set: { status: "rejected_by_user" } },
      { session }
    );

    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const hashedOtp = await bcrypt.hash(generatedOtp, 10);
    const otpExpiry = new Date(winningBid.availableTime);
    otpExpiry.setDate(otpExpiry.getDate() + 1);
    otpExpiry.setHours(23, 59, 59, 999);

    const bookingId = `BK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const priceType = winningBid.priceType ?? "inspection";
    const quotedPrice = winningBid.price ?? null;
    const finalAmount = priceType === "fixed" ? quotedPrice : null;

    const [newBooking] = await Booking.create(
      [
        {
          bookingId,
          user: userId,
          provider: winningBid.provider,
          providerResponse: winningBid._id,
          enquiry: enquiryId,
          service: winningBid.enquiry.service,
          scheduledTime: winningBid.availableTime,
          priceType,
          quotedPrice,
          finalAmount,
          bookingAddress: { text: winningBid.enquiry.location.address },
          startOtp: { code: hashedOtp, expires: otpExpiry, isUsed: false },
          bookingStatus: "confirmed",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    setImmediate(async () => {
      try {
        const [acceptingUser, serviceDoc, winningProvider] = await Promise.all([
          User.findById(userId).select("fullName").lean(),
          Service.findById(winningBid.enquiry.service).select("name").lean(),
          ServiceProvider.findById(winningBid.provider).select("userId").lean(),
        ]);

        const userName = acceptingUser?.fullName ?? "The customer";
        const serviceName = serviceDoc?.name ?? "a service";
        const scheduledISO = winningBid.availableTime
          ? new Date(winningBid.availableTime).toLocaleString("en-IN", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })
          : null;

        const notifications = [];

        if (winningProvider?.userId) {
          notifications.push({
            recipient: winningProvider.userId,
            type: "BID_ACCEPTED",
            title: "Your bid was accepted! 🎉",
            body: `${userName} accepted your bid${scheduledISO ? ` for ${scheduledISO}` : ""
              }. Booking ${bookingId} is confirmed.`,
            senderName: userName,
            enquiryId,
            bookingId: newBooking._id,
            bookingRef: bookingId,
            meta: {
              serviceName,
              scheduledTime: winningBid.availableTime,
              priceType,
              quotedPrice,
            },
          });
        }

        if (rejectedResponses.length > 0) {
          const rejectedProviderIds = rejectedResponses.map((r) => r.provider);
          const rejectedProviders = await ServiceProvider.find({
            _id: { $in: rejectedProviderIds },
          })
            .select("userId")
            .lean();

          for (const p of rejectedProviders) {
            notifications.push({
              recipient: p.userId,
              type: "BID_REJECTED",
              title: "Request no longer available",
              body: `The customer chose another provider for their ${serviceName} request.`,
              senderName: userName,
              enquiryId,
              meta: { serviceName },
            });
          }
        }

        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
        }
      } catch (err) {
        console.error("BID_ACCEPTED/BID_REJECTED notification error:", err.message);
      }
    });

    return res.status(201).json({
      success: true,
      message: "Booking Confirmed!",
      data: {
        bookingId: newBooking._id,
        bookingRef: bookingId,
        scheduledTime: winningBid.availableTime,
        priceType,
        quotedPrice,
        finalAmount,
        otp: generatedOtp,
        otpExpires: otpExpiry,
      },
    });
  } catch (error) {
    await session.abortTransaction(); session.endSession();
    console.error("acceptProviderBids Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};