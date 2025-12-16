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
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    const videoId = req.params.videoId;
    if (!videoId || isNaN(videoId) || Number(videoId) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID.",
      });
    }

    let {
      blockType = "manual",
      reason = "",
      startAt = 0,
      endAt = 0,
    } = req.body;

    // Validate block type
    if (!VALID_BLOCK_TYPES.includes(blockType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid block type.",
      });
    }

    // Sanitize and validate reason
    reason = String(reason || "").trim();
    if (reason.length > MAX_REASON_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Reason too long.",
      });
    }
    reason = escapeHtml(reason);

    // Validate timestamps
    startAt = Number(startAt) || 0;
    endAt = Number(endAt) || 0;

    if (startAt < 0 || endAt < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid timestamp.",
      });
    }

    if (endAt > 0 && endAt <= startAt) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time.",
      });
    }

    const result = await videoBlockService.blockVideo({
      videoId: Number(videoId),
      blockedBy: adminId,
      blockType,
      reason,
      startAt,
      endAt,
    });

    console.log(
      `[ADMIN ACTION] User ${adminId} (${adminRole}) blocked video ${videoId} with type ${blockType}`
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
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    const blockId = req.params.blockId;
    if (!blockId || isNaN(blockId) || Number(blockId) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid block ID.",
      });
    }

    const result = await videoBlockService.unblockVideo(
      Number(blockId),
      adminId
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Block record not found." });
    }

    console.log(
      `[ADMIN ACTION] User ${adminId} (${adminRole}) unblocked video block ID ${blockId}`
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

    const blockedVideos = await videoBlockService.getBlockedVideos({
      blockType,
      active,
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
