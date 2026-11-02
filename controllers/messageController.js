import UserModel from "../models/UserModel.js";
import ChatModel from "../models/ChatModel.js";
import MessageModel from "../models/messageModel.js";
import getDataUrl from "../utils/bufferGenerator.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import path from "path";
import ReportModel from "../models/ReportModel.js";

// SEND TEXT MESSAGE
export const sendMessage = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { chatId } = req.params;
    const { content, type, iv, authTag, replyTo, forwardedFrom } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId,
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
    }

    const receiverId = chat.participants.find(
      (p) => p.toString() !== userId.toString(),
    );

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "No receiver found in chat",
      });
    }

    const io = req.app.locals.io;

    if (io) {
      io.to(receiverId.toString()).emit("stop-typing", {
        senderId: userId,
        receiverId: receiverId.toString(),
      });
    }

    if (replyTo) {
      const reply = await MessageModel.findOne({ _id: replyTo, chat: chatId });
      if (!reply) return res.status(400).json({ success: false, message: "Reply message was not found in this chat" });
    }

    let resolvedType = type || "text";
    let fileDetails = null;
    let metadata = null;

    if (forwardedFrom) {
      const original = await MessageModel.findById(forwardedFrom);
      if (!original) {
        return res.status(400).json({ success: false, message: "Original forwarded message was not found" });
      }
      if (original.fileDetails?.url) {
        resolvedType = original.type;
        fileDetails = original.fileDetails;
        metadata = original.metadata;
      }
    }

    const message = new MessageModel({
      chat: chatId,
      sender: userId,
      receiver: receiverId,
      content,
      type: resolvedType,
      fileDetails: fileDetails || undefined,
      metadata: metadata || undefined,
      status: "sent",
      iv: iv || null,
      authTag: authTag || null,
      replyTo: replyTo || null,
      forwardedFrom: forwardedFrom || null,
    });

    // Text messages are persisted and emitted immediately for low-latency delivery.
    const savedMessage = await message.save();
    await savedMessage.populate("sender", "username email profileImage");
    await savedMessage.populate("receiver", "username email profileImage");
    if (savedMessage.replyTo) await savedMessage.populate({ path: "replyTo", populate: { path: "sender", select: "username profileImage" } });

    chat.latestMessage = savedMessage._id;
    chat.unreadCount = (chat.unreadCount || 0) + 1;
    await chat.save();

    if (io) {
      const receiverIdStr = receiverId.toString();
      const senderIdStr = userId.toString();

      io.to(receiverIdStr).emit("receive-message", savedMessage);
      io.to(senderIdStr).emit("message-sent", {
        success: true,
        message: savedMessage,
        chatId: chat._id,
      });

      const [receiverUnreadCount, senderUnreadCount, chatData] =
        await Promise.all([
          MessageModel.countDocuments({
            receiver: receiverId,
            status: { $ne: "read" },
          }),
          MessageModel.countDocuments({
            receiver: userId,
            status: { $ne: "read" },
          }),
          ChatModel.findById(chat._id)
            .populate("participants", "username email profileImage")
            .populate("latestMessage")
            .lean(),
        ]);

      io.to(receiverIdStr).emit("unread-count", { count: receiverUnreadCount, contactId: senderIdStr });
      io.to(senderIdStr).emit("unread-count", { count: senderUnreadCount, contactId: receiverIdStr });

      if (chatData) {
        io.to(senderIdStr).emit("chat-updated", chatData);
        io.to(receiverIdStr).emit("chat-updated", chatData);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: savedMessage,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const buildCloudinaryMediaUrls = (publicId, resourceType, mimeType) => {
  const baseOptions = {
    secure: true,
    resource_type: resourceType,
  };

  const originalUrl = cloudinary.url(publicId, baseOptions);

  const previewTransform =
    resourceType === "image"
      ? [{ width: 900, crop: "limit" }, { quality: "auto" }, { fetch_format: "auto" }]
      : resourceType === "video"
        ? [{ width: 900, crop: "limit" }, { quality: "auto" }, { fetch_format: "auto" }]
        : [{ quality: "auto" }, { fetch_format: "auto" }];

  const thumbnailTransform =
    resourceType === "video"
      ? [{ width: 320, height: 180, crop: "fill" }, { quality: "auto" }, { fetch_format: "auto" }]
      : previewTransform;

  return {
    originalUrl,
    previewUrl: cloudinary.url(publicId, {
      ...baseOptions,
      transformation: previewTransform,
    }),
    thumbnailUrl: cloudinary.url(publicId, {
      ...baseOptions,
      transformation: thumbnailTransform,
    }),
  };
};

// SEND FILE MESSAGE WITH CLOUDINARY

export const sendFileMessage = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user?.userId;
    const { chatId } = req.params;


    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - User not authenticated",
      });
    }

    const { caption, type, replyTo } = req.body;

    // Validate Files

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "File is required",
      });
    }

    // Find Chat
    const chat = await ChatModel.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Check Participant

    const userIdStr = userId.toString();
    const isParticipant = chat.participants.some(
      (participantId) => participantId.toString() === userIdStr,
    );


    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
    }

    // Receiver

    const receiverId = chat.participants.find(
      (id) => id.toString() !== userIdStr,
    );

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver not found",
      });
    }

    const io = req.app.locals.io;
    const queue = req.app.locals.messageQueue;
    const processQueueFn = req.app.locals.processQueue;

    if (io) {
      io.to(receiverId.toString()).emit("stop-typing", {
        senderId: userId,
        receiverId: receiverId.toString(),
      });
    }

    // Upload Files to Cloudinary

    const uploadedFiles = [];

    for (const file of req.files) {
      try {
        const fileBuffer = getDataUrl(file);

        let resourceType = "raw";
        let transformations = [
          { quality: "auto" },
          { fetch_format: "auto" },
        ];

        if (file.mimetype.startsWith("image/")) {
          resourceType = "image";
          transformations = [
            { width: 1280, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ];
        } else if (file.mimetype.startsWith("video/")) {
          resourceType = "video";
          transformations = [
            { width: 1280, crop: "limit" },
            { quality: "auto" },
            { format: "mp4" },
          ];
        } else if (file.mimetype.startsWith("audio/")) {
          resourceType = "video";
          transformations = [
            { quality: "auto" },
            { format: "mp3" },
          ];
        }

        const uploadResult = await cloudinary.uploader.upload(
          fileBuffer.content,
          {
            folder: "chat-media",
            resource_type: resourceType,
            public_id: `${Date.now()}_${file.originalname.split(".")[0]}`,
            transformation: transformations,
          },
        );

        const mediaUrls = buildCloudinaryMediaUrls(
          uploadResult.public_id,
          uploadResult.resource_type,
          file.mimetype,
        );

        uploadedFiles.push({
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          url: mediaUrls.originalUrl,
          previewUrl: mediaUrls.previewUrl,
          originalUrl: mediaUrls.originalUrl,
          thumbnailUrl: mediaUrls.thumbnailUrl,
          publicId: uploadResult.public_id,
          resourceType: uploadResult.resource_type,
          width: uploadResult.width || null,
          height: uploadResult.height || null,
          duration: uploadResult.duration || null,
          isCompressed: String(file.mimetype).startsWith("image/") || String(file.mimetype).startsWith("video/") || String(file.mimetype).startsWith("audio/"),
        });
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: `Failed to upload file: ${file.originalname}`,
          error: uploadError.message,
        });
      }
    }


    // Create Messages (with Queue support)

    const messageObjects = [];

    for (const fileData of uploadedFiles) {
      const message = new MessageModel({
        chat: chatId,
        sender: userId,
        receiver: receiverId,
        content: caption || fileData.fileName || "",
        type: type || "file",
        status: "sent",
        replyTo: replyTo || null,
        fileDetails: {
          fileName: fileData.fileName,
          fileSize: fileData.fileSize,
          mimeType: fileData.mimeType,
          url: fileData.url,
          previewUrl: fileData.previewUrl || fileData.url,
          originalUrl: fileData.originalUrl || fileData.url,
          thumbnailUrl: fileData.thumbnailUrl || fileData.url,
          publicId: fileData.publicId,
          resourceType: fileData.resourceType,
          isCompressed: Boolean(fileData.isCompressed),
        },
        metadata: {
          width: fileData.width || null,
          height: fileData.height || null,
          duration: fileData.duration || null,
          thumbnail: fileData.thumbnailUrl || fileData.url || null,
        },
      });

      messageObjects.push({ message, fileData });
    }

    // without queue save directly
    if (!queue || !processQueueFn) {
      const savedMessages = [];

      for (const { message } of messageObjects) {
        const savedMessage = await message.save();
        await savedMessage.populate("sender", "username email profileImage");
        await savedMessage.populate("receiver", "username email profileImage");
        if (savedMessage.replyTo) {
          await savedMessage.populate({ path: "replyTo", populate: { path: "sender", select: "username profileImage" } });
        }
        savedMessages.push(savedMessage);
      }

      // Update chat
      if (savedMessages.length > 0) {
        chat.latestMessage = savedMessages[savedMessages.length - 1]._id;
        chat.unreadCount = (chat.unreadCount || 0) + savedMessages.length;
        await chat.save();
      }

      // Emit socket events
      if (io) {
        for (const msg of savedMessages) {
          io.to(receiverId.toString()).emit("receive-message", msg);
        }

        const unreadCount = await MessageModel.countDocuments({
          receiver: receiverId,
          status: { $ne: "read" },
        });
        io.to(receiverId.toString()).emit("unread-count", { count: unreadCount, contactId: userId.toString() });

        const senderUnreadCount = await MessageModel.countDocuments({
          receiver: userId,
          status: { $ne: "read" },
        });
        io.to(userId.toString()).emit("unread-count", { count: senderUnreadCount, contactId: receiverId.toString() });
      }


      let responseData =
        savedMessages.length === 1 ? savedMessages[0] : savedMessages;

      return res.status(201).json({
        success: true,
        message: `${savedMessages.length} file(s) sent successfully`,
        data: responseData,
      });
    }

    // processing with queue
    const queuedMessages = [];

    for (const { message } of messageObjects) {
      // Populate the message for immediate response
      const populatedMessage = await MessageModel.populate(message, [
        { path: "sender", select: "username email profileImage" },
        { path: "receiver", select: "username email profileImage" },
      ]);

      // Add to queue
      queue.enqueue({
        message,
        chat,
      });

      queuedMessages.push(populatedMessage);
    }

    // Process the queue
    processQueueFn();


    let responseData =
      queuedMessages.length === 1 ? queuedMessages[0] : queuedMessages;

    return res.status(201).json({
      success: true,
      message: `${queuedMessages.length} file(s) queued successfully`,
      data: responseData,
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET MESSAGES BY CHAT

export const getMessageByChat = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { chatId } = req.params;
    const { limit = 30, before } = req.query;

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId,
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
    }

    const query = {
      chat: chatId,
      deletedFor: { $ne: userId },
    };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await MessageModel.find(query)
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
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      messages: messages.reverse(),
      total: messages.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE MESSAGE WITH REAL-TIME SUPPORT
export const deleteMessage = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    const { messageId } = req.params;
    const scope = req.query?.scope === "me" ? "me" : "everyone";


    // Find the message
    const message = await MessageModel.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Get chat details before deleting
    const chat = await ChatModel.findById(message.chat);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId.toString(),
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - You are not a participant in this chat",
      });
    }

    // Store chatId and sender/receiver info for response
    const chatId = message.chat.toString();
    const senderId = message.sender.toString();
    const receiverId = message.receiver.toString();

    // Delete for me: only hide for current user
    if (scope === "me") {
      if (!message.deletedFor.some((id) => id.toString() === userId.toString())) {
        message.deletedFor.push(userId);
        await message.save();
      }

      const io = req.app.locals.io;
      if (io) {
        io.to(userId.toString()).emit("message-deleted", {
          scope: "me",
          messageId,
          chatId,
          deletedBy: userId,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        success: true,
        message: "Message deleted for you",
        data: {
          messageId,
          chatId,
          deletedBy: userId,
          scope: "me",
        },
      });
    }

    // Delete for everyone: only sender can perform this action
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - Only sender can delete for everyone",
      });
    }

    const mediaPublicId = message.fileDetails?.publicId;
    const mediaResourceType = message.fileDetails?.resourceType;

    // Soft delete to preserve chat history like WhatsApp
    message.isDeletedForEveryone = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    message.content = "This message was deleted";

    // remove media references from UI payload
    message.fileDetails = {
      fileName: null,
      fileSize: null,
      mimeType: null,
      url: null,
      publicId: null,
      resourceType: null,
    };
    message.metadata = {
      width: null,
      height: null,
      duration: null,
      thumbnail: null,
    };
    message.type = "text";

    // Delete cloudinary file if exists
    if (mediaPublicId) {
      try {
        await cloudinary.uploader.destroy(mediaPublicId, {
          resource_type: mediaResourceType || "image",
        });
      } catch (cloudinaryError) {
      }
    }

    await message.save();

    // keep last message pointer but update preview timestamp
    if (chat.latestMessage?.toString() === messageId) {
      await chat.save();
    }

    // Get all participants
    const participantIds = chat.participants.map((p) => p.toString());

    // Emit real-time deletion event
    const io = req.app.locals.io;
    if (io) {
      const deletionData = {
        scope: "everyone",
        messageId: messageId,
        chatId: chatId,
        deletedBy: userId,
        senderId: senderId,
        receiverId: receiverId,
        content: "This message was deleted",
        timestamp: new Date().toISOString(),
      };

      // Emit to each participant individually
      participantIds.forEach((participantId) => {
        io.to(participantId).emit("message-deleted", deletionData);
      });

      // Also emit to the chat room for anyone who might be in it
      io.to(chatId).emit("message-deleted", deletionData);

      // Emit chat updated event to refresh unread counts and last message
      const updatedChat = await ChatModel.findById(chatId)
        .populate("participants", "username email profileImage")
        .populate("latestMessage")
        .lean();

      participantIds.forEach((participantId) => {
        io.to(participantId).emit("chat-updated", updatedChat);
      });

      // Emit to chat room as well
      io.to(chatId).emit("chat-updated", updatedChat);
    }


    return res.status(200).json({
      success: true,
      message: "Message deleted for everyone",
      data: {
        messageId: messageId,
        chatId: chatId,
        deletedBy: userId,
        scope: "everyone",
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to delete message",
    });
  }
};
// MARK SINGLE MESSAGE AS READ

