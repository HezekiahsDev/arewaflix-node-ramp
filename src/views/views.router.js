import express from "express";
import { createView } from "./views.controller.js";

const router = express.Router();

// POST /api/v1/views
router.post("/", createView);

export default router;
