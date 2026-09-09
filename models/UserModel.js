import mongoose from "mongoose";

const uniqueUserNameGenerator = async () => {
  let username;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    username =
      Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    exists = await UserModel.exists({ username });
    attempts++;
  }

  return username;
};

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      default: uniqueUserNameGenerator,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    password: {
      type: String,
      required: true,
      minlength: [6, "Password must be at least 6 characters"],
    },

    passwordResetTokenHash: {
      type: String,
      default: null,
    },

    passwordResetExpiresAt: {
      type: Date,
      default: null,
    },

    profileImage: {
      type: String,
      default: null,
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    locationEnabled: {
      type: Boolean,
      default: false,
    },

    // ✅ FIX: Proper GeoJSON format for MongoDB 2dsphere index
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: false,
      },
      coordinates: {
        type: [Number],
        default: [0, 0], // [longitude, latitude]
        required: false,
      },
    },

    // GeoHash used for fast nearby searching
    geoHash: {
      type: String,
      default: null,
      index: true,
    },

    lastLocationUpdate: {
      type: Date,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    verificationOTP: {
      type: String,
      default: null,
      select: false, // Don't return by default in queries
    },
    verificationOTPExpiry: {
      type: Date,
      default: null,
      select: false, // Don't return by default in queries
    },
    verificationAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    lastVerificationRequest: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Add 2dsphere index for geospatial queries
userSchema.index({ location: "2dsphere" });
userSchema.index({ username: 1, email: 1 });

const UserModel = mongoose.model("User", userSchema);

export default UserModel;
