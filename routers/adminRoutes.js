import express from "express";
import {
  getAdminProfile,
  getAdminReports,
  getAdminUsers,
  getOverview,
  loginAdmin,
  setUserSuspension,
  updateReportStatus,
} from "../controllers/adminController.js";
import { authentication, requireAdmin } from "../middlewares/auth.js";
import {
  authLimiter,
  validateBody,
  validateObjectIdParam,
} from "../middlewares/security.js";

const router = express.Router();

router.post("/login", authLimiter, validateBody("login"), loginAdmin);
router.use(authentication, requireAdmin);
router.get("/me", getAdminProfile);
router.get("/overview", getOverview);
router.get("/users", getAdminUsers);
router.patch(
  "/users/:userId/status",
  validateObjectIdParam("userId"),
  validateBody("adminUserStatus"),
  setUserSuspension,
);
router.get("/reports", getAdminReports);
router.patch(
  "/reports/:reportId/status",
  validateObjectIdParam("reportId"),
  validateBody("adminReportStatus"),
  updateReportStatus,
);

export default router;
