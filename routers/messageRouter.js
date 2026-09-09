import express from "express";
import { authentication } from "../middlewares/auth.js";
// import uploadFile from "../uploads/singalLocal.js";
import {
  deleteMessage,
  getMessageByChat,
  getMessageById,
  getUnreadCount,
  getUnreadCountByChat,
  markAllMessageAsRead,
  markMessageAsRead,
  sendMessage,
  sendFileMessage,
  editMessage,
  toggleReaction,
  reportMessage,
} from "../controllers/messageController.js";

import uploadFilesCloud from '../utils/multer.js'

const router = express.Router();

router.use(authentication);

// ---------- Send ----------
router.post("/file/:chatId", uploadFilesCloud ,sendFileMessage);
router.post("/:chatId", sendMessage);

// ---------- Read ----------
router.get("/detail/:messageId", getMessageById);
router.get("/unread/count", getUnreadCount);
router.get("/unread/:chatId", getUnreadCountByChat);
router.get("/:chatId", getMessageByChat);

// ---------- Update ----------
router.patch("/read-all/:chatId", markAllMessageAsRead);
router.patch("/read/:messageId", markMessageAsRead);
router.patch("/:messageId", editMessage);
router.post("/:messageId/reaction", toggleReaction);
router.post("/:messageId/report", reportMessage);

// ---------- Delete ----------
router.delete("/:messageId", deleteMessage);

export default router;
