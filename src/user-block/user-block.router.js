import express from "express";
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
} from "./user-block.controller.js";
import passport from "passport";
import { validateUserId } from "../middlewares/requestValidator.js";

const router = express.Router();

router.post(
  "/block/:userId",
  passport.authenticate("jwt", { session: false }),
  validateUserId,
  blockUser
);
router.delete(
  "/block/:userId",
  passport.authenticate("jwt", { session: false }),
  validateUserId,
  unblockUser
);
router.get(
  "/blocked",
  passport.authenticate("jwt", { session: false }),
  getBlockedUsers
);

export default router;
