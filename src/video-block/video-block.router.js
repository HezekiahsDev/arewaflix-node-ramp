import express from "express";
import {
  blockVideo,
  unblockVideo,
  getBlockedVideos,
} from "./video-block.controller.js";
import passport from "passport";
import { requireAdminOrModerator } from "../middlewares/adminAuth.js";

const router = express.Router();

// All video block endpoints require JWT authentication and admin/moderator role

// POST /api/v1/video-block/block/:videoId - Block a video (admin only)
router.post(
  "/block/:videoId",
  passport.authenticate("jwt", { session: false }),
  requireAdminOrModerator,
  blockVideo
);

// DELETE /api/v1/video-block/block/:blockId - Unblock a video by block record ID (admin only)
router.delete(
  "/block/:blockId",
  passport.authenticate("jwt", { session: false }),
  requireAdminOrModerator,
  unblockVideo
);

// GET /api/v1/video-block/blocked?blockType=manual&active=1 - Get all blocked videos (admin only)
router.get(
  "/blocked",
  passport.authenticate("jwt", { session: false }),
  requireAdminOrModerator,
  getBlockedVideos
);

export default router;
