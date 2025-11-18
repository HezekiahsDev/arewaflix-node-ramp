import usersService from "./users.service.js";
import { sanitizeNotificationsList } from "../utils/notificationSanitizer.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import {
  sanitizeUserForClient,
  sanitizeUsersList,
} from "../utils/userSanitizer.js";
import { escapeHtml } from "../utils/escapeHtml.js";

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await usersService.findAll();
    return res.json({ data: sanitizeUsersList(users) });
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
    return res.json({ success: true, data: sanitizeUserForClient(user) });
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
        user: sanitizeUserForClient(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMe = async (req, res, next) => {
  try {
    const { confirmation, reason } = req.body || {};

    // Require an explicit confirmation string to avoid accidental deletions
    if (
      typeof confirmation !== "string" ||
      confirmation.trim() !== "delete my account"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid confirmation string. To delete your account, provide confirmation: 'delete my account'",
      });
    }

    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Validate the optional `reason` field before archiving.
    let validatedReason = null;
    if (reason !== undefined && reason !== null) {
      if (typeof reason !== "string") {
        return res.status(400).json({
          success: false,
          message: "deletion reason must be a string",
        });
      }

      const trimmed = reason.trim();
      // Treat empty string as not provided
      if (trimmed.length > 0) {
        if (trimmed.length < 3) {
          return res.status(400).json({
            success: false,
            message: "deletion reason must be at least 3 characters",
          });
        }
        if (trimmed.length > 255) {
          return res.status(400).json({
            success: false,
            message: "deletion reason must be at most 255 characters",
          });
        }

        // Escape HTML to avoid storing raw markup and reduce XSS risk
        validatedReason = escapeHtml(trimmed);
      }
    }

    // Archive user into `deleted_accounts` and cleanup related rows.
    const result = await usersService.deleteAndArchiveById(
      userId,
      "user",
      validatedReason,
      req.ip || null,
      req.get("User-Agent") || null
    );

    if (result && result.notFound) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // If mysql2 result is returned, check affectedRows
    const affected = result && (result.affectedRows ?? null);
    if (affected === 0) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to delete account" });
    }

    return res.json({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    return next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body || {};

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Both oldPassword and newPassword are required",
      });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "newPassword must be a string with at least 6 characters",
      });
    }

    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await usersService.changePassword(
      userId,
      oldPassword,
      newPassword
    );

    if (result && result.notFound) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (result && result.incorrectOldPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Old password is incorrect" });
    }

    const affected = result && (result.affectedRows ?? null);
    if (affected === 0) {
      // No rows affected (shouldn't normally happen if user exists)
      return res
        .status(500)
        .json({ success: false, message: "Failed to update password" });
    }

    return res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    return next(err);
  }
};

export const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const notifications = await usersService.getNotificationsForUser(userId);
    const safe = sanitizeNotificationsList(notifications);
    return res.json({ success: true, data: safe });
  } catch (err) {
    return next(err);
  }
};

export const markMyNotificationsSeen = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { seen_time, video_ids } = req.body || {};

    if (!Array.isArray(video_ids)) {
      return res.status(400).json({
        success: false,
        message: "video_ids must be an array of numeric video ids",
      });
    }

    const seenTime = seen_time
      ? Number(seen_time)
      : Math.floor(Date.now() / 1000);
    if (!Number.isFinite(seenTime)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "seen_time must be a valid unix timestamp",
        });
    }

    const result = await usersService.markNotificationsSeenByVideoIds(
      userId,
      video_ids,
      seenTime
    );

    return res.json({
      success: true,
      data: { affectedRows: result.affectedRows ?? 0 },
    });
  } catch (err) {
    return next(err);
  }
};
