import { ProviderResponse } from "../../models/providerResponse.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";
import ProviderService from "../../models/providerService.model.js";
import { Enquiry } from "../../models/enquiry.model.js";
import Service from "../../models/services.model.js";
import Notification from "../../models/notification.model.js";
import mongoose from "mongoose";

function checkAvailability(availability, dateObj) {
  if (availability?.isVacationMode) {
    return {
      valid: false,
      message:
        "You are currently in vacation mode. Disable it before responding to enquiries.",
    };
  }

  dateObj = new Date(dateObj);

  const days = availability?.days ?? [];
  if (days.length === 0) return { valid: true };

  const dayName = dateObj.toLocaleString("en-IN", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });

  const dayConfig = days.find(
    (d) => d.day.toLowerCase() === dayName.toLowerCase()
  );

  if (!dayConfig || !dayConfig.isOpen) {
    return {
      valid: false,
      message: `You have marked ${dayName} as a day off in your availability schedule.`,
    };
  }

  if (dayConfig.startTime && dayConfig.endTime) {
    const [startH, startM] = dayConfig.startTime.split(":").map(Number);
    const [endH, endM] = dayConfig.endTime.split(":").map(Number);

    const hours = Number(
      dateObj.toLocaleString("en-IN", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      })
    );

    const minutes = Number(
      dateObj.toLocaleString("en-IN", {
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    );

    const proposedMinutes = hours * 60 + minutes;

    if (
      proposedMinutes < startH * 60 + startM ||
      proposedMinutes > endH * 60 + endM
    ) {
      return {
        valid: false,
        message: `Your working hours on ${dayName} are ${dayConfig.startTime}–${dayConfig.endTime}.`,
      };
    }
  }

  return { valid: true };
}

function validatePrice(priceType, price) {
  if (priceType === "fixed") {
    if (price == null || Number(price) <= 0)
      return {
        valid: false,
        message: "A fixed price greater than 0 is required for fixed-price bids.",
      };
  }
  if (priceType === "hourly") {
    if (price == null || Number(price) <= 0)
      return {
        valid: false,
        message: "An hourly rate greater than 0 is required for hourly bids.",
      };
  }
  if (priceType === "inspection") {
    if (price != null && Number(price) <= 0)
      return { valid: false, message: "If provided, price must be greater than 0." };
  }
  return { valid: true };
}

const VALID_PRICE_TYPES = ["fixed", "hourly", "inspection"];

