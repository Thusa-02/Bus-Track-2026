import express from "express";
import {
  createUpdate,
  getUpdates,
  getLatestUpdate,
  updateUpdate,
  deleteUpdate,
} from "../controller/updateController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const route = express.Router();

route.post("/create", authMiddleware, createUpdate);          // Submit bus location
route.get("/getall/:busId", getUpdates);                      // Get movement history
route.get("/latest/:busId", getLatestUpdate);                 // Get smart latest update
route.put("/update/:id", authMiddleware, updateUpdate);       // Fix wrong stop or crowd level
route.delete("/delete/:id", authMiddleware, deleteUpdate);    // Remove spam report

export default route;