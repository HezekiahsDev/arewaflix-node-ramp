import express from "express";
import passport from "passport";
import { createComment, fetchComments } from "./comments.controller.js";

const router = express.Router({ mergeParams: true });
const requireAuth = passport.authenticate("jwt", { session: false });

// POST /api/v1/videos/:id/comments
router.post("/", requireAuth, createComment);

// GET /api/v1/videos/:id/comments
router.get("/", fetchComments);

export default router;
