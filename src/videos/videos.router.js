import express from "express";
import passport from "passport";
import {
  getAllVideos,
  getFilteredVideos,
  getShortsVideos,
  createVideo,
  createShort,
  createView,
  likeVideo,
  getVideoReactions,
  getUserReaction,
  searchVideosController,
  getRandomVideosController,
} from "./videos.controller.js";
import commentsRouter from "./comments.router.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false });

// POST /api/v1/videos (no auth required for manual testing)
router.post("/", createVideo);

// GET /api/v1/videos?limit=20&page=1
router.get("/", getAllVideos);

// GET /api/v1/videos/filter?sort=most_viewed|popular|top_rated|latest|oldest&limit=20&page=1
router.get("/filter", getFilteredVideos);

// GET /api/v1/videos/search?q=query&limit=20&page=1
router.get("/search", searchVideosController);

// GET /api/v1/videos/random?count=5
router.get("/random", getRandomVideosController);

// POST /api/v1/videos/shorts
router.post("/shorts", requireAuth, createShort);

// GET /api/v1/videos/shorts?sort=latest&limit=20&page=1
router.get("/shorts", getShortsVideos);

// POST /api/v1/videos/views
router.post("/views", createView);

// POST /api/v1/videos/reaction
router.post("/reactions", requireAuth, likeVideo);

// GET /api/v1/videos/:id/reactions
router.get("/:id/reactions", getVideoReactions);

// GET /api/v1/videos/:id/reaction (checks current user's reaction)
router.get("/:id/reaction", requireAuth, getUserReaction);

// Mount comments router
router.use("/:id/comments", commentsRouter);

export default router;