export const markMessageAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { messageId } = req.params;

    const message = await MessageModel.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (message.receiver.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not the receiver of this message",
      });
    }

    if (message.status === "read") {
      return res.status(200).json({
        success: true,
        message: "Message already marked as read",
        data: message,
      });
    }

    const alreadyReadByUser = message.readBy.some(
      (r) => r.user.toString() === userId,
    );

    if (!alreadyReadByUser) {
      message.readBy.push({
        user: userId,
        readAt: new Date(),
      });
    }

    message.status = "read";
    await message.save();

    const io = req.app.locals.io;

    if (io) {
      const senderId = message.sender.toString();
      const receiverId = message.receiver.toString();
      const messageData = message.toObject ? message.toObject() : message;

      const emitData = {
        message: messageData,
        senderId: senderId,
        receiverId: receiverId,
        status: "read",
        messageId: message._id,
        chatId: message.chat,
        readBy: userId,
        readAt: new Date().toISOString(),
      };

      io.to(senderId).emit("markMessage-read", emitData);
      io.to(senderId).emit("message-read", emitData);
      io.to(receiverId).emit("markMessage-read", emitData);
      io.to(receiverId).emit("message-read", emitData);

      const senderUnreadCount = await MessageModel.countDocuments({
        receiver: senderId,
        status: { $ne: "read" },
      });
      io.to(senderId).emit("unread-count", { count: senderUnreadCount, contactId: receiverId });

      const receiverUnreadCount = await MessageModel.countDocuments({
        receiver: receiverId,
        status: { $ne: "read" },
      });
      io.to(receiverId).emit("unread-count", { count: receiverUnreadCount, contactId: senderId });
    }

    return res.status(200).json({
      success: true,
      message: "Message marked as read",
      data: message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// MARK ALL MESSAGES AS READ IN CHAT

export const markAllMessageAsRead = async (req, res) => {
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

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId.toString(),
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
    }

    const unreadMessages = await MessageModel.find({
      chat: chatId,
      receiver: userId,
      status: { $ne: "read" },
      deletedFor: { $ne: userId },
    });

    if (unreadMessages.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No unread messages",
        count: 0,
      });
    }

    await MessageModel.updateMany(
      {
        chat: chatId,
        receiver: userId,
        status: { $ne: "read" },
      },
      {
        $set: {
          status: "read",
        },
        $push: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      },
    );

    const io = req.app.locals.io;

    if (io) {
      for (const message of unreadMessages) {
        const senderId = message.sender.toString();
        const emitData = {
          messageId: message._id.toString(),
          senderId: senderId,
          receiverId: userId,
          status: "read",
        };
        io.to(senderId).emit("markMessage-read", emitData);
      }

      const senderIds = [
        ...new Set(unreadMessages.map((m) => m.sender.toString())),
      ];
      for (const senderId of senderIds) {
        io.to(userId).emit("unread-count", { count: 0, contactId: senderId });
        const senderUnreadCount = await MessageModel.countDocuments({
          receiver: senderId,
          status: { $ne: "read" },
          deletedFor: { $ne: senderId },
        });
        io.to(senderId).emit("unread-count", { count: senderUnreadCount, contactId: userId });
      }
    }

    return res.status(200).json({
      success: true,
      message: "All messages marked as read",
      count: unreadMessages.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET UNREAD COUNT

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const unreadCount = await MessageModel.countDocuments({
      receiver: userId,
      status: { $ne: "read" },
      deletedFor: { $ne: userId },
    });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET UNREAD COUNT BY CHAT

export const getUnreadCountByChat = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { chatId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId,
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
    }

    const unreadCount = await MessageModel.countDocuments({
      chat: chatId,
      receiver: userId,
      status: { $ne: "read" },
      deletedFor: { $ne: userId },
    });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET MESSAGE BY ID

export const getMessageById = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { messageId } = req.params;

    const message = await MessageModel.findById(messageId)
      .populate("sender", "username email profileImage")
      .populate("receiver", "username email profileImage");

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (
      message.sender.toString() !== userId &&
      message.receiver.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this message",
      });
    }

    return res.status(200).json({
      success: true,
      data: message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// EDIT A TEXT MESSAGE
export const editMessage = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { messageId } = req.params;
    const content = req.body?.content?.trim();
    if (!content) return res.status(400).json({ success: false, message: "Message content is required" });

    const message = await MessageModel.findById(messageId);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    if (message.sender.toString() !== userId) return res.status(403).json({ success: false, message: "Only the sender can edit this message" });
    if (message.isDeletedForEveryone || message.type !== "text") return res.status(400).json({ success: false, message: "This message cannot be edited" });
    if (Date.now() - message.createdAt.getTime() > 15 * 60 * 1000) {
      return res.status(400).json({ success: false, message: "Messages can only be edited within 15 minutes" });
    }

    message.content = content;
    message.isEdited = true;
    await message.save();
    await message.populate(["sender", "receiver", "replyTo"]);
    req.app.locals.io?.to(message.chat.toString()).emit("message-edited", message);
    for (const participant of (await ChatModel.findById(message.chat).select("participants").lean())?.participants || []) {
      req.app.locals.io?.to(participant.toString()).emit("message-edited", message);
    }
    return res.json({ success: true, message: "Message updated", data: message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ADD OR CHANGE A REACTION. Selecting the same emoji again removes it.
export const toggleReaction = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { messageId } = req.params;
    const emoji = req.body?.emoji;
    const allowed = ["❤️", "😂", "😊", "😮", "😢", "😡", "👍", "👎", "🔥", "💯"];
    if (!allowed.includes(emoji)) return res.status(400).json({ success: false, message: "Unsupported reaction" });
    const message = await MessageModel.findById(messageId);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    const chat = await ChatModel.findById(message.chat).select("participants");
    if (!chat?.participants.some((id) => id.toString() === userId)) return res.status(403).json({ success: false, message: "You are not a participant in this chat" });
    const existing = message.reactions.find((reaction) => reaction.user.toString() === userId);
    if (existing?.emoji === emoji) message.reactions.pull(existing._id);
    else if (existing) existing.emoji = emoji;
    else message.reactions.push({ user: userId, emoji });
    await message.save();
    await message.populate("reactions.user", "username profileImage");
    for (const participant of chat.participants) req.app.locals.io?.to(participant.toString()).emit("reaction-updated", { messageId, reactions: message.reactions });
    return res.json({ success: true, data: message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const reportMessage = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { messageId } = req.params;
    const allowedReasons = ["spam", "harassment", "hate", "violence", "scam", "other"];
    const reason = req.body?.reason?.trim();
    if (!allowedReasons.includes(reason)) return res.status(400).json({ success: false, message: "Choose a valid report reason" });
    const message = await MessageModel.findById(messageId).select("sender receiver");
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    if (message.sender.toString() !== userId && message.receiver.toString() !== userId) return res.status(403).json({ success: false, message: "You cannot report this message" });
    if (message.sender.toString() === userId) return res.status(400).json({ success: false, message: "You cannot report your own message" });
    const existingReport = await ReportModel.exists({ message: messageId, reporter: userId });
    if (existingReport) return res.status(409).json({ success: false, message: "You have already reported this message" });
    const report = await ReportModel.create({ message: messageId, reporter: userId, reason });
    return res.status(201).json({ success: true, message: "Report submitted", data: report });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
