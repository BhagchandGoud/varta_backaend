import UserModel from "../models/UserModel.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../middlewares/generateToken.js";
import EmailService from "../services/emailVerification.js";
import BloomFilter from "../algorithms/bloomFilter.js";
import mongoose from "mongoose";
import { LocalStorage } from "node-localstorage";
import crypto from "crypto";

//insert data from mongodb to bloom filter

const bloomFilter = new BloomFilter();
const emailService = new EmailService();
const localstorage = new LocalStorage("../localStorage");

const tempUserStore = new Map(); //temparory storage for unverified users

const createBloomFilter = async () => {
  bloomFilter.clear();
  try {
    const users = await UserModel.find({}, { username: 1, email: 1 }); // using projection

    for (const user of users) {
      bloomFilter.add(user.username);
      bloomFilter.add(user.email);
    }

  } catch (error) {
  }
};

mongoose.connection.once("open", async () => {
  await createBloomFilter(); //calling bloom filter
});

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: "Missing data is required!",
      });
    }

    if (bloomFilter.contains(email)) {
      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User already exists!",
        });
      }
    }
    if (bloomFilter.contains(username.toLowerCase())) {
      const existingUsername = await UserModel.findOne({ username });

      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: "Username already taken.",
        });
      }
    }

    const salt = bcrypt.genSaltSync(12);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const sendOTP = await emailService.sendVerificationOTP({
      email: email,
      username: username,
    });

    if (!sendOTP.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email",
      });
    }

    const tempUserData = {
      username: username,
      email: email,
      password: hashedPassword,
      createdAt: Date.now(),
    };
    tempUserStore.set(email, tempUserData);

    localstorage.setItem("username", username);
    localstorage.setItem("email", email);
    localstorage.setItem("verificationPending", "true");

    return res.status(200).json({
      success: true,
      message: "OTP Sent On Email Id , Please Verify!",
      requireVerification: true,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const verification = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required!",
      });
    }

    const verifyResult = emailService.verifyOTP(email, otp);

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message,
      });
    }

    const tempUser = tempUserStore.get(email);
    if (!tempUser) {
      return res.status(404).json({
        success: false,
        message: "No pending registration found",
      });
    }

    const newUser = new UserModel({
      username: tempUser.username,
      email: tempUser.email,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      password: tempUser.password,
    });

    const savedUser = await newUser.save();
    bloomFilter.add(savedUser.username.trim().toLowerCase());
    bloomFilter.add(savedUser.email.trim().toLowerCase());

    tempUserStore.delete(email);
    localstorage.clear();

    const token = await generateToken(savedUser._id, res);

    emailService.sendWelcomeEmail({
      email: savedUser.email,
      username: savedUser.username,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: "User registered successfully!",
      user: {
        _id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        profileImage: savedUser.profileImage,
        isEmailVerified: savedUser.isEmailVerified,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const resendOTP = async (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required!",
      });
    }

    const user = await UserModel.findOne({ email });
    const resolvedUsername = username || user?.username || email.split("@")[0];

    const sendOTP = await emailService.resendOTP({
      email,
      username: resolvedUsername,
    });

    if (!sendOTP.success) {
      return res.status(400).json({
        success: false,
        message: sendOTP.message || "Failed to resend verification code.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent successfully!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const user = email ? await UserModel.findOne({ email }) : null;

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.passwordResetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const requestOrigin = req.get("origin");
      const configuredFrontendUrl = process.env.FRONTEND_URL || process.env.ORIGIN;
      const clientUrl = (requestOrigin || configuredFrontendUrl || "http://localhost:5173").replace(/\/$/, "");
      const resetUrl = `${clientUrl}/reset-password/${encodeURIComponent(resetToken)}`;
      await emailService.sendPasswordResetEmail({
        email: user.email,
        username: user.username,
        resetToken,
        resetUrl,
      });
    }

    return res.status(200).json({
      success: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to process password reset request" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const user = await UserModel.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ success: false, message: "Reset link is invalid or expired" });

    user.password = await bcrypt.hash(password, 12);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    return res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to reset password" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required!",
      });
    }

    if (!bloomFilter.contains(email.trim().toLowerCase())) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = await generateToken(user._id, res);

    // Update user status
    user.isOnline = true;
    user.lastSeen = Date.now();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        isOnline: user.isOnline,
        isEmailVerified: user.isEmailVerified,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.user?.userId;

    // Update user status
    await UserModel.findByIdAndUpdate(
      userId,
      {
        isOnline: false,
        lastSeen: Date.now(),
      },
      { returnDocument: "after" },
    );

    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
