import express from "express";
import authController from "./auth.controller.js";

const router = express.Router();

router.post("/login", authController.login);

// Forgot password flows
router.post("/forgot-password/request", authController.requestPasswordReset);
router.post("/forgot-password/verify", authController.verifyPasswordOtp);

export default router;
