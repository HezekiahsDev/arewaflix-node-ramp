import express from "express";
import passport from "passport";
import { router as userRouter } from "../users/users.module.js";
import { router as videosRouter } from "../videos/videos.module.js";

const router = express.Router();

router.use("/users", userRouter);
router.use("/videos", videosRouter);

router.get(
  "/profile",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.json({
      message: "You made it to the secure route",
      user: req.user,
      token: req.query.secret_token,
    });
  }
);

export default router;
