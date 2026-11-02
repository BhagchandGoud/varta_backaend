import NotificationModel from "../models/NotificationModel.js";

export const getNotifications = async (req, res) => {
  const notifications = await NotificationModel.find({ recipient: req.user.userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return res.json({ success: true, notifications });
};

export const markNotificationRead = async (req, res) => {
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: req.params.notificationId, recipient: req.user.userId },
    { unread: false },
    { new: true },
  );
  if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
  return res.json({ success: true, notification });
};

export const markAllNotificationsRead = async (req, res) => {
  await NotificationModel.updateMany({ recipient: req.user.userId, unread: true }, { unread: false });
  return res.json({ success: true });
};

export const clearNotifications = async (req, res) => {
  await NotificationModel.deleteMany({ recipient: req.user.userId });
  return res.json({ success: true });
};

export const createNotification = async ({ recipient, type, title, detail }) => {
  if (!recipient || !title || !detail) return null;
  return NotificationModel.create({ recipient, type, title, detail });
};
