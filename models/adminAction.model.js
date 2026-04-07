import mongoose from "mongoose"

const platformEarningsSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
    required: true
  },
  totalAmount: Number,
  commissionPercent: Number,
  platformEarning: Number,
  providerEarning: Number,
  payoutStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  }
}, { timestamps: true })

platformEarningsSchema.index({ providerId: 1, createdAt: -1 });

platformEarningsSchema.index({ payoutStatus: 1 });

platformEarningsSchema.index({ createdAt: 1 });

const PlatformEarning = mongoose.model("PlatformEarning", platformEarningsSchema);
export default PlatformEarning;