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
import { messageLimiter, uploadLimiter, validateBody, validateObjectIdParam } from '../middlewares/security.js';

const router = express.Router();

router.use(authentication);

// ---------- Send ----------
router.post("/file/:chatId", uploadLimiter, validateObjectIdParam('chatId'), uploadFilesCloud, sendFileMessage);
router.post("/:chatId", messageLimiter, validateObjectIdParam('chatId'), validateBody('message'), sendMessage);

// ---------- Read ----------
router.get("/detail/:messageId", validateObjectIdParam('messageId'), getMessageById);
router.get("/unread/count", getUnreadCount);
router.get("/unread/:chatId", validateObjectIdParam('chatId'), getUnreadCountByChat);
router.get("/:chatId", validateObjectIdParam('chatId'), getMessageByChat);

// ---------- Update ----------
router.patch("/read-all/:chatId", validateObjectIdParam('chatId'), markAllMessageAsRead);
router.patch("/read/:messageId", validateObjectIdParam('messageId'), markMessageAsRead);
router.patch("/:messageId", validateObjectIdParam('messageId'), validateBody('editMessage'), editMessage);
router.post("/:messageId/reaction", validateObjectIdParam('messageId'), validateBody('reaction'), toggleReaction);
router.post("/:messageId/report", validateObjectIdParam('messageId'), validateBody('report'), reportMessage);

// ---------- Delete ----------
router.delete("/:messageId", validateObjectIdParam('messageId'), deleteMessage);

export default router;
