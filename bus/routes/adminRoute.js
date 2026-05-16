import express from "express";
import { getAdminUsers, blockUser } from "../controller/adminController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only admins can access these routes
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// GET  /api/admin/users
router.get("/users", authMiddleware, adminOnly, getAdminUsers);

// PUT  /api/admin/users/:id/block
router.put("/users/:id/block", authMiddleware, adminOnly, blockUser);

export default router;