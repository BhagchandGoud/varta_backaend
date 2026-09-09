import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Encrypted text or plain text
    content: {
      type: String,
      default: "",
    },

    // Message Type
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "document", "pdf", "file"],
      default: "text",
    },

    // Message Status
    status: {
      type: String,
      enum: ["sending", "sent", "delivered", "read"],
      default: "sent",
    },

    // Encryption
    iv: {
      type: String,
      default: null,
    },

    authTag: {
      type: String,
      default: null,
    },

    // Reply Message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Forwarded Message
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Media Information
    fileDetails: {
      fileName: {
        type: String,
        default: null,
      },

      fileSize: {
        type: Number,
        default: null,
      },

      mimeType: {
        type: String,
        default: null,
      },

      url: {
        type: String,
        default: null,
      },

      publicId: {
        type: String,
        default: null,
      },

      resourceType: {
        type: String,
        enum: ["image", "video", "raw"],
        default: null,
      },
    },

    // Media Metadata
    metadata: {
      width: {
        type: Number,
        default: null,
      },

      height: {
        type: Number,
        default: null,
      },

      duration: {
        type: Number,
        default: null,
      },

      thumbnail: {
        type: String,
        default: null,
      },
    },

    // Read Receipts
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Reactions
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        emoji: {
          type: String,
          enum: ["❤️", "😂", "😊", "😮", "😢", "😡", "👍", "👎", "🔥", "💯"],
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Edit/Delete
    isEdited: {
      type: Boolean,
      default: false,
    },

    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },

    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Queue Retry Count
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({
  chat: 1,
  createdAt: -1,
});
const MessageModel =
  mongoose.models.Message || mongoose.model("Message", messageSchema);

export default MessageModel;
