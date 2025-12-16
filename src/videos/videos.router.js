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
  reportVideo,
  blockVideo,
  saveVideo,
  getSavedStatus,
  getSavedVideos,
  removeSaved,
  searchVideosController,
  getRandomVideosController,
} from "./videos.controller.js";
import commentsRouter from "./comments.router.js";

const router = express.Router();

const requireAuth = passport.authenticate("jwt", { session: false });

// POST /api/v1/videos (no auth required for manual testing)
// router.post("/", createVideo);

// GET /api/v1/videos?limit=20&page=1
router.get("/", getAllVideos);

// GET /api/v1/videos/filter?sort=most_viewed|popular|top_rated|latest|oldest&limit=20&page=1
router.get("/filter", getFilteredVideos);

// GET /api/v1/videos/search?q=query&limit=20&page=1
router.get("/search", searchVideosController);

// GET /api/v1/videos/random?page=1&limit=20
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

// POST /api/v1/videos/:id/report (report a video)
router.post("/:id/report", requireAuth, reportVideo);

// POST /api/v1/videos/:videoID/block (block a video for the current user)
router.post("/:videoID/block", requireAuth, blockVideo);

// POST /api/v1/videos/:id/save (save a video)
router.post("/:id/save", requireAuth, saveVideo);

// GET /api/v1/videos/:id/save (check if current user saved this video)
router.get("/:id/save", requireAuth, getSavedStatus);

// GET /api/v1/videos/saved (list saved videos for current user)
router.get("/saved", requireAuth, getSavedVideos);

// DELETE /api/v1/videos/:id/save (remove saved video)
router.delete("/:id/save", requireAuth, removeSaved);

// Mount comments router
router.use("/:id/comments", commentsRouter);

export default router;
