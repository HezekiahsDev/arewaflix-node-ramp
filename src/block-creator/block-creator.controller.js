import blockCreatorService from "./block-creator.service.js";
import { escapeHtml } from "../utils/escapeHtml.js";

const MAX_REASON_LENGTH = 1000;

export const blockCreator = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const creatorId = req.params.creatorId;

    if (!creatorId || isNaN(creatorId) || Number(creatorId) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid creator ID." });
    }

    if (userId == creatorId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request." });
    }

    const body = req.body || {};
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request body." });
    }

    const allowedFields = ["reason"];
    const extraFields = Object.keys(body).filter(
      (k) => !allowedFields.includes(k)
    );
    if (extraFields.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Only the 'reason' field is allowed in the request body.",
        });
    }

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

    const result = await blockCreatorService.blockCreator({
      creatorId: Number(creatorId),
      blockedBy: userId,
      reason,
    });

    return res
      .status(201)
      .json({ success: true, message: "Creator blocked.", data: result });
  } catch (err) {
    console.error("Block creator error:", err.message);
    return res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message || "An error occurred." });
  }
};

export const unblockCreator = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const blockId = req.params.blockId;
    if (!blockId || isNaN(blockId) || Number(blockId) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid block ID." });
    }

    const result = await blockCreatorService.unblockCreator(
      Number(blockId),
      userId
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Block record not found." });
    }

    return res.json({ success: true, message: "Creator unblocked." });
  } catch (err) {
    console.error("Unblock creator error:", err.message);
    return res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message || "An error occurred." });
  }
};

export const getBlockedCreators = async (req, res, next) => {
  try {
    let { active, limit, offset } = req.query;
    if (active !== undefined) {
      active = Number(active);
      if (![0, 1].includes(active)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid active value." });
      }
    }

    limit = limit ? Number(limit) : 100;
    offset = offset ? Number(offset) : 0;

    const rows = await blockCreatorService.getBlockedCreators({
      blockedBy: req.user?.id,
      active,
      limit,
      offset,
    });

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Get blocked creators error:", err.message);
    return res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message || "An error occurred." });
  }
};
