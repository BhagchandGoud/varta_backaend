import rateLimit from "express-rate-limit";

const jsonError = (res, status, code, message, details = []) =>
  res
    .status(status)
    .json({ success: false, error: { code, message, details } });

const createLimiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    skip: () => process.env.NODE_ENV !== "production",
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => jsonError(res, 429, "RATE_LIMITED", message),
  });

export const apiLimiter = createLimiter(
  15 * 60 * 1000,
  1000,
  "Too many requests. Please try again later.",
);
export const authLimiter = createLimiter(
  60 * 1000,
  10,
  "Too many authentication attempts. Please try again later.",
);
export const otpLimiter = createLimiter(
  15 * 60 * 1000,
  8,
  "Too many verification attempts. Please try again later.",
);
export const messageLimiter = createLimiter(
  60 * 1000,
  120,
  "Too many messages. Please slow down.",
);
export const searchLimiter = createLimiter(
  60 * 1000,
  60,
  "Too many searches. Please try again later.",
);
export const uploadLimiter = createLimiter(
  10 * 60 * 1000,
  30,
  "Too many uploads. Please try again later.",
);

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));
const isEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));

export const validateBody = (type) => (req, res, next) => {
  const body = req.body || {};
  const details = [];

  if (type === "register") {
    if (
      typeof body.username !== "string" ||
      body.username.trim().length < 2 ||
      body.username.trim().length > 50
    )
      details.push("username must be 2-50 characters");
    if (!isEmail(body.email)) details.push("email must be valid");
    if (
      typeof body.password !== "string" ||
      body.password.length < 6 ||
      body.password.length > 128
    )
      details.push("password must be 6-128 characters");
  }
  if (type === "login" || type === "forgotPassword") {
    if (!isEmail(body.email)) details.push("email must be valid");
    if (
      type === "login" &&
      (typeof body.password !== "string" || !body.password)
    )
      details.push("password is required");
  }
  if (
    type === "resetPassword" &&
    (typeof body.password !== "string" ||
      body.password.length < 6 ||
      body.password.length > 128)
  )
    details.push("password must be 6-128 characters");
  if (type === "otp") {
    if (!isEmail(body.email)) details.push("email must be valid");
    if (!/^\d{6}$/.test(String(body.otp || "")))
      details.push("otp must be a 6-digit code");
  }
  if (type === "message") {
    if (typeof body.content !== "string" || body.content.length > 10000)
      details.push("message content must be at most 10000 characters");
    for (const field of ["replyTo", "forwardedFrom"])
      if (
        body[field] !== undefined &&
        body[field] !== null &&
        !isObjectId(body[field])
      )
        details.push(`${field} must be a valid id`);
  }
  if (
    type === "editMessage" &&
    (typeof body.content !== "string" ||
      !body.content.trim() ||
      body.content.length > 10000)
  )
    details.push("edited content must be 1-10000 characters");
  if (
    type === "reaction" &&
    !["❤️", "😂", "😊", "😮", "😢", "😡", "👍", "👎", "🔥", "💯"].includes(
      body.emoji,
    )
  )
    details.push("unsupported reaction");
  if (
    type === "report" &&
    !["spam", "harassment", "hate", "violence", "scam", "other"].includes(
      body.reason,
    )
  )
    details.push("invalid report reason");
  if (type === "profile") {
    if (
      body.username !== undefined &&
      (typeof body.username !== "string" ||
        body.username.trim().length < 2 ||
        body.username.trim().length > 50)
    )
      details.push("username must be 2-50 characters");
    if (
      body.bio !== undefined &&
      (typeof body.bio !== "string" || body.bio.length > 250)
    )
      details.push("bio must be at most 250 characters");
  }
  if (type === "contactDetails") {
    if (
      body.customName !== undefined &&
      (typeof body.customName !== "string" || body.customName.length > 50)
    )
      details.push("customName must be at most 50 characters");
    if (
      body.notes !== undefined &&
      (typeof body.notes !== "string" || body.notes.length > 200)
    )
      details.push("notes must be at most 200 characters");
    if (body.isFavorite !== undefined && typeof body.isFavorite !== "boolean")
      details.push("isFavorite must be boolean");
    if (body.isMuted !== undefined && typeof body.isMuted !== "boolean")
      details.push("isMuted must be boolean");
  }
  if (
    type === "adminUserStatus" &&
    typeof body.isSuspended !== "boolean"
  )
    details.push("isSuspended must be boolean");
  if (
    type === "adminReportStatus" &&
    !["reviewed", "dismissed"].includes(body.status)
  )
    details.push("status must be reviewed or dismissed");

  if (details.length)
    return jsonError(
      res,
      400,
      "VALIDATION_ERROR",
      "Request validation failed",
      details,
    );
  next();
};

export const validateObjectIdParam = (name) => (req, res, next) => {
  if (!isObjectId(req.params[name]))
    return jsonError(res, 400, "INVALID_ID", `Invalid ${name}`);
  next();
};

export const errorResponse = (err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE")
    return jsonError(
      res,
      413,
      "FILE_TOO_LARGE",
      "Uploaded file exceeds the size limit",
    );
  if (
    err?.code === "LIMIT_UNEXPECTED_FILE" ||
    err?.code === "INVALID_FILE_TYPE"
  )
    return jsonError(res, 400, "INVALID_UPLOAD", err.message);
  const status = Number.isInteger(err?.status) ? err.status : 500;
  return jsonError(
    res,
    status,
    status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
    status >= 500 ? "Internal server error" : err.message || "Request failed",
  );
};
