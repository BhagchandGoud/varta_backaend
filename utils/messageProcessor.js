import MessageModel from "../models/MessageModel.js";
import ChatModel from "../models/ChatModel.js";

const typingTimeouts = new Map(); // store typing timeout references
let isProcessingQueue = false;

// Store app locals globally
let appLocals = null;

export const setAppLocals = (app) => {
  appLocals = app.locals;
};

export const processQueue = async () => {
  if (!appLocals) {
    return;
  }

  const queue = appLocals.messageQueue;
  const io = appLocals.io;

  if (!queue) {
    return;
  }

  if (isProcessingQueue) {
    return;
  }

  isProcessingQueue = true;

  // process until queue is empty
  try {
    while (!queue.isEmpty()) {
      try {
        const item = queue.dequeue();
        if (!item) break;

        const { message, chat } = item;

        // save message to database
        const savedMessage = await message.save();

        // Populate sender and receiver details
        await savedMessage.populate("sender", "username email profileImage");
        await savedMessage.populate("receiver", "username email profileImage");

        // Update the schema's latest-message reference and unread count.
        chat.latestMessage = savedMessage._id;

        // increment unread count for receiver
        const receiverId = savedMessage.receiver._id.toString();
        const senderId = savedMessage.sender._id.toString();
        chat.unreadCount = (chat.unreadCount || 0) + 1;

        await chat.save();

        if (io) {
          // Emit stop typing to receiver
          io.to(receiverId).emit("stop-typing", {
            senderId: savedMessage.sender._id,
            receiverId: receiverId,
          });

          // clear timeout from typingTimeouts map if already has
          if (typingTimeouts.has(receiverId)) {
            clearTimeout(typingTimeouts.get(receiverId));
            typingTimeouts.delete(receiverId);
          }

          // emit to sender that message is sent successfully
          io.to(senderId).emit("message-sent", {
            success: true,
            message: savedMessage,
            chatId: chat._id,
          });

          // emit to receiver as early as possible
          io.to(receiverId).emit("receive-message", savedMessage);

          // non-critical updates run async so they don't block next message delivery
          Promise.allSettled([
            MessageModel.countDocuments({
              receiver: receiverId,
              status: { $ne: "read" },
            }).then((unreadCount) => {
              io.to(receiverId).emit("unread-count", { count: unreadCount, contactId: senderId });
            }),
            MessageModel.countDocuments({
              receiver: senderId,
              status: { $ne: "read" },
            }).then((senderUnreadCount) => {
              io.to(senderId).emit("unread-count", { count: senderUnreadCount, contactId: receiverId });
            }),
            ChatModel.findById(chat._id)
              .populate("participants", "username email profileImage")
              .populate("latestMessage")
              .lean()
              .then((chatData) => {
                if (!chatData) return;
                io.to(senderId).emit("chat-updated", chatData);
                io.to(receiverId).emit("chat-updated", chatData);
              }),
          ]).catch((err) => {
          });
        }
      } catch (error) {
      }
    }
  } finally {
    isProcessingQueue = false;

    // If new items arrived while processing was completing, run again.
    if (!queue.isEmpty()) {
      processQueue();
    }
  }
};

export const handleTyping = (io, { senderId, receiverId }) => {
  if (!senderId || !receiverId) return;

  io.to(receiverId).emit("typing", {
    senderId,
    receiverId,
  });

  // clear existing timeout
  if (typingTimeouts.has(receiverId)) {
    clearTimeout(typingTimeouts.get(receiverId));
  }

  const timeout = setTimeout(() => {
    io.to(receiverId).emit("stop-typing", {
      senderId,
      receiverId,
    });
    typingTimeouts.delete(receiverId);
  }, 3000);

  typingTimeouts.set(receiverId, timeout);
};

export const handleStopTyping = (io, { senderId, receiverId }) => {
  if (!senderId || !receiverId) return;

  // clear existing timeouts
  if (typingTimeouts.has(receiverId)) {
    clearTimeout(typingTimeouts.get(receiverId));
    typingTimeouts.delete(receiverId);
  }

  io.to(receiverId).emit("stop-typing", {
    senderId,
    receiverId,
  });
};

export const handleMarkRead = (
  io,
  { message, senderId, receiverId, status, messageId },
) => {
  const id = messageId || message?._id?.toString();
  if (!id) {
    return;
  }

  const sender =
    senderId || message?.sender?._id?.toString() || message?.sender?.toString();
  const receiver =
    receiverId ||
    message?.receiver?._id?.toString() ||
    message?.receiver?.toString();

  if (!sender || !receiver) {
    return;
  }

  const emitData = {
    messageId: id,
    senderId: sender,
    receiverId: receiver,
    status: status || "read",
    ...(message && { message }),
  };

  // sender updates read mark
  io.to(sender).emit("markMessage-read", emitData);

  // receiver updates unread mark if needed
  io.to(receiver).emit("markMessage-read", emitData);
};


export const cleanupTypingTimeouts = () => {
  for (const [key, timeout] of typingTimeouts) {
    clearTimeout(timeout);
  }
  typingTimeouts.clear();
};
