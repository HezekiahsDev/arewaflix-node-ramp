import express from "express";
import { getAllVideos } from "./videos.controller.js";

const router = express.Router();

// GET /api/v1/videos?limit=20&page=1
router.get("/", getAllVideos);

export default router;
