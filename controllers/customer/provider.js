import ProviderService from "../../models/providerService.model.js";
import Review from "../../models/review.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";
import { AdminSettings } from "../../models/adminSettings.model.js";
import mongoose from "mongoose";

export const getNearbyProivders = async (req, res) => {
  try {
    const { lat, lng, serviceId, radius = 10 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required to find nearby services."
      });
    }
    const adminSettings = await AdminSettings.findOne() || { minWalletBalance: 100 };
    const minBalance = adminSettings.minWalletBalance;

    const radiusInMeters = parseInt(radius, 10) * 1000;
    const pipeline = [
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          distanceField: "distanceFromUser", maxDistance: radiusInMeters, spherical: true,
          query: {
            isActive: true,
            isVerified: true,
            isBlocked: false,
            isDeleted: false,
            walletBalance: { $gte: minBalance }
          }
        }
      }
    ]
    if (serviceId) {
      if (!mongoose.Types.ObjectId.isValid(serviceId)) {
        return res.status(400).json({ success: false, message: "Invalid Service ID format" });
      }
      pipeline.push({
        $lookup: {
          from: "providerservices", localField: "_id",
          foreignField: "providerId",
          as: "offeredServices"
        }
      });

      pipeline.push({
        $match: {
          "offeredServices.serviceId": new mongoose.Types.ObjectId(serviceId),
          "offeredServices.isAvailable": true
        }
      });
    } const nearbyProviders = await ServiceProvider.aggregate(pipeline);

    res.status(200).json({
      success: true,
      results: nearbyProviders.length,
      data: nearbyProviders
    });

  } catch (error) {
    if (error?.code === 26) {
      return res.status(200).json({ success: true, results: 0, data: [] });
    }
    console.error("getNearbyProivder Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};
export const getProviderByServices = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const providers = await ProviderService.find({
      serviceId,
      isAvailable: true,
      isDeleted: false
    })
      .populate({
        path: "providerId",
        match: { isActive: true, isBlocked: false, isDeleted: false, isVerified: true },
        select: "businessName profilePicture experienceYears rating completedJobs",
        populate: {
          path: "city",
          select: "name"
        },
        populate: {
          path: "userId",
          select: "name",
        },
      })
      .populate("serviceId", "name")
      .lean()
    const filteredProviders = providers.filter(p => p.providerId !== null);
    res.status(200).json({
      success: true,
      count: filteredProviders.length,
      data: filteredProviders
    });
  } catch (error) {
    console.error("getProviderByServices Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};
export const getProviderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const provider = await ServiceProvider.findOne({
      _id: id,
      isActive: true,
      isBlocked: false,
      isDeleted: false
    })
      .select("-wallerBalance -payoutSettings -documents -bookingOtp")
      .populate("userId", "fullName email mobileNo address")
      .populate("city", "fullName")
      .lean()
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Providers not found"
      })
    }
    const [services, reviews] = await Promise.all([
      ProviderService.find({
        providerId: provider._id, isAvailable: true
      })
        .populate("serviceId", "fullName description").lean(),

      Review.find({
        providerId: provider._id
      })
        .populate("userId", "fullName").sort({ createdAt: -1 }).limit(10)
        .lean()
    ]);
    res.status(200).json({
      success: true,
      data: {
        provider,
        services,
        reviews
      }
    })
  } catch (error) {
    console.error("getProviderDetails Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};
export const getFilteredProvidersForServices = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const {
      minPrice,
      maxPrice,
      priceType,
      minRating,
      minExperience,
      lat,
      lng,
      radius = 20000,
      sortBy = "rating",
      page = 1,
      limit = 10,
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, message: "Invalid service ID." });
    }

    const adminSettings = await AdminSettings.findOne() || { minWalletBalance: 100 };
    const minBalance = adminSettings.minWalletBalance;

    const skip = (Number(page) - 1) * Number(limit);

    let nearbyProviderIds = null;
    if (lat && lng) {
      const geoResults = await ServiceProvider.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [Number(lng), Number(lat)],
            },
            distanceField: "distance",
            maxDistance: Number(radius),
            spherical: true,
            query: {
              isActive: true,
              isBlocked: false,
              isVerified: true,
              isDeleted: false,
              walletBalance: { $gte: minBalance }
            },
          },
        },
        { $project: { _id: 1 } },
      ]);

      nearbyProviderIds = geoResults.map((p) => p._id);

      if (nearbyProviderIds.length === 0) {
        return res.status(200).json({
          success: true,
          pagination: { total: 0, totalPages: 0, currentPage: Number(page) },
          data: [],
        });
      }
    }

    const pipeline = [];

    const baseMatch = {
      serviceId: new mongoose.Types.ObjectId(serviceId),
      isAvailable: true,
      isDeleted: false,
    };

    if (minPrice || maxPrice) {
      baseMatch.price = {};
      if (minPrice) baseMatch.price.$gte = Number(minPrice);
      if (maxPrice) baseMatch.price.$lte = Number(maxPrice);
    }

    if (priceType) {
      const types = String(priceType).split(",").map((t) => t.trim()).filter(Boolean);
      const validTypes = ["fixed", "hourly", "inspection"];
      const filtered = types.filter((t) => validTypes.includes(t));
      if (filtered.length > 0) baseMatch.priceType = { $in: filtered };
    }

    if (nearbyProviderIds !== null) {
      baseMatch.providerId = { $in: nearbyProviderIds };
    }

    pipeline.push({ $match: baseMatch });

    const providerSubPipeline = [
      {
        $match: {
          $expr: { $eq: ["$_id", "$$pid"] },
          isActive: true,
          isBlocked: false,
          isVerified: true,
          isDeleted: false,
          walletBalance: { $gte: minBalance }
        },
      },
    ];

    if (minExperience && Number(minExperience) > 0) {
      providerSubPipeline.push({
        $match: { experienceYears: { $gte: Number(minExperience) } },
      });
    }

    pipeline.push({
      $lookup: {
        from: "serviceproviders",
        let: { pid: "$providerId" }, pipeline: providerSubPipeline,
        as: "provider",
      },
    });

    pipeline.push({ $unwind: "$provider" });

    if (minRating != null && Number(minRating) > 0) {
      pipeline.push({
        $match: {
          "provider.rating.average": { $gte: Number(minRating) },
        },
      });
    }

    pipeline.push({
      $lookup: {
        from: "users",
        let: { uid: "$provider.userId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
          { $project: { fullName: 1 } },],
        as: "providerUser",
      },
    });

    pipeline.push({
      $addFields: {
        "provider.fullName": { $arrayElemAt: ["$providerUser.fullName", 0] },
      },
    });

    const SORT_MAP = {
      priceAsc: { price: 1 },
      priceDesc: { price: -1 },
      experience: { "provider.experienceYears": -1 },
      rating: { "provider.rating.average": -1 },
    };
    pipeline.push({ $sort: SORT_MAP[sortBy] ?? SORT_MAP.rating });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: Number(limit) },
          {
            $project: {
              _id: 0,
              providerServiceId: "$_id",
              price: 1,
              priceType: 1,
              duration: 1,
              description: 1,
              "provider._id": 1,
              "provider.businessName": 1,
              "provider.profilePicture": 1,
              "provider.experienceYears": 1,
              "provider.completedJobs": 1,
              "provider.isVerified": 1,
              "provider.rating": 1, "provider.fullName": 1,
            },
          },
        ],
      },
    });

    const result = await ProviderService.aggregate(pipeline);
    const total = result[0]?.metadata?.[0]?.total ?? 0;

    return res.status(200).json({
      success: true,
      pagination: {
        total,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
      },
      data: result[0]?.data ?? [],
    });
  } catch (error) {
    if (error?.code === 26) {
      return res.status(200).json({
        success: true,
        pagination: { total: 0, totalPages: 0, currentPage: 1 },
        data: [],
      });
    }
    console.error("getFilteredProvidersForServices Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};