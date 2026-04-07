import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema({
    name: { type: String, required: true }, price: { type: Number, required: true },
    durationInDays: { type: Number, required: true }, features: [String], isActive: { type: Boolean, default: true }
}, { timestamps: true });
subscriptionPlanSchema.index({ name: 1 }, { unique: true });
const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
export default SubscriptionPlan;
