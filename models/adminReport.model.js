import mongoose from "mongoose"

const adminReportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    enum: [
      'DAILY_BOOKINGS',
      'MONTHLY_REVENUE',
      'TOP_PROVIDERS',
      'CANCELLED_BOOKINGS'
    ],
    required: true
  },
  data: Object,
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true })

adminReportSchema.index({ reportType: 1, createdAt: -1 });
const AdminReport = mongoose.model("AdminReport", adminReportSchema);
export default AdminReport;