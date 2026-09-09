import mongoose from "mongoose";
import UserModel from "../models/UserModel.js";
import Trie from "../algorithms/searchBar.js";
import ContactModel from "../models/ContactModel.js";
import cloudinary from "../config/cloudinary.js";
import EmailService from "../services/emailVerification.js";

const emailService = new EmailService();

let trieInstance = null;
let lastTimeTrie = null;
const TrieBuildTime = 5 * 60 * 1000; // 5 minutes

const getTrie = async () => {
  try {
    const now = Date.now();
    let shouldBuildTrie = false;

    if (!trieInstance) {
      shouldBuildTrie = true;
    } else if (!lastTimeTrie || now - lastTimeTrie > TrieBuildTime) {
      shouldBuildTrie = true;
    }

    if (shouldBuildTrie) {
      trieInstance = new Trie();

      const users = await UserModel.find().select("_id username");

      for (let user of users) {
        trieInstance.insert(user.username.toLowerCase(), user._id.toString());
      }
      lastTimeTrie = now;
    }
    return trieInstance;
  } catch (error) {
    if (trieInstance) {
      return trieInstance;
    }
    throw error;
  }
};

// ============================================
// SEARCH FUNCTIONS
// ============================================

// search in contacts (only accepted contacts)
export const searchInContacts = async (req, res) => {
  try {
    const key = req.query.q || req.query.key || req.body.key || req.body.q;
    const currentUserId = req.user?.userId;

    if (!key || key.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search key is required",
      });
    }

    const trie = await getTrie();
    if (!trie) {
      return res.status(500).json({
        success: false,
        message: "Search service is not available.",
      });
    }

    const searchTerm = key.toLowerCase().trim();
    const matchedUserIds = trie.search(searchTerm);

    if (matchedUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        total: 0,
        message: "No users found",
      });
    }

    const contacts = await ContactModel.find({
      user: currentUserId,
      status: "accepted",
    }).select("contact");

    const contactIds = contacts.map((c) => c.contact.toString());

    const filteredUserIds = matchedUserIds.filter((id) =>
      contactIds.includes(id),
    );

    if (filteredUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        total: 0,
        message: "No matching contacts found",
      });
    }

    const users = await UserModel.find({
      _id: { $in: filteredUserIds },
    })
      .select("username email profileImage isOnline lastSeen bio")
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      users,
      total: users.length,
      searchTerm: key.trim(),
      type: "contacts",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// search in blocked contact
export const searchInBlocked = async (req, res) => {
  try {
    const key = req.query.q || req.query.key || req.body.key || req.body.q;
    const currentUserId = req.user?.userId;

    if (!key || key.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search key is required",
      });
    }

    const trie = await getTrie();
    if (!trie) {
      return res.status(500).json({
        success: false,
        message: "Search service is not available.",
      });
    }

    const searchTerm = key.toLowerCase().trim();
    const matchedUserIds = trie.search(searchTerm);

    if (matchedUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        total: 0,
        message: "No users found",
      });
    }

    const blockedContacts = await ContactModel.find({
      user: currentUserId,
      status: "blocked",
    }).select("contact");

    const blockedContactIds = blockedContacts.map((c) => c.contact.toString());

    const filteredUserIds = matchedUserIds.filter((id) =>
      blockedContactIds.includes(id),
    );

    if (filteredUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        total: 0,
        message: "No matching blocked contacts found",
      });
    }

    const users = await UserModel.find({
      _id: { $in: filteredUserIds },
    })
      .select("username email profileImage isOnline lastSeen bio")
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      users,
      total: users.length,
      searchTerm: key.trim(),
      type: "blocked",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// search for suggestions to add in contact
