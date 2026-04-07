import mongoose from "mongoose";
import ServiceCategory from "../../models/serviceCategories.model.js";
import Service from "../../models/services.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";
import ProviderService from "../../models/providerService.model.js";
export const getAllCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({
      isActive: true
    }).sort({
      displayOrder: 1
    }).lean();
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error("getAllCategories Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};
export const getServicesByCategory = async (req, res) => {
  try {
    const {
      categoryId
    } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Category ID format"
      });
    }
    const services = await Service.find({
      category: categoryId,
      isAvailable: true
    }).sort({
      name: 1
    }).lean();
    res.status(200).json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error("getServicesByCategory Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};
export const searchService = async (req, res) => {
  try {
    const {
      query
    } = req.query;
    if (!query || query.trim() === "") {
      return res.status(200).json({
        success: true,
        results: 0,
        data: []
      });
    }
    const services = await Service.find({
      $text: {
        $search: query.trim()
      },
      isAvailable: true
    }, {
      score: {
        $meta: "textScore"
      }
    }).sort({
      score: {
        $meta: "textScore"
      }
    }).lean();
    res.status(200).json({
      success: true,
      results: services.length,
      data: services
    });
  } catch (error) {
    console.error("searchService Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};
export const getServiceDetails = async (req, res) => {
  try {
    const {
      serviceId
    } = req.params;
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Service ID format"
      });
    }
    const service = await Service.findById(serviceId).populate("category", "name").lean();
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }
    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error("getServiceDetails Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};
export const getAllServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [services, total] = await Promise.all([Service.find({
      isAvailable: true
    }).populate("category", "name").sort({
      name: 1
    }).skip(skip).limit(Number(limit)).lean(), Service.countDocuments({
      isAvailable: true
    })]);
    return res.status(200).json({
      success: true,
      total,
      data: services
    });
  } catch (error) {
    console.error("getAllServices Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};
export const searchUnified = async (req, res) => {
  try {
    const {
      query
    } = req.query;
    if (!query || query.trim() === "") {
      return res.status(200).json({
        success: true,
        categories: [],
        services: []
      });
    }
    const q = query.trim();
    const regex = new RegExp(q, "i");
    const categories = await ServiceCategory.find({
      isActive: true,
      $or: [{
        name: regex
      }, {
        description: regex
      }]
    }).select("_id name icon").limit(6).lean();
    let services = [];
    try {
      services = await Service.find({
        $text: {
          $search: q
        },
        isAvailable: true
      }, {
        score: {
          $meta: "textScore"
        }
      }).sort({
        score: {
          $meta: "textScore"
        }
      }).select("_id name description category").populate("category", "name _id").limit(8).lean();
    } catch (_) {
      console.error("Error in searchUnified:", _);
      services = await Service.find({
        name: regex,
        isAvailable: true
      }).select("_id name description category").populate("category", "name _id").limit(8).lean();
    }
    return res.status(200).json({
      success: true,
      categories,
      services
    });
  } catch (error) {
    console.error("searchUnified Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};