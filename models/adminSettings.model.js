import mongoose from "mongoose";

const adminSettingsSchema = new mongoose.Schema({
  platformName: {
    type: String,
    default: "LocalEase"
  },
  currency: {
    type: String,
    default: "INR"
  },
  timeFormat: {
    type: String,
    default: "12-hour"
  },
  platformCommissionRate: {
    type: Number,
    default: 0.15
  },
  minWalletBalance: {
    type: Number,
    default: 100
  },
  cashOnServiceThreshold: {
    type: Number,
    default: 5000
  }
}, { timestamps: true });

export const AdminSettings = mongoose.model("AdminSettings", adminSettingsSchema);
