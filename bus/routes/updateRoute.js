import express from "express";
import {
  createUpdate,
  getUpdates,
  getLatestUpdate,
  reviewUpdate,
  getLeaderboard,
  updateUpdate,
  deleteUpdate,
} from "../controller/updateController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const route = express.Router();

route.post("/create", authMiddleware, createUpdate);          // Submit bus location
route.get("/leaderboard", getLeaderboard);                    // Reporter trust leaderboard
route.get("/getall/:busId", getUpdates);                      // Get movement history
route.get("/latest/:busId", getLatestUpdate);                 // Get smart latest update
route.post("/:id/review", authMiddleware, reviewUpdate);      // Verify report true/false
route.put("/update/:id", authMiddleware, updateUpdate);       // Fix wrong stop or crowd level
route.delete("/delete/:id", authMiddleware, deleteUpdate);    // Remove spam report

export default route;
