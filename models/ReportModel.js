import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  message: { type: mongoose.Schema.Types.ObjectId, ref: "Message", required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, enum: ["open", "reviewed", "dismissed"], default: "open" },
}, { timestamps: true });

reportSchema.index({ message: 1, reporter: 1 }, { unique: true });
export default mongoose.models.Report || mongoose.model("Report", reportSchema);