export const getNewRequest = async (req, res) => {
  try {
    const userId = req.userId;
    const provider = await ServiceProvider.findOne({
      userId,
      isActive: true,
      isDeleted: false,
      isBlocked: false,
      isVerified: true,
    });
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider profile not found." });
    }

    const requests = await ProviderResponse.find({
      provider: provider._id,
      status: "pending",
    })
      .populate({
        path: "enquiry",
        match: { status: "open" },
        select: "service message location prefferedDate prefferedTime createdAt",
        populate: { path: "service", select: "name description images" },
      })
      .sort({ createdAt: -1 })
      .lean();

    const validRequests = requests.filter((r) => r.enquiry !== null);

    const enriched = await Promise.all(
      validRequests.map(async (r) => {
        const serviceId = r.enquiry?.service?._id;
        if (!serviceId) return r;
        const ps = await ProviderService.findOne({
          providerId: provider._id,
          serviceId,
          isDeleted: false,
        })
          .select("priceType price")
          .lean();
        return { ...r, myPriceType: ps?.priceType ?? null, myPrice: ps?.price ?? null };
      })
    );

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error("getNewRequest Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const respondToEnquiry = async (req, res) => {
  try {
    const userId = req.userId;
    const { responseId } = req.params;
    const { price, priceType = "inspection", availableTime, message } = req.body;

    if (!VALID_PRICE_TYPES.includes(priceType)) {
      return res.status(400).json({
        success: false,
        message: "priceType must be: fixed, hourly, or inspection.",
      });
    }
    if (!availableTime) {
      return res
        .status(400)
        .json({ success: false, message: "Available time is required" });
    }

    const priceCheck = validatePrice(priceType, price);
    if (!priceCheck.valid)
      return res
        .status(400)
        .json({ success: false, message: priceCheck.message });

    if (!mongoose.Types.ObjectId.isValid(responseId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Response ID format." });
    }

    const providerProfile = await ServiceProvider.findOne({
      userId,
      isActive: true,
      isBlocked: false,
      isDeleted: false,
      isVerified: true,
    }).populate("userId");

    if (!providerProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Provider profile not found." });
    }

    if (!providerProfile.userId?.mobileNo || !providerProfile.userId?.isMobileVerified) {
      return res.status(400).json({
        success: false,
        message: "Please add and verify your mobile number in your profile before bidding.",
      });
    }

    const proposedDate = new Date(availableTime);
    if (isNaN(proposedDate.getTime()))
      return res
        .status(400)
        .json({ success: false, message: "Invalid availableTime format." });
    if (proposedDate <= new Date())
      return res
        .status(400)
        .json({ success: false, message: "Available time must be in the future." });

    const availableCheck = checkAvailability(
      providerProfile.availability,
      proposedDate
    );
    if (!availableCheck.valid)
      return res
        .status(400)
        .json({ success: false, message: availableCheck.message });

    const response = await ProviderResponse.findOne({
      _id: responseId,
      provider: providerProfile._id,
    }).populate("enquiry");

    if (!response) {
      return res.status(404).json({
        success: false,
        message: "Request not found or you do not have permission.",
      });
    }
    if (!response.enquiry || response.enquiry.status !== "open") {
      return res
        .status(400)
        .json({ success: false, message: "This enquiry is no longer open." });
    }
    if (response.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `You have already responded to this request. Status: '${response.status}'.`,
      });
    }

    response.priceType = priceType;
    response.price = price;
    response.availableTime = new Date(availableTime);
    response.message = message || null;
    response.status = "responded";
    await response.save();

    setImmediate(async () => {
      try {
        const serviceDoc = await Service.findById(response.enquiry.service)
          .select("name")
          .lean();

        const serviceName = serviceDoc?.name ?? "a service";
        const providerBizName =
          providerProfile.businessName ?? "A provider";

        let priceDisplay;
        if (priceType === "inspection") {
          priceDisplay = "Price after inspection";
        } else if (price != null) {
          const priceLabel = priceType === "hourly" ? "/hr" : "fixed";
          priceDisplay = `₹${Number(price).toLocaleString("en-IN")} (${priceLabel})`;
        } else {
          priceDisplay = null;
        }

        const bodyParts = [
          `${providerBizName} sent a bid for your ${serviceName} request.`,
        ];
        if (priceDisplay) bodyParts.push(priceDisplay);
        if (message?.trim()) bodyParts.push(`"${message.trim()}"`);

        await Notification.create({
          recipient: response.enquiry.user,
          type: "PROVIDER_BID",
          title: `${providerBizName} responded to your request`,
          body: bodyParts.join(" — "),
          senderName: providerBizName,
          enquiryId: response.enquiry._id,
          responseId: response._id,
          meta: {
            serviceName,
            price: price ?? null,
            priceType,
            availableTime: new Date(availableTime),
            providerMessage: message?.trim() || null,
          },
        });
      } catch (err) {
        console.error("PROVIDER_BID notification error:", err.message);
      }
    });

    return res.status(200).json({
      success: true,
      message: "Your bid has been submitted successfully.",
      data: response,
    });
  } catch (error) {
    console.error("respondToEnquiry Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const updateMyBid = async (req, res) => {
  try {
    const userId = req.userId;
    const { responseId } = req.params;
    const { price, priceType, availableTime, message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(responseId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Response ID format." });
    }
    if (priceType && !VALID_PRICE_TYPES.includes(priceType)) {
      return res.status(400).json({
        success: false,
        message: "priceType must be: fixed, hourly, or inspection.",
      });
    }

    const provider = await ServiceProvider.findOne({
      userId,
      isActive: true,
      isBlocked: false,
      isDeleted: false,
      isVerified: true,
    }).populate("userId");
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider profile not found." });
    }

    if (!provider.userId?.mobileNo || !provider.userId?.isMobileVerified) {
      return res.status(400).json({
        success: false,
        message: "Please add and verify your mobile number in your profile before bidding.",
      });
    }

    const response = await ProviderResponse.findOne({
      _id: responseId,
      provider: provider._id,
    }).populate("enquiry", "status");

    if (!response) {
      return res.status(404).json({
        success: false,
        message: "Bid not found or you do not have permission.",
      });
    }
    if (response.status !== "responded") {
      return res.status(400).json({
        success: false,
        message: `Bid cannot be updated because its status is '${response.status}'.`,
      });
    }
    if (!response.enquiry || response.enquiry.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "This enquiry is no longer open for bidding.",
      });
    }

    const effectivePriceType = priceType ?? response.priceType;
    if (price !== undefined) {
      const priceCheck = validatePrice(effectivePriceType, price);
      if (!priceCheck.valid)
        return res
          .status(400)
          .json({ success: false, message: priceCheck.message });
    }
    if (availableTime !== undefined) {
      const proposedDate = new Date(availableTime);
      if (isNaN(proposedDate.getTime()))
        return res
          .status(400)
          .json({ success: false, message: "Invalid availableTime format." });
      if (proposedDate <= new Date())
        return res.status(400).json({
          success: false,
          message: "Available time must be in the future.",
        });
      const availCheck = checkAvailability(provider.availability, proposedDate);
      if (!availCheck.valid)
        return res
          .status(400)
          .json({ success: false, message: availCheck.message });
      response.availableTime = proposedDate;
    }

    if (priceType !== undefined) response.priceType = priceType;
    if (price !== undefined)
      response.price = price != null ? Number(price) : null;
    if (message !== undefined) response.message = message;

    await response.save();
    return res.status(200).json({
      success: true,
      message: "Your bid has been updated successfully.",
      data: response,
    });
  } catch (error) {
    console.error("updateMyBid Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const ignoreRequest = async (req, res) => {
  try {
    const userId = req.userId;
    const { responseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(responseId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Response ID format." });
    }

    const provider = await ServiceProvider.findOne({
      userId,
      isActive: true,
      isBlocked: false,
      isDeleted: false,
      isVerified: true,
    });
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider profile not found." });
    }

    const response = await ProviderResponse.findOne({
      _id: responseId,
      provider: provider._id,
    }).populate("enquiry", "status");
    if (!response) {
      return res.status(404).json({
        success: false,
        message: "Request not found or you do not have permission.",
      });
    }
    if (response.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot ignore this request. Current status: '${response.status}'.`,
      });
    }

    response.status = "rejected_by_user";
    response.enquiry.status = "closed";
    await response.save();
    await response.enquiry.save();

    return res.status(200).json({
      success: true,
      message: "Request has been ignored successfully.",
    });
  } catch (error) {
    console.error("ignoreRequest Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const getMyBidHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const provider = await ServiceProvider.findOne({
      userId,
      isDeleted: false,
    });
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, message: "Provider profile not found." });
    }

    const filter = { provider: provider._id };
    const validStatuses = [
      "pending",
      "responded",
      "accepted_by_user",
      "rejected_by_user",
    ];
    if (status && validStatuses.includes(status)) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [responses, total] = await Promise.all([
      ProviderResponse.find(filter)
        .populate({
          path: "enquiry",
          select: "service message location status createdAt",
          populate: { path: "service", select: "name" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ProviderResponse.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        total,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
      },
      data: responses,
    });
  } catch (error) {
    console.error("getMyBidHistory Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Internal Server Error" });
  }
};