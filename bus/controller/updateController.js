import Update from "../model/updateModel.js";
import Bus from "../model/busModel.js";
import mongoose from "mongoose";
import { STOPS, DIRECTIONS } from "../constants/routeConstants.js";

const AVG_MINUTES_PER_STOP = 5;
const STALE_MINUTES = 15;
const DUPLICATE_MINUTES = 2;

const UPDATE_TYPES = ["spotted", "onboard"];
const CROWD_LEVELS = ["seats_available", "standing_only", "fully_crowded"];

// ─── HELPERS ─────────────────────────

const normalizeStop = (input) => {
  if (!input) return null;
  return STOPS.find(
    (s) => s.toLowerCase() === input.trim().toLowerCase()
  );
};

const getNextStop = (currentStop, direction) => {
  const i = STOPS.indexOf(currentStop);
  if (i === -1) return null;

  if (direction === "TO_UNIVERSITY") {
    return i === STOPS.length - 1 ? null : STOPS[i + 1];
  }

  if (direction === "TO_VAVUNIYA") {
    return i === 0 ? null : STOPS[i - 1];
  }

  return null;
};

const isStale = (timestamp) => {
  return (Date.now() - new Date(timestamp)) / 60000 > STALE_MINUTES;
};

const getETA = (timestamp, currentStop, direction) => {
  const nextStop = getNextStop(currentStop, direction);

  if (!nextStop) {
    return { message: "Bus reached final stop." };
  }

  const elapsed = (Date.now() - new Date(timestamp)) / 60000;
  const remaining = Math.round(AVG_MINUTES_PER_STOP - elapsed);

  return {
    message:
      remaining <= 0
        ? `Bus should have reached ${nextStop}`
        : `Bus will reach ${nextStop} in ~${remaining} min`,
  };
};

const getReliabilityScore = (updates, stop) => {
  const filtered = updates.filter((u) => u.currentStop === stop);
  const unique = new Set(filtered.map((u) => String(u.userId))).size;

  let label = "Low";
  if (unique >= 3) label = "High";
  else if (unique === 2) label = "Medium";

  return {
    score: Math.min(unique, 3),
    label,
  };
};

const crowdEmoji = {
  seats_available: "🟢 Seats available",
  standing_only: "🟡 Standing only",
  fully_crowded: "🔴 Fully crowded",
};

// ─── CREATE UPDATE ───────────────────
export const createUpdate = async (req, res) => {
  try {
    const {
      busId,
      currentStop,
      direction,
      updateType,
      crowdLevel,
      deviceId,
    } = req.body;

    if (
      !busId ||
      !currentStop ||
      !direction ||
      !updateType ||
      !crowdLevel ||
      !deviceId
    ) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({ message: "Invalid bus ID" });
    }

    if (!DIRECTIONS.includes(direction)) {
      return res.status(400).json({ message: "Invalid direction" });
    }

    if (!UPDATE_TYPES.includes(updateType)) {
      return res.status(400).json({ message: "Invalid update type" });
    }

    if (!CROWD_LEVELS.includes(crowdLevel)) {
      return res.status(400).json({ message: "Invalid crowd level" });
    }

    const stop = normalizeStop(currentStop);
    if (!stop) {
      return res.status(400).json({ message: "Invalid stop name" });
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    const recent = await Update.findOne({
      busId,
      deviceId,
      direction,
      timestamp: {
        $gte: new Date(Date.now() - DUPLICATE_MINUTES * 60000),
      },
    });

    if (recent) {
      return res.status(429).json({ message: "Wait before submitting again" });
    }

    const update = new Update({
      busId,
      currentStop: stop,
      direction,
      updateType,
      crowdLevel,
      deviceId,
      userId: req.user._id,
      reportedBy: req.user.name,
    });

    const saved = await update.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET ALL UPDATES ─────────────────
export const getUpdates = async (req, res) => {
  try {
    const { busId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({ message: "Invalid bus ID" });
    }

    const updates = await Update.find({ busId }).sort({ timestamp: -1 });

    res.json(updates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET LATEST ──────────────────────
export const getLatestUpdate = async (req, res) => {
  try {
    const { busId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({ message: "Invalid bus ID" });
    }

    const latest = await Update.findOne({ busId }).sort({ timestamp: -1 });

    if (!latest) {
      return res.status(404).json({ message: "No updates" });
    }

    const recent = await Update.find({
      busId,
      timestamp: {
        $gte: new Date(Date.now() - STALE_MINUTES * 60000),
      },
    });

    const stale = isStale(latest.timestamp);

    res.json({
    currentStop: latest.currentStop,
    direction: latest.direction,
    updateType: latest.updateType,   // ✅ Add this line
    dataStatus: stale ? "stale" : "live",
    crowdLevel: stale ? "Unknown" : crowdEmoji[latest.crowdLevel],
    eta: stale
    ? { message: "ETA unavailable" }
    : getETA(latest.timestamp, latest.currentStop, latest.direction),
    reliability: stale
    ? { score: 0, label: "Stale" }
    : getReliabilityScore(recent, latest.currentStop),
    lastReportedAt: latest.timestamp,
  });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ─── UPDATE UPDATE ───────────────────
export const updateUpdate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid update ID" });
    }

    const existing = await Update.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Update not found" });
    }

    // Ownership check — only the author or an admin may edit
    const isOwner = existing.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorised to edit this update" });
    }

    const { currentStop, direction, updateType, crowdLevel } = req.body;
    const allowedUpdates = {};

    if (currentStop !== undefined) {
      const stop = normalizeStop(currentStop);
      if (!stop) return res.status(400).json({ message: "Invalid stop name" });
      allowedUpdates.currentStop = stop;
    }
    if (direction !== undefined) {
      if (!DIRECTIONS.includes(direction)) {
        return res.status(400).json({ message: "Invalid direction" });
      }
      allowedUpdates.direction = direction;
    }
    if (updateType !== undefined) {
      if (!UPDATE_TYPES.includes(updateType)) {
        return res.status(400).json({ message: "Invalid update type" });
      }
      allowedUpdates.updateType = updateType;
    }
    if (crowdLevel !== undefined) {
      if (!CROWD_LEVELS.includes(crowdLevel)) {
        return res.status(400).json({ message: "Invalid crowd level" });
      }
      allowedUpdates.crowdLevel = crowdLevel;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    const updated = await Update.findByIdAndUpdate(id, allowedUpdates, {
      new: true,
      runValidators: true,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE UPDATE ───────────────────
export const deleteUpdate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid update ID" });
    }

    const existing = await Update.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Update not found" });
    }

    // Ownership check — only the author or an admin may delete
    const isOwner = existing.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorised to delete this update" });
    }

    await Update.findByIdAndDelete(id);
    res.json({ message: "Update deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
