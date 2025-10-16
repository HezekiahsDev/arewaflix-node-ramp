import usersService from "./users.service.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await usersService.findAll();
    return res.json({
      data: users,
    });
  } catch (err) {
    // Forward error to error handler middleware
    return next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    // req.user is populated by passport
    const user = await usersService.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    return next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const user = await usersService.register(req.body);

    // Auto-login: issue JWT token on successful registration
    const payload = { id: user.id, username: user.username };
    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.status(201).json({
      success: true,
      message: "User logged in successfully",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};
