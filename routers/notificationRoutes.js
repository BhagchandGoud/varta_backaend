import express from "express";
import { authentication } from "../middlewares/auth.js";
import { validateObjectIdParam } from "../middlewares/security.js";
import {
  clearNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";

const router = express.Router();
router.use(authentication);
router.get("/", getNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:notificationId/read", validateObjectIdParam("notificationId"), markNotificationRead);
router.delete("/", clearNotifications);
export default router;
