import express from "express";
import { getAllUsers, register, getMe } from "./users.controller.js";
import { validateRegistration } from "../middlewares/requestValidator.js";
import passport from "passport";

const router = express.Router();

router.get("/me", passport.authenticate("jwt", { session: false }), getMe);
router.get("/", getAllUsers);
router.post("/", validateRegistration, register);

export default router;
