import express from "express";
import {
  getAllUsers,
  register,
  getMe,
  deleteMe,
  changePassword,
  getMyNotifications,
} from "./users.controller.js";
import { validateRegistration } from "../middlewares/requestValidator.js";
import passport from "passport";

const router = express.Router();

router.post("/", validateRegistration, register);
// router.get("/", getAllUsers);
router.get("/me", passport.authenticate("jwt", { session: false }), getMe);
router.delete(
  "/me",
  passport.authenticate("jwt", { session: false }),
  deleteMe
);
router.patch(
  "/me/password",
  passport.authenticate("jwt", { session: false }),
  changePassword
);
// Get authenticated user's notifications
router.get(
  "/me/notifications",
  passport.authenticate("jwt", { session: false }),
  getMyNotifications
);

export default router;
