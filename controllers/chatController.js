import ChatModel from "../models/ChatModel.js";
import MessageModel from "../models/messageModel.js";
import UserModel from "../models/UserModel.js";
import ContactModel from "../models/ContactModel.js";
import cloudinary from "../config/cloudinary.js";

//  CREATE OR GET CHAT 
export const getOrCreateChat = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { receiverId } = req.params;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required",
      });
    }

    if (userId === receiverId) {
      return res.status(400).json({
        success: false,
        message: "Cannot chat with yourself",
      });
    }

    // Check if receiver exists
    const receiver = await UserModel.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if chat already exists
    let chat = await ChatModel.findOne({
      participants: { $all: [userId, receiverId], $size: 2 },
      isGroupChat: false,
    })
      .populate("participants", "username email profileImage isOnline lastSeen")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "username email profileImage",
        },
      });

    // If no chat exists, create one
    if (!chat) {
      chat = new ChatModel({
        participants: [userId, receiverId],
        encryption: true,
        isGroupChat: false,
      });
      await chat.save();
      await chat.populate("participants", "username email profileImage isOnline lastSeen");
    }

    // Get messages
    const messages = await MessageModel.find({
      chat: chat._id,
      deletedFor: { $ne: userId },
    })
      .where("isDeleted", false)
      .populate("sender", "username email profileImage")
      .populate("receiver", "username email profileImage")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "username profileImage",
        },
      })
      .populate({
        path: "reactions.user",
        select: "username profileImage",
      })
      .sort({ createdAt: 1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      chat: {
        ...chat.toObject(),
        messages,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  GET ALL CHATS 
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const isArchived = req.query.archived === "true";
    const chats = await ChatModel.find({
      participants: userId,
      archivedBy: isArchived ? userId : { $ne: userId },
    })
      .populate("participants", "username email profileImage isOnline lastSeen")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "username email profileImage",
        },
      })
      .sort({ updatedAt: -1 });

    // Get unread count and other participant for each chat
    const chatWithDetails = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await MessageModel.countDocuments({
          chat: chat._id,
          receiver: userId,
          status: { $ne: "read" },
          deletedFor: { $ne: userId },
          isDeleted: false,
        });

        const otherParticipant = chat.participants.find(
          (p) => p._id.toString() !== userId
        );

        // Check if muted
        const isMuted = chat.mutedUsers.some(
          (m) => m.user.toString() === userId
        );

        return {
          ...chat.toObject(),
          otherParticipant,
          unreadCount,
          isMuted,
        };
      })
    );

    return res.status(200).json({
      success: true,
      chats: chatWithDetails,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  GET CHAT BY ID 
export const getChatById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatId } = req.params;

    const chat = await ChatModel.findById(chatId)
      .populate("participants", "username email profileImage isOnline lastSeen")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "username email profileImage",
        },
      })
      .populate("groupAdmin", "username email profileImage");

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      (p) => p._id.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
    }

    // Get messages
    const messages = await MessageModel.find({
      chat: chatId,
      deletedFor: { $ne: userId },
    })
      .where("isDeleted", false)
      .populate("sender", "username email profileImage")
      .populate("receiver", "username email profileImage")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "username profileImage",
        },
      })
      .populate({
        path: "reactions.user",
        select: "username profileImage",
      })
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      chat: {
        ...chat.toObject(),
        messages,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  DELETE CHAT 
export const deleteChat = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatId } = req.params;

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
    }

    // Soft delete - mark all messages as deleted for this user
    await MessageModel.updateMany(
      { chat: chatId },
      { $addToSet: { deletedFor: userId } }
    );

    // Archive for user
    if (!chat.archivedBy.includes(userId)) {
      chat.archivedBy.push(userId);
      await chat.save();
    }

    return res.status(200).json({
      success: true,
      message: "Chat archived successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  ARCHIVE CHAT 
export const archiveChat = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatId } = req.params;

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }
    if (!chat.participants.some((id) => id.toString() === userId)) return res.status(403).json({ success: false, message: "You are not a participant in this chat" });

    if (!chat.archivedBy.some((id) => id.toString() === userId)) {
      chat.archivedBy.push(userId);
      await chat.save();
    }

    return res.status(200).json({
      success: true,
      message: "Chat archived successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  UNARCHIVE CHAT 
export const unarchiveChat = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatId } = req.params;

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }
    if (!chat.participants.some((id) => id.toString() === userId)) return res.status(403).json({ success: false, message: "You are not a participant in this chat" });

    chat.archivedBy = chat.archivedBy.filter(
      (id) => id.toString() !== userId
    );
    await chat.save();

    return res.status(200).json({
      success: true,
      message: "Chat unarchived successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  MUTE CHAT 
export const muteChat = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatId } = req.params;

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }
    if (!chat.participants.some((id) => id.toString() === userId)) return res.status(403).json({ success: false, message: "You are not a participant in this chat" });

    // Check if already muted
    const existingMute = chat.mutedUsers.find(
      (m) => m.user.toString() === userId
    );

    if (!existingMute) {
      chat.mutedUsers.push({ user: userId, mutedAt: new Date() });
      await chat.save();
    }

    return res.status(200).json({
      success: true,
      message: "Chat muted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  UNMUTE CHAT 
export const unmuteChat = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatId } = req.params;

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }
    if (!chat.participants.some((id) => id.toString() === userId)) return res.status(403).json({ success: false, message: "You are not a participant in this chat" });

    chat.mutedUsers = chat.mutedUsers.filter(
      (m) => m.user.toString() !== userId
    );
    await chat.save();

    return res.status(200).json({
      success: true,
      message: "Chat unmuted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  PIN MESSAGE 
export const pinMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatId, messageId } = req.params;

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    const message = await MessageModel.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (!chat.participants.some((id) => id.toString() === userId)) return res.status(403).json({ success: false, message: "You are not a participant in this chat" });
    if (message.chat.toString() !== chatId) return res.status(400).json({ success: false, message: "Message does not belong to this chat" });
    if (!chat.pinnedMessages.some((id) => id.toString() === messageId)) {
      chat.pinnedMessages.push(messageId);
      await chat.save();
    }

    return res.status(200).json({
      success: true,
      message: "Message pinned successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  UNPIN MESSAGE 
export const unpinMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatId, messageId } = req.params;

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }
    if (!chat.participants.some((id) => id.toString() === userId)) return res.status(403).json({ success: false, message: "You are not a participant in this chat" });

    chat.pinnedMessages = chat.pinnedMessages.filter(
      (id) => id.toString() !== messageId
    );
    await chat.save();

    return res.status(200).json({
      success: true,
      message: "Message unpinned successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Permanently clear all messages for a chat and remove uploaded media.
export const clearChat = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatId } = req.params;
    const chat = await ChatModel.findById(chatId).select("participants");
    if (!chat) return res.status(404).json({ success: false, message: "Chat not found" });
    if (!chat.participants.some((id) => id.toString() === userId.toString())) return res.status(403).json({ success: false, message: "You are not a participant in this chat" });

    const messages = await MessageModel.find({ chat: chatId }).select("fileDetails.publicId fileDetails.resourceType").lean();
    const media = messages.filter((item) => item.fileDetails?.publicId);
    const cleanup = await Promise.allSettled(media.map((item) => cloudinary.uploader.destroy(
      item.fileDetails.publicId,
      { resource_type: item.fileDetails.resourceType || "image", invalidate: true },
    )));
    const failedMedia = cleanup.filter((item) => item.status === "rejected").length;

    const result = await MessageModel.deleteMany({ chat: chatId });
    await ChatModel.findByIdAndUpdate(chatId, { $unset: { latestMessage: 1 }, $set: { pinnedMessages: [] } });
    req.app.locals.io?.to(chatId).emit("chat-cleared", { chatId, deletedCount: result.deletedCount });
    return res.json({ success: true, message: "Chat cleared successfully", deletedCount: result.deletedCount, mediaRemoved: media.length - failedMedia, mediaCleanupFailed: failedMedia });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
