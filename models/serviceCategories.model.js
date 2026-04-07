import mongoose from "mongoose"

const serviceCategoriesSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    icon: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    featured: {
        type: Boolean,
        default: false
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    }
}, { timestamps: true });
serviceCategoriesSchema.index({ displayOrder: 1 });
serviceCategoriesSchema.index({ name: "text" });
const ServiceCategory = mongoose.model("ServiceCategory", serviceCategoriesSchema);
export default ServiceCategory;