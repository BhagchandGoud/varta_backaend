import mongoose from "mongoose";
import UserModel from "../models/UserModel.js";

const MAX_NEARBY_DISTANCE_METERS = 25_000;

export const findNearbyUsers = async ({
  latitude,
  longitude,
  currentUserId,
  onlineUsers,
}) => {
  const candidateUserIds = Array.from(onlineUsers.values())
    .filter(
      (user) =>
        user.userId !== currentUserId &&
        user.latitude != null &&
        user.longitude != null &&
        mongoose.isValidObjectId(user.userId),
    )
    .map((user) => new mongoose.Types.ObjectId(user.userId));

  if (candidateUserIds.length === 0) {
    return [];
  }

  const nearbyRecords = await UserModel.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        distanceField: "distanceMeters",
        maxDistance: MAX_NEARBY_DISTANCE_METERS,
        spherical: true,
        query: {
          _id: { $in: candidateUserIds },
          locationEnabled: true,
          isEmailVerified: true,
        },
      },
    },
    {
      $project: {
        username: 1,
        profileImage: 1,
        bio: 1,
        location: 1,
        distanceMeters: 1,
      },
    },
  ]);

  return nearbyRecords.map((user) => ({
    userId: user._id.toString(),
    name: user.username,
    username: user.username,
    profileImage: user.profileImage,
    bio: user.bio,
    latitude: user.location.coordinates[1],
    longitude: user.location.coordinates[0],
    distance: Number((user.distanceMeters / 1000).toFixed(2)),
  }));
};
