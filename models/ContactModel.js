import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["sent",
    "accepted",
    "blocked",
    "cancelled",
    "rejected"],
    default: 'pending'
  },
  customName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  isMuted: {
    type: Boolean,
    default: false
  },
  muteUntil: {
    type: Date,
    default: null
  },
  starredMessages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  lastInteraction: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    maxlength: 200
  }
}, { timestamps: true });

// Add unique constraint
contactSchema.index({ user: 1, contact: 1 }, { unique: true });
//Indexes for queries
contactSchema.index({ user: 1, isFavorite: 1 });
contactSchema.index({ user: 1, status: 1 });
contactSchema.index({ lastInteraction: -1 });

const ContactModel = mongoose.model('Contact', contactSchema);
export default ContactModel;