import express from "express";
import {
  blockVideo,
  unblockVideo,
  getBlockedVideos,
} from "./video-block.controller.js";
import passport from "passport";
// No admin-only middleware: endpoints are available to any authenticated user

const router = express.Router();

// All video block endpoints require JWT authentication but are available to any authenticated user
// POST /api/v1/video-block/block/:videoId - Block a video (authenticated user)
router.post(
  "/block/:videoId",
  passport.authenticate("jwt", { session: false }),
  blockVideo
);

// DELETE /api/v1/video-block/block/:blockId - Unblock a video by block record ID (authenticated user)
router.delete(
  "/block/:blockId",
  passport.authenticate("jwt", { session: false }),
  unblockVideo
);

// GET /api/v1/video-block/blocked?blockType=manual&active=1 - Get blocked videos for authenticated user
router.get(
  "/blocked",
  passport.authenticate("jwt", { session: false }),
  getBlockedVideos
);

export default router;
