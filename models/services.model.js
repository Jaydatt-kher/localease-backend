import mongoose from "mongoose";

const servicesSchema = new mongoose.Schema({
    name: {
        type: String, required: true
    },
    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
        required: true
    },
    images: [String],
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceCategory",
        required: true
    },
    description: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        default: 60
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });
servicesSchema.index({ city: 1, category: 1 }); servicesSchema.index({ name: 'text', description: 'text' }); const Service = mongoose.model("Service", servicesSchema);
export default Service;