import mongoose from "mongoose";
import { DIRECTIONS, STOPS } from "../constants/routeConstants.js";

const stopTimeSchema = new mongoose.Schema(
  {
    stop: {
      type: String,
      required: true,
      enum: STOPS,
    },
    time: {
      type: String,
      required: true,
      match: /^\d{2}:\d{2}$/,
    },
  },
  { _id: false }
);

const scheduleTripSchema = new mongoose.Schema({
  direction: {
    type: String,
    enum: DIRECTIONS,
    required: true,
  },
  stopTimes: {
    type: [stopTimeSchema],
    required: true,
    default: [],
  },
});

const busSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  routeName: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  schedule: {
    type: [scheduleTripSchema],
    default: [],
  },
});

export default mongoose.model("buses", busSchema);