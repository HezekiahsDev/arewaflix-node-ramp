import express from "express";
import { getAllUsers, register } from "./users.controller.js";
import { validateRegistration } from "../middlewares/requestValidator.js";

const router = express.Router();

router.get("/", getAllUsers);
router.post("/", validateRegistration, register);

export default router;
