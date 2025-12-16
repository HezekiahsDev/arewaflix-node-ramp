import videoBlockService from "./video-block.service.js";
import { escapeHtml } from "../utils/escapeHtml.js";

// Valid block types
const VALID_BLOCK_TYPES = [
  "global",
  "user",
  "geo",
  "copyright",
  "age",
  "manual",
];
const MAX_REASON_LENGTH = 1000;

export const blockVideo = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const videoId = req.params.videoId;
    if (!videoId || isNaN(videoId) || Number(videoId) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID.",
      });
    }

    const body = req.body || {};

    // Ensure body is an object
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request body." });
    }

    // Only allow `reason` field in the POST body
    const allowedFields = ["reason"];
    const extraFields = Object.keys(body).filter(
      (k) => !allowedFields.includes(k)
    );
    if (extraFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Only the 'reason' field is allowed in the request body.",
      });
    }

    // Sanitize and validate reason (required, non-empty)
    let reason = String(body.reason || "").trim();
    if (!reason) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Reason is required and cannot be empty.",
        });
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return res
        .status(400)
        .json({ success: false, message: "Reason too long." });
    }
    reason = escapeHtml(reason);

    // Server-side defaults for fields we no longer accept from client
    const blockType = "manual";
    const startAt = 0;
    const endAt = 0;

    const result = await videoBlockService.blockVideo({
      videoId: Number(videoId),
      blockedBy: userId,
      blockType,
      reason,
      startAt,
      endAt,
    });

    console.log(
      `[USER ACTION] User ${userId} (${userRole}) blocked video ${videoId} with type ${blockType}`
    );

    return res
      .status(201)
      .json({ success: true, message: "Video blocked.", data: result });
  } catch (err) {
    console.error("Block video error:", err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "An error occurred.",
    });
  }
};

export const unblockVideo = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const blockId = req.params.blockId;
    if (!blockId || isNaN(blockId) || Number(blockId) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid block ID.",
      });
    }

    const result = await videoBlockService.unblockVideo(
      Number(blockId),
      userId
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Block record not found." });
    }

    console.log(
      `[USER ACTION] User ${userId} (${userRole}) unblocked video block ID ${blockId}`
    );

    return res.json({ success: true, message: "Video unblocked." });
  } catch (err) {
    console.error("Unblock video error:", err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "An error occurred.",
    });
  }
};

export const getBlockedVideos = async (req, res, next) => {
  try {
    let { blockType, active } = req.query;

    // Validate blockType if provided
    if (blockType && !VALID_BLOCK_TYPES.includes(blockType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid block type.",
      });
    }

    // Validate active if provided
    if (active !== undefined) {
      active = Number(active);
      if (![0, 1].includes(active)) {
        return res.status(400).json({
          success: false,
          message: "Invalid active value.",
        });
      }
    }

    // Return blocked videos scoped to the authenticated user
    const blockedVideos = await videoBlockService.getBlockedVideos({
      blockType,
      active,
      blockedBy: req.user?.id,
    });
    return res.json({ success: true, data: blockedVideos });
  } catch (err) {
    console.error("Get blocked videos error:", err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "An error occurred.",
    });
  }
};
