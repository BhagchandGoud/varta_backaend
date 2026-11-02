import MessageModel from "../models/messageModel.js";
import ReportModel from "../models/ReportModel.js";
import UserModel from "../models/UserModel.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../middlewares/generateToken.js";

const parsePagination = (query) => {
  const page = Number.parseInt(query.page, 10) || 1;
  const limit = Number.parseInt(query.limit, 10) || 20;
  return {
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit)),
  };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const loginAdmin = async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const user = await UserModel.findOne({ email });
    if (
      !user ||
      user.role !== "admin" ||
      !user.isEmailVerified ||
      user.isSuspended ||
      !(await bcrypt.compare(req.body.password, user.password))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid administrator credentials",
      });
    }

    const token = await generateToken(user._id, res);
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    return res.json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminProfile = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.userId)
      .select("_id username email profileImage role")
      .lean();
    if (!user) {
      return res.status(401).json({ success: false, message: "Account no longer exists" });
    }
    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOverview = async (_req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      onlineUsers,
      totalMessages,
      openReports,
      recentUsers,
      recentReports,
    ] = await Promise.all([
      UserModel.countDocuments({ role: { $ne: "admin" } }),
      UserModel.countDocuments({ role: { $ne: "admin" }, isSuspended: { $ne: true } }),
      UserModel.countDocuments({ role: { $ne: "admin" }, isSuspended: true }),
      UserModel.countDocuments({ role: { $ne: "admin" }, isOnline: true, isSuspended: { $ne: true } }),
      MessageModel.countDocuments({}),
      ReportModel.countDocuments({ status: "open" }),
      UserModel.countDocuments({ role: { $ne: "admin" }, createdAt: { $gte: since } }),
      ReportModel.find({ status: "open" })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("reporter", "username")
        .populate({
          path: "message",
          select: "sender type createdAt",
          populate: { path: "sender", select: "username" },
        })
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        metrics: {
          totalUsers,
          activeUsers,
          suspendedUsers,
          onlineUsers,
          totalMessages,
          openReports,
          recentUsers,
        },
        recentReports,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = req.query.status || "all";
    if (!["all", "active", "suspended"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid user status filter" });
    }

    const filter = { role: { $ne: "admin" } };
    if (status === "active") filter.isSuspended = { $ne: true };
    if (status === "suspended") filter.isSuspended = true;
    if (search) {
      const pattern = new RegExp(escapeRegex(search.slice(0, 100)), "i");
      filter.$or = [{ username: pattern }, { email: pattern }];
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .select("_id username email profileImage isEmailVerified isOnline isSuspended createdAt lastSeen")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const setUserSuspension = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isSuspended } = req.body;
    if (userId === req.user.userId) {
      return res.status(400).json({ success: false, message: "You cannot suspend your own account" });
    }

    const user = await UserModel.findOneAndUpdate(
      { _id: userId, role: { $ne: "admin" } },
      { $set: { isSuspended } },
      { new: true, runValidators: true },
    ).select("_id username email isSuspended");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminReports = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const status = req.query.status || "open";
    if (!["all", "open", "reviewed", "dismissed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid report status filter" });
    }

    const filter = status === "all" ? {} : { status };
    const [reports, total] = await Promise.all([
      ReportModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("_id reason status createdAt message reporter")
        .populate("reporter", "username email")
        .populate({
          path: "message",
          select: "sender type createdAt isDeletedForEveryone",
          populate: { path: "sender", select: "username email" },
        })
        .lean(),
      ReportModel.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: reports,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReportStatus = async (req, res) => {
  try {
    const report = await ReportModel.findByIdAndUpdate(
      req.params.reportId,
      { $set: { status: req.body.status } },
      { new: true, runValidators: true },
    )
      .select("_id status")
      .lean();
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    return res.json({ success: true, data: report });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
