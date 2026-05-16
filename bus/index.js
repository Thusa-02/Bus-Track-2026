import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from "express-rate-limit";

import busRoute from "./routes/busRoute.js";
import updateRoute from "./routes/updateRoute.js";
import authRoute from "./routes/authRoute.js";
import adminRoute from "./routes/adminRoute.js";

// Warn if running in production with a local DB URL
if (
  process.env.NODE_ENV === "production" &&
  process.env.MONGO_URL?.includes("127.0.0.1")
) {
  console.warn(" WARNING: MONGO_URL points to localhost in production. Did you forget to set it?");
}

const app = express();

// Restrict CORS to your frontend origin.
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
}));

app.use(express.json());

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
// Tight limit on auth routes to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// General limiter for bus/admin routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Higher limit for update/polling routes
// Live page polls every 30s x number of buses, so 200 is too low
const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoute);
app.use("/api/bus", apiLimiter, busRoute);
app.use("/api/update", updateLimiter, updateRoute); // FIX: was hitting 200 req limit
app.use("/api/admin", adminRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// ─── DATABASE ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGOURL = process.env.MONGO_URL;

mongoose.connect(MONGOURL)
  .then(() => {
    console.log("Database connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.log("DB connection error:", err));

mongoose.connection.on("error", err => {
  console.error("Mongo runtime error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected. Attempting to reconnect...");
});