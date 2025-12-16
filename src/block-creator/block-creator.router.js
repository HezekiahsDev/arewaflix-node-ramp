import express from "express";
import {
  blockCreator,
  unblockCreator,
  getBlockedCreators,
} from "./block-creator.controller.js";
import passport from "passport";

const router = express.Router();

// POST /api/v1/block-creator/block/:creatorId - Block a creator (authenticated user)
router.post(
  "/block/:creatorId",
  passport.authenticate("jwt", { session: false }),
  blockCreator
);

// DELETE /api/v1/block-creator/block/:blockId - Unblock a creator by block record ID (authenticated user)
router.delete(
  "/block/:blockId",
  passport.authenticate("jwt", { session: false }),
  unblockCreator
);

// GET /api/v1/block-creator/blocked?active=1 - Get blocked creators for authenticated user
router.get(
  "/blocked",
  passport.authenticate("jwt", { session: false }),
  getBlockedCreators
);

export default router;
