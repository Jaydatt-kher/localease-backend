import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  code: {
    type: String,
    uppercase: true,
    trim: true,
    unique: true, sparse: true
  },
  description: String,

  discountType: {
    type: String,
    enum: ['percentage', 'flat'],
    required: true
  },

  discountValue: {
    type: Number,
    required: true
  },

  applicableOn: {
    type: String,
    enum: ['platform', 'category', 'service', 'provider'],
    default: 'platform'
  },

  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory',
    default: null
  },

  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    default: null
  },

  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    default: null
  },

  minBookingAmount: {
    type: Number,
    default: 0
  },

  startDate: {
    type: Date,
    required: true
  },

  endDate: {
    type: Date,
    required: true
  },

  maxUsage: {
    type: Number,
    default: null
  },

  usedCount: {
    type: Number,
    default: 0
  },

  isActive: {
    type: Boolean,
    default: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', required: true
  }
}, { timestamps: true });

offerSchema.index({ applicableOn: 1, isActive: 1, endDate: 1 });

offerSchema.index({ categoryId: 1, isActive: 1, endDate: 1 });

offerSchema.index({ providerId: 1, isActive: 1, endDate: 1 });

offerSchema.index({ serviceId: 1, isActive: 1, endDate: 1 });

offerSchema.index({ code: 1 }, { unique: true, sparse: true });

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;