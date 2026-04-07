import express from "express";
import { isAuth } from "../middleware/isAuth.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import { clearAllNotifications, deleteNotification, getNotifications, getUnreadCount, markAllAsRead, markAsRead } from "../controllers/notifications.controller.js";
const notificationRouter = express.Router();
notificationRouter.use(isAuth)
notificationRouter.get("/", getNotifications);
notificationRouter.get("/unread-count", getUnreadCount);
notificationRouter.patch("/read-all", markAllAsRead); notificationRouter.patch("/:id/read", markAsRead);
notificationRouter.delete("/", clearAllNotifications);
notificationRouter.delete("/:id", deleteNotification);

export default notificationRouter;