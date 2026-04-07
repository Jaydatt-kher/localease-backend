import City from "../../models/city.model.js";
import ServiceProvider from "../../models/serviceProviders.model.js";
import User from "../../models/user.model.js";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import generateTokens from "../../utils/token.js";

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_dummy_secret'
});

export const createProfile = async (req, res) => {
    try {
        const userId = req.userId;

        const {
            businessName,
            serviceLocation,
            city,
            experienceYears,
            serviceRadius,
            profilePicture,
            gallery,
            documents,
            availability, } = req.body;

        if (!businessName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Business name is required.",
            });
        }

        if (!city || !mongoose.Types.ObjectId.isValid(city)) {
            return res.status(400).json({
                success: false,
                message: "A valid city ID is required.",
            });
        }

        if (
            !serviceLocation?.coordinates ||
            !Array.isArray(serviceLocation.coordinates) ||
            serviceLocation.coordinates.length !== 2 ||
            serviceLocation.coordinates.some((c) => typeof c !== "number" || isNaN(c))
        ) {
            return res.status(400).json({
                success: false,
                message: "serviceLocation.coordinates must be [longitude, latitude] as two valid numbers.",
            });
        }

        const existingProfile = await ServiceProvider.findOne({ userId });
        if (existingProfile) {
            return res.status(400).json({
                success: false,
                message: "A provider profile already exists for this account.",
            });
        }

        const defaultDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
            (day) => ({
                day,
                isOpen: day !== "Sun",
                startTime: "09:00",
                endTime: "18:00",
            })
        );

        const resolvedAvailability = {
            days: availability?.days ?? defaultDays,
        };

        const serviceProvider = await ServiceProvider.create({
            userId,
            businessName: businessName.trim(),
            city,
            experienceYears: experienceYears ?? 0,
            serviceRadius: serviceRadius ?? 10,
            profilePicture: profilePicture || null,
            gallery: Array.isArray(gallery) ? gallery : [],
            documents: Array.isArray(documents) ? documents : [],
            serviceLocation: {
                type: "Point",
                coordinates: serviceLocation.coordinates,
            },
            availability: resolvedAvailability,
        });

        await User.findByIdAndUpdate(userId, { role: "serviceProvider" });

        const { accessToken, refreshToken } = generateTokens(userId, "serviceProvider");

        const updatedUser = await User.findById(userId);
        if (updatedUser) {
            updatedUser.refreshTokens.push(refreshToken);
            await updatedUser.save();
        }

        const cookieOpts = { httpOnly: true, secure: false, sameSite: "strict" };
        res.cookie("accessToken", accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
        res.cookie("refreshToken", refreshToken, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });

        return res.status(201).json({
            success: true,
            message: "Provider profile created successfully.",
            providerResponse: serviceProvider,
        });

    } catch (error) {
        console.error("createProfile Error:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "A provider profile already exists for this account.",
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};
export const updateProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const updates = req.body;
        const existingProfile = await ServiceProvider.findOne({ userId });
        if (!existingProfile) {
            return res.status(400).json({
                success: false,
                message: "Service Provider not exists"
            })
        }
        if (updates.serviceLocation && updates.serviceLocation.coordinates) {
            updates.serviceLocation = {
                type: "Point",
                coordinates: updates.serviceLocation.coordinates
            }
        }
        const allowedFields = [
            "businessName",
            "serviceLocation",
            "city",
            "experienceYears",
            "serviceRadius",
            "profilePicture", "gallery", "availability",
            "payoutSettings",
            "isActive"]
        const updateData = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        };
        const updateProvider = await ServiceProvider.findOneAndUpdate({ userId },
            { $set: updateData },
            {
                new: true,
                runValidators: true
            }
        )
        return res.status(200).json({
            success: true,
            message: "Service Provider updated successfully",
            providerResponse: updateProvider
        });
    } catch (error) {
        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: "Validation Error",
                details: error.message
            });
        }
        console.error("updateProfile Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const deleteProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const provider = await ServiceProvider.findOne({ userId, isDeleted: false });
        if (!provider) {
            return res.status(400).json({
                success: false,
                message: "Service Provider not found or already deleted"
            })
        }
        if (provider.walletBalance > 0) {
            return res.status(400).json({
                message: "Cannot delete account. Please withdraw your wallet balance of " + provider.walletBalance + " first."
            })
        }
        provider.isDeleted = true;
        provider.isActive = false;
        provider.payoutSettings = undefined;
        if (provider.currentSubscription && provider.currentSubscription.status === 'active') {
            provider.currentSubscription.status = 'expired';
            provider.currentSubscription.endDate = new Date();
        }
        await provider.save();
        return res.status(200).json({
            success: true,
            message: "Provider profile has been successfully deleted."
        })
    } catch (error) {
        console.error("deleteProfile Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const getProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const provider = await ServiceProvider.findOne({ userId, isDeleted: false }).populate("city", "name state").populate("currentSubscription.planId", "name price features durationInDays isActive");
        if (!provider) {
            return res.status(400).json({
                success: false,
                message: "Provider profile not found. Please create one."
            })
        }
        const user = await User.findById(userId).select("mobileNo isMobileVerified").lean();
        return res.status(200).json({
            success: true,
            providerResponse: {
                ...provider.toObject(),
                mobileNo: user?.mobileNo || null,
                isMobileVerified: user?.isMobileVerified || false,
            }
        })
    } catch (error) {
        console.error("getProviderProfile Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
export const getCities = async (req, res) => {
    try {
        const cities = await City.find({
            status: true
        })
        if (!cities) {
            return res.status(404).json({
                success: false,
                message: "City not found"
            })
        }
        return res.status(200).json({
            success: true,
            data: cities
        })
    } catch (error) {
        console.error("getCities Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export const linkProviderBank = async (req, res) => {
    try {
        const userId = req.userId;
        const provider = await ServiceProvider.findOne({ userId, isDeleted: false });
        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found." });
        }

        const accountParams = {
            type: "route",
            email: "dummy@provider.com",
            phone: "9999999999",
            legal_business_name: provider.businessName,
            business_type: "individual",
            profile: {
                category: "services",
                subcategory: "personal_services"
            }
        };

        const account = await razorpayInstance.accounts.create(accountParams);

        provider.razorpayLinkedAccountId = account.id;
        await provider.save();

        return res.status(200).json({
            success: true,
            message: "Razorpay linked account created successfully.",
            accountId: account.id
        });
    } catch (error) {
        console.error("linkProviderBank Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};