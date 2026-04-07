import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    messageType: { type: String, enum: ['text', 'image'], default: 'text' }
}, { timestamps: true });
chatSchema.index({ bookingId: 1, createdAt: 1 });
const Chat = mongoose.model("Chat", chatSchema);
export default Chat;