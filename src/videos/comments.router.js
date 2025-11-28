import express from "express";
import passport from "passport";
import {
  createComment,
  fetchComments,
  likeComment,
  reportComment,
} from "./comments.controller.js";

const router = express.Router({ mergeParams: true });
const requireAuth = passport.authenticate("jwt", { session: false });

// POST /api/v1/videos/:id/comments
router.post("/", requireAuth, createComment);

// GET /api/v1/videos/:id/comments
router.get("/", fetchComments);

// POST /api/v1/videos/:id/comments/:commentId/reactions
router.post("/:commentId/reactions", requireAuth, likeComment);

// POST /api/v1/videos/:id/comments/:commentId/report
router.post("/:commentId/report", requireAuth, reportComment);

export default router;