export const searchInSuggestions = async (req, res) => {
  try {
    const key = req.query.q || req.query.key || req.body.key || req.body.q;
    const currentUserId = req.user?.userId;

    if (!key || key.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search key is required",
      });
    }

    const trie = await getTrie();
    if (!trie) {
      return res.status(500).json({
        success: false,
        message: "Search service is not available.",
      });
    }

    const searchTerm = key.toLowerCase().trim();
    const userIds = trie.search(searchTerm);

    const contacts = await ContactModel.find({
      user: currentUserId,
      status: { $in: ["accepted", "sent", "blocked"] },
    }).select("contact");

    const contactIds = contacts.map((c) => c.contact.toString());

    const filteredUserIds = userIds.filter(
      (id) => id !== currentUserId && !contactIds.includes(id),
    );

    if (filteredUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        total: 0,
        message: "No users found",
      });
    }

    const users = await UserModel.find({
      _id: { $in: filteredUserIds },
    })
      .select(
        "username email profileImage isOnline lastSeen bio locationEnabled location",
      )
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      users,
      total: users.length,
      searchTerm: key.trim(),
      type: "suggestions",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const search = async (req, res) => {
  try {
    const key = req.query.q || req.query.key || req.body.key || req.body.q;
    const currentUserId = req.user?.userId;

    if (!key || key.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search key is required",
      });
    }

    const trie = await getTrie();
    if (!trie) {
      return res.status(500).json({
        success: false,
        message: "Search service is not available.",
      });
    }

    const searchTerm = key.toLowerCase().trim();
    const userIds = trie.search(searchTerm);

    const contacts = await ContactModel.find({
      user: currentUserId,
      status: { $in: ["accepted", "sent", "blocked"] },
    }).select("contact");

    const contactIds = contacts.map((c) => c.contact.toString());

    const filteredUserIds = userIds.filter(
      (id) => id !== currentUserId && !contactIds.includes(id),
    );

    if (filteredUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        total: 0,
        message: "No users found",
      });
    }

    const users = await UserModel.find({
      _id: { $in: filteredUserIds },
    })
      .select("username email profileImage isOnline lastSeen bio")
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      users,
      total: users.length,
      searchTerm: key.trim(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// USER FUNCTIONS
// ============================================

export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user?.userId;

    const users = await UserModel.find({
      _id: { $ne: currentUserId },
    }).select("username email profileImage isOnline lastSeen bio");

    return res.status(200).json({
      success: true,
      users,
      total: users.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId)
      .select("-password")
      .populate("username email profileImage isOnline");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const user = await UserModel.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { username, profileImage, bio } = req.body;
    let profileImageUrl = profileImage;

    if (typeof profileImage === "string" && profileImage.startsWith("data:image/")) {
      const uploadResult = await cloudinary.uploader.upload(profileImage, {
        folder: "chatapp/profile-images",
        resource_type: "image",
      });
      profileImageUrl = uploadResult.secure_url;
    }

    if (username) {
      const existingUser = await UserModel.findOne({
        username: username,
        _id: { $ne: userId },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username is already taken",
        });
      }
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        ...(username && { username }),
        ...(profileImageUrl !== undefined && { profileImage: profileImageUrl }),
        ...(bio !== undefined && { bio }),
      },
      { returnDocument: "after", runValidators: true },
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    trieInstance = null;

    const relatedContacts = await ContactModel.find({
      $or: [{ user: userId }, { contact: userId }],
      status: "accepted",
    }).select("user contact");
    const recipientIds = new Set([userId.toString()]);
    relatedContacts.forEach((contact) => {
      recipientIds.add(contact.user.toString());
      recipientIds.add(contact.contact.toString());
    });
    recipientIds.forEach((recipientId) => {
      req.app.locals.io?.to(recipientId).emit("profile-updated", {
        user: updatedUser,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// CONTACT REQUEST FUNCTIONS - FIXED
// ============================================

// Send a contact request
export const sendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUserId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User is not authorized",
      });
    }
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "target is not found",
      });
    }
    if (targetUserId.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Can not send request yourself",
      });
    }

    const [user, targetedUser] = await Promise.all([
      UserModel.findById(userId),
      UserModel.findById(targetUserId),
    ]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (!targetedUser) {
      return res.status(404).json({
        success: false,
        message: "targeted user not found",
      });
    }

    // Check for existing contact relationship
    const existingContact = await ContactModel.findOne({
      $or: [
        { user: userId, contact: targetUserId },
        { user: targetUserId, contact: userId },
      ],
    });

    const io = req.app.locals.io;

    if (existingContact) {
      const isOutgoing = existingContact.user.toString() === userId.toString();

      switch (existingContact.status) {
        case "accepted":
          return res.status(409).json({
            success: false,
            message: "Already in your contacts.",
          });

        case "sent":
          if (isOutgoing) {
            return res.status(409).json({
              success: false,
              message: "You already sent a request to this user.",
            });
          } else {
            return res.status(409).json({
              success: false,
              message:
                "This user has already sent you a request. Please accept it.",
              pendingRequest: existingContact._id,
            });
          }

        case "blocked":
          return res.status(403).json({
            success: false,
            message: isOutgoing
              ? "You have blocked this user."
              : "This user has blocked you.",
          });

        // FIXED: Handle rejected and cancelled statuses - allow re-sending
        case "rejected":
        case "cancelled": {
          // Update the existing request back to "sent"
          const updatedRequest = await ContactModel.findByIdAndUpdate(
            existingContact._id,
            {
              status: "sent",
              updatedAt: new Date(),
            },
            { new: true }
          )
            .populate("user", "username profileImage status")
            .populate("contact", "username profileImage status");

          // Emit socket events
          io.to(userId.toString()).emit("send-request", {
            request: updatedRequest,
            message: "Request sent successfully!",
          });

          io.to(targetUserId.toString()).emit("receive-request", {
            request: updatedRequest,
            message: "You received a new friend request!",
            sender: {
              id: userId,
              username: user.username,
              profileImage: user.profileImage,
            },
          });

          emailService.sendIncomingRequestEmail({
            email: targetedUser.email,
            recipientName: targetedUser.username,
            senderName: user.username,
          }).catch(() => {});

          return res.status(200).json({
            success: true,
            sender: user,
            receiver: targetedUser,
            request: updatedRequest,
            message: "Request sent successfully!",
          });
        }

        default:
          return res.status(400).json({
            success: false,
            message: `Invalid contact status: ${existingContact.status}`,
          });
      }
    }

    // Location check
    const geoHash = req.app.locals.geoHash;

    if (geoHash && user.locationEnabled && targetedUser.locationEnabled) {
      if (
        user.location?.coordinates &&
        user.location.coordinates.length === 2 &&
        targetedUser.location?.coordinates &&
        targetedUser.location.coordinates.length === 2
      ) {
        const userDistance = geoHash.haversineDistance(
          user.location.coordinates[1],
          user.location.coordinates[0],
          targetedUser.location.coordinates[1],
          targetedUser.location.coordinates[0],
        );

        const MAX_DISTANCE = 10;

        if (userDistance > MAX_DISTANCE) {
          return res.status(400).json({
            success: false,
            message: `User is ${userDistance.toFixed(2)} km away. Only users within ${MAX_DISTANCE} km can be added.`,
            distance: Number(userDistance.toFixed(2)),
          });
        }
      }
    }

    // Create new request
    const sentRequest = new ContactModel({
      user: userId,
      contact: targetUserId,
      status: "sent",
    });

    await sentRequest.save();
    const populatedRequest = await ContactModel.findById(sentRequest._id)
      .populate("user", "username profileImage status")
      .populate("contact", "username profileImage status");

    io.to(userId.toString()).emit("send-request", {
      request: populatedRequest,
      message: "Request sent successfully!",
    });

    io.to(targetUserId.toString()).emit("receive-request", {
      request: populatedRequest,
      message: "You received a new friend request!",
      sender: {
        id: userId,
        username: user.username,
        profileImage: user.profileImage,
      },
    });

    emailService.sendIncomingRequestEmail({
      email: targetedUser.email,
      recipientName: targetedUser.username,
      senderName: user.username,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      sender: user,
      receiver: targetedUser,
      request: populatedRequest,
      message: "Request sent successfully!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cancel a sent request
export const cancelRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User is not authorized.",
      });
    }

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "request id is not found",
      });
    }

    const io = req.app.locals.io;
    const request = await ContactModel.findById(requestId)
      .populate("user", "username profileImage status")
      .populate("contact", "username profileImage status");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    if (request.status !== "sent") {
      const statusMessages = {
        accepted: "This request has already been accepted.",
        blocked: "This request is blocked.",
        rejected: "This request was rejected.",
        cancelled: "This request has already been cancelled.",
      };

      return res.status(400).json({
        success: false,
        message:
          statusMessages[request.status] ||
          `Cannot cancel request with status: ${request.status}`,
        currentStatus: request.status,
      });
    }

    const isOutgoing = request.user._id.toString() === userId.toString();

    if (!isOutgoing) {
      return res.status(403).json({
        success: false,
        message: "Only the sender can cancel this request.",
      });
    }

    const senderId = request.user._id.toString();
    const receiverId = request.contact._id.toString();
    const cancelledRequest = await ContactModel.findByIdAndUpdate(
      requestId,
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: userId,
      },
      { new: true },
    )
      .populate("user", "username profileImage status")
      .populate("contact", "username profileImage status");

    io?.to(senderId).emit("request-cancelled", {
      request: cancelledRequest,
      message: "You cancelled your request.",
      cancelledBy: {
        id: userId,
        username: request.user.username,
        profileImage: request.user.profileImage,
      },
      timestamp: new Date().toISOString(),
    });

    io?.to(receiverId).emit("request-cancelled", {
      request: cancelledRequest,
      message: "The sender cancelled their request.",
      cancelledBy: {
        id: userId,
        username: request.user.username,
        profileImage: request.user.profileImage,
      },
      timestamp: new Date().toISOString(),
    });


    return res.status(200).json({
      success: true,
      message: "Request cancelled successfully.",
      request: cancelledRequest,
      cancelledBy: userId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reject a received request
export const rejectRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rejectRequestId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User is Unauthorized",
      });
    }

    if (!rejectRequestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required.",
      });
    }

    const request = await ContactModel.findById(rejectRequestId)
      .populate("user", "username profileImage status")
      .populate("contact", "username profileImage status");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    if (request.status !== "sent") {
      const statusMessages = {
        accepted: "This request has already been accepted.",
        blocked: "This request is blocked.",
        rejected: "This request has already been rejected.",
        cancelled: "This request was cancelled.",
      };

      return res.status(400).json({
        success: false,
        message:
          statusMessages[request.status] ||
          `Cannot reject request with status: ${request.status}`,
        currentStatus: request.status,
      });
    }

    const isReceiver = request.contact._id.toString() === userId.toString();

    if (!isReceiver) {
      return res.status(403).json({
        success: false,
        message: "You can only reject requests sent to you.",
      });
    }

    const io = req.app.locals.io;
    const senderId = request.user._id.toString();
    const receiverId = request.contact._id.toString();

    const rejectedRequest = await ContactModel.findByIdAndUpdate(
      rejectRequestId,
      {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy: userId,
      },
      { returnDocument: "after" },
    )
      .populate("user", "username profileImage status")
      .populate("contact", "username profileImage status");

    io?.to(receiverId).emit("request-rejected", {
      request: rejectedRequest,
      message: "You rejected the request.",
      rejectedBy: {
        id: userId,
        username: request.contact.username,
        profileImage: request.contact.profileImage,
      },
      timestamp: new Date().toISOString(),
    });

    io?.to(senderId).emit("request-rejected", {
      request: rejectedRequest,
      message: "Your request was rejected.",
      rejectedBy: {
        id: userId,
        username: request.contact.username,
        profileImage: request.contact.profileImage,
      },
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Request rejected successfully.",
      request: rejectedRequest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Accept a request and add to contacts
export const addToContacts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID format.",
      });
    }

    const request = await ContactModel.findById(requestId)
      .populate("user", "username profileImage status")
      .populate("contact", "username profileImage status");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    if (request.status !== "sent") {
      const statusMessages = {
        accepted: "This request has already been accepted.",
        blocked: "This request is blocked.",
        rejected: "This request was rejected.",
        cancelled: "This request was cancelled.",
      };

      return res.status(400).json({
        success: false,
        message:
          statusMessages[request.status] ||
          `Cannot accept request with status: ${request.status}`,
        currentStatus: request.status,
      });
    }

    const isReceiver = request.contact._id.toString() === userId.toString();

    if (!isReceiver) {
      return res.status(403).json({
        success: false,
        message: "Only the receiver can accept this request.",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const acceptedRequest = await ContactModel.findByIdAndUpdate(
        requestId,
        {
          status: "accepted",
          acceptedAt: new Date(),
          acceptedBy: userId,
        },
        { new: true, session },
      )
        .populate("user", "username profileImage status")
        .populate("contact", "username profileImage status");

      if (acceptedRequest) {
        await ContactModel.updateOne(
          {
            user: acceptedRequest.contact._id,
            contact: acceptedRequest.user._id,
          },
          {
            $set: {
              status: "accepted",
              lastInteraction: new Date(),
            },
            $setOnInsert: {
              user: acceptedRequest.contact._id,
              contact: acceptedRequest.user._id,
            },
          },
          {
            upsert: true,
            session,
          },
        );
      }

      await session.commitTransaction();
      session.endSession();

      const io = req.app.locals.io;
      const senderId = request.user._id.toString();
      const receiverId = request.contact._id.toString();

      io?.to(senderId).emit("request-accepted", {
        request: acceptedRequest,
        message: "Your request has been accepted!",
        acceptedBy: {
          id: userId,
          username: request.contact.username,
          profileImage: request.contact.profileImage,
        },
        timestamp: new Date().toISOString(),
      });

      io?.to(receiverId).emit("request-accepted", {
        request: acceptedRequest,
        message: "Contact added successfully!",
        timestamp: new Date().toISOString(),
      });


      return res.status(200).json({
        success: true,
        message: "Contact added successfully.",
        request: acceptedRequest,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// CONTACT MANAGEMENT FUNCTIONS
// ============================================

export const getContacts = async (req, res) => {
  try {
    const userId = req.user.userId;

    const contacts = await ContactModel.find({
      user: userId,
      status: "accepted",
    })
      .populate(
        "contact",
        "username email profileImage isOnline lastSeen bio locationEnabled",
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      contacts: contacts.map((c) => ({
        ...c.contact.toObject(),
        status: c.status,
        starredMessages: c.starredMessages,
        contactId: c.contact._id,
        createdAt: c.createdAt,
        _id: c.contact._id,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeFromContacts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { contactId } = req.params;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        message: "Contact ID is required",
      });
    }

    const result = await ContactModel.findOneAndDelete({
      user: userId,
      contact: contactId,
    });

    await ContactModel.findOneAndDelete({
      user: contactId,
      contact: userId,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact removed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getRequests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const io = req.app.locals.io;

    const outgoing = await ContactModel.find({
      user: userId,
      status: "sent",
    })
      .populate("contact", "username email profileImage status")
      .sort({ createdAt: -1 });

    const incoming = await ContactModel.find({
      contact: userId,
      status: "sent",
    })
      .populate("user", "username email profileImage status")
      .sort({ createdAt: -1 });

    const inComingCount = await ContactModel.countDocuments({
      contact: userId,
      status: "sent",
    });
    const outGoingCount = await ContactModel.countDocuments({
      user: userId,
      status: "sent",
    });

    if (io) {
      io.to(userId.toString()).emit("requests-updated", {
        incoming,
        outgoing,
        inComingCount,
        outGoingCount,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      outgoing,
      incoming,
      inComingCount,
      outGoingCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const blockContact = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { contactId } = req.params;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        message: "Contact ID is required",
      });
    }

    if (userId === contactId) {
      return res.status(400).json({
        success: false,
        message: "Cannot block yourself",
      });
    }

    const contact = await UserModel.findById(contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact user not found",
      });
    }

    const contactRecord = await ContactModel.findOneAndUpdate(
      { user: userId, contact: contactId },
      { status: "blocked" },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await ContactModel.findOneAndUpdate(
      { user: contactId, contact: userId },
      { status: "blocked" },
      { upsert: true },
    );

    return res.status(200).json({
      success: true,
      message: `${contact.username} has been blocked`,
      contact: contactRecord,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const unblockContact = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { contactId } = req.params;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        message: "Contact ID is required",
      });
    }

    if (userId === contactId) {
      return res.status(400).json({
        success: false,
        message: "Cannot unblock yourself",
      });
    }

    const contact = await UserModel.findById(contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact user not found",
      });
    }

    const contactRecord = await ContactModel.findOneAndUpdate(
      { user: userId, contact: contactId },
      { status: "accepted" },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await ContactModel.findOneAndUpdate(
      { user: contactId, contact: userId },
      { status: "accepted" },
      { upsert: true },
    );

    return res.status(200).json({
      success: true,
      message: `${contact.username} has been unblocked`,
      contact: contactRecord,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBlockedContacts = async (req, res) => {
  try {
    const blocked = await ContactModel.find({ user: req.user.userId, status: "blocked" })
      .populate("contact", "username email profileImage isOnline lastSeen bio")
      .sort({ updatedAt: -1 });
    return res.json({ success: true, contacts: blocked.filter((record) => record.contact).map((record) => ({
      ...record.contact.toObject(), contactId: record.contact._id, _id: record.contact._id,
      status: "blocked", customName: record.customName, notes: record.notes,
      isFavorite: record.isFavorite, isMuted: record.isMuted, muteUntil: record.muteUntil,
    })) });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

export const toggleStarredMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;
    const MessageModel = (await import("../models/MessageModel.js")).default;
    const message = await MessageModel.findById(messageId).select("chat sender receiver");
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    if (message.sender.toString() !== userId && message.receiver.toString() !== userId) return res.status(403).json({ success: false, message: "You cannot star this message" });
    const otherUser = message.sender.toString() === userId ? message.receiver : message.sender;
    const contact = await ContactModel.findOne({ user: userId, contact: otherUser });
    if (!contact) return res.status(400).json({ success: false, message: "Message sender is not a contact" });
    const alreadyStarred = contact.starredMessages.some((id) => id.toString() === messageId);
    if (alreadyStarred) contact.starredMessages.pull(messageId);
    else contact.starredMessages.addToSet(messageId);
    await contact.save();
    return res.json({ success: true, starred: !alreadyStarred, starredMessages: contact.starredMessages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateContactDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { contactId } = req.params;
    const { customName, notes, isFavorite, isMuted, muteUntil } = req.body;
    const contact = await ContactModel.findOne({ user: userId, contact: contactId });
    if (!contact) return res.status(404).json({ success: false, message: "Contact not found" });
    if (customName !== undefined) contact.customName = customName?.trim() || undefined;
    if (notes !== undefined) contact.notes = notes?.trim() || undefined;
    if (typeof isFavorite === "boolean") contact.isFavorite = isFavorite;
    if (typeof isMuted === "boolean") { contact.isMuted = isMuted; contact.muteUntil = isMuted && muteUntil ? new Date(muteUntil) : null; }
    await contact.save();
    return res.json({ success: true, contact });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
