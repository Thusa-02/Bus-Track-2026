// adminController.js
// Handles:
//   GET  /api/admin/users          — all users enriched with report stats
//   PUT  /api/admin/users/:id/block — block or unblock a user
//
// Mount in adminRoute.js with authMiddleware + adminOnly middleware.

import User from "../model/userModel.js";
import Update from "../model/updateModel.js";
import mongoose from "mongoose";

// ── GET /api/admin/users ──────────────────────────────────────────────────────
// Returns every user (non-admin and admin) with their aggregated report stats.
export const getAdminUsers = async (req, res) => {
  try {
    // 1. Pull all users
    const users = await User.find({}, "_id name email role blocked").lean();

    // 2. Aggregate report + review counts grouped by userId
    const stats = await Update.aggregate([
      {
        $group: {
          _id: "$userId",
          reports: { $sum: 1 },
          // Count reviews where isTrue === true across all reports
          trueReviews: {
            $sum: {
              $size: {
                $filter: {
                  input: { $ifNull: ["$reviews", []] },
                  as: "r",
                  cond: { $eq: ["$$r.isTrue", true] },
                },
              },
            },
          },
          // Count reviews where isTrue === false
          falseReviews: {
            $sum: {
              $size: {
                $filter: {
                  input: { $ifNull: ["$reviews", []] },
                  as: "r",
                  cond: { $eq: ["$$r.isTrue", false] },
                },
              },
            },
          },
        },
      },
    ]);

    // 3. Index stats by userId string for O(1) lookup
    const statsMap = new Map();
    stats.forEach((s) => {
      statsMap.set(String(s._id), {
        reports: s.reports,
        trueReviews: s.trueReviews,
        falseReviews: s.falseReviews,
        score: s.trueReviews - s.falseReviews,
      });
    });

    // 4. Merge
    const result = users.map((u) => {
      const s = statsMap.get(String(u._id)) ?? {
        reports: 0,
        trueReviews: 0,
        falseReviews: 0,
        score: 0,
      };
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        blocked: u.blocked ?? false,
        ...s,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /api/admin/users/:id/block ────────────────────────────────────────────
// Body: { blocked: true | false }
// Admin cannot block themselves or another admin.
export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (typeof blocked !== "boolean") {
      return res.status(400).json({ message: "'blocked' must be a boolean" });
    }

    if (String(id) === String(req.user._id)) {
      return res.status(403).json({ message: "You cannot block yourself" });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (target.role === "admin") {
      return res.status(403).json({ message: "Admin accounts cannot be blocked" });
    }

    target.blocked = blocked;
    await target.save();

    res.json({
      message: blocked ? "User blocked successfully" : "User unblocked successfully",
      userId: id,
      blocked,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
