import express from "express";
import passport from "passport";
import {
  createComment,
  fetchComments,
  likeComment,
  reportComment,
  getCommentReaction,
} from "./comments.controller.js";

const router = express.Router({ mergeParams: true });
const requireAuth = passport.authenticate("jwt", { session: false });

// POST /api/v1/videos/:id/comments
router.post("/", requireAuth, createComment);

// GET /api/v1/videos/:id/comments
router.get("/", requireAuth, fetchComments);

// POST /api/v1/videos/:id/comments/:commentId/reactions
router.post("/:commentId/reactions", requireAuth, likeComment);

// GET /api/v1/videos/:id/comments/:commentId/reaction
router.get("/:commentId/reaction", requireAuth, getCommentReaction);

// POST /api/v1/videos/:id/comments/:commentId/report
router.post("/:commentId/report", requireAuth, reportComment);

export default router;
