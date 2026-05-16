import mongoose from "mongoose";

const updateSchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "buses",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  currentStop: {
    type: String,
    required: true,
  },
  direction: {
    type: String,
    enum: ["TO_UNIVERSITY", "TO_VAVUNIYA"],
    required: true,
  },
  updateType: {
    type: String,
    enum: ["spotted", "onboard"],
    required: true,
  },
  crowdLevel: {
    type: String,
    enum: ["seats_available", "standing_only", "fully_crowded"],
    required: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 300,
    default: "",
  },
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    isTrue: {
      type: Boolean,
      required: true,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  deviceId: {
    type: String,
    required: true,
  },
  reportedBy: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Performance index: speeds up queries filtering by busId and sorting by timestamp
updateSchema.index({ busId: 1, timestamp: -1 });

export default mongoose.model("updates", updateSchema);
