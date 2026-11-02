const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "secret",
  "verificationOTP",
  "verificationOtp",
  "otp",
  "accessToken",
  "refreshToken",
]);

const redact = (value) => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEYS.has(key) ? "[REDACTED]" : redact(entry),
    ]),
  );
};

const write = (level, event, metadata = {}) => {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redact(metadata),
  };
  process.stdout.write(`${JSON.stringify(record)}\n`);
};

const errorDetails = (error) => ({
  error: {
    name: error?.name || "Error",
    message: error?.message || String(error),
    stack: process.env.NODE_ENV === "production" ? undefined : error?.stack,
  },
});

export const logger = {
  info: (event, metadata) => write("info", event, metadata),
  warn: (event, metadata) => write("warn", event, metadata),
  error: (event, error, metadata = {}) => write("error", event, { ...metadata, ...errorDetails(error) }),
};
