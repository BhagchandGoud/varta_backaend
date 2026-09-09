import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    encryption: {
      type: Boolean,
      default: true,
    },

    chatName: {
      type: String,
      trim: true,
      default: null,
    },

    isGroupChat: {
      type: Boolean,
      default: false,
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    typingUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    mutedUsers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        mutedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    ciphertext: {
      type: String,
      default: null,
    },
    iv: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// ✅ Indexes for performance
chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index({ isGroupChat: 1 });

const ChatModel = mongoose.model("Chat", chatSchema);
export default ChatModel;
