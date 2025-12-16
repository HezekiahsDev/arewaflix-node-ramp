import express from "express";
import passport from "passport";
import { router as userRouter } from "../users/users.module.js";
import { router as videosRouter } from "../videos/videos.module.js";
import { router as userBlockRouter } from "../user-block/user-block.module.js";
import { router as videoBlockRouter } from "../video-block/video-block.module.js";

const router = express.Router();

router.use("/users", userRouter);
router.use("/videos", videosRouter);
router.use("/user-block", userBlockRouter);
router.use("/video-block", videoBlockRouter);

router.get(
  "/profile",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.json({
      message: "You made it to the secure route",
      user: req.user,
      // Do not echo client-supplied secret tokens back in responses
      token_present: Boolean(req.query && req.query.secret_token),
    });
  }
);

export default router;
