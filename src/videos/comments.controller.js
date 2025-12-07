import {
  postComment,
  getCommentsForVideo,
  toggleCommentLike,
  getCommentReaction as getCommentReactionFromService,
  createCommentReport,
} from "./comments.service.js";
import { escapeHtml } from "../utils/escapeHtml.js";

const extractUserId = (req) => {
  const authUser = req?.user;
  if (!authUser) return null;
  const candidates = [authUser.id, authUser.user_id, authUser.ID];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

export const createComment = async (req, res, next) => {
  try {
    const userId = extractUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const videoId = Number(req.params.id);
    const text = req.body?.text;

    const created = await postComment({ userId, videoId, text });
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
};

export const fetchComments = async (req, res, next) => {
  try {
    const videoId = Number(req.params.id);
    const { page, limit } = req.query;
    const userId = extractUserId(req); // Get userId if authenticated
    const result = await getCommentsForVideo({ videoId, page, limit, userId });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const likeComment = async (req, res, next) => {
  try {
    const userId = extractUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const commentId = Number(req.params.commentId);
    if (!Number.isSafeInteger(commentId) || commentId <= 0) {
      return res
        .status(400)
        .json({ error: "'commentId' parameter must be a positive integer." });
    }

    const action = req?.body?.action;
    if (!action || !["like", "dislike", "remove"].includes(action)) {
      return res.status(400).json({
        error:
          "'action' is required and must be one of: 'like', 'dislike', 'remove'.",
      });
    }

    const videoId = Number(req.params.id) || 0;

    const result = await toggleCommentLike({
      userId,
      commentId,
      videoId,
      action,
    });
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const getCommentReaction = async (req, res, next) => {
  try {
    const userId = extractUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const commentId = Number(req.params.commentId);
    if (!Number.isSafeInteger(commentId) || commentId <= 0) {
      return res
        .status(400)
        .json({ error: "'commentId' parameter must be a positive integer." });
    }

    const reaction = await getCommentReactionFromService({ userId, commentId });
    res.status(200).json({ data: { reaction } });
  } catch (err) {
    next(err);
  }
};

export const reportComment = async (req, res, next) => {
  try {
    const userId = extractUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const commentId = Number(req.params.commentId);
    if (!Number.isSafeInteger(commentId) || commentId <= 0) {
      return res
        .status(400)
        .json({ error: "'commentId' parameter must be a positive integer." });
    }

    // Only allow a single `text` field in the body to avoid unexpected input
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Request body must be an object with an optional 'text' field.",
      });
    }
    const allowed = ["text"];
    const extra = Object.keys(req.body).filter((k) => !allowed.includes(k));
    if (extra.length > 0) {
      return res.status(400).json({
        error: "Only the 'text' field is allowed in the request body.",
      });
    }

    let text = "";
    if (typeof req.body.text === "string") {
      text = req.body.text.trim();
      if (text.length > 1000) {
        return res
          .status(400)
          .json({ error: "'text' must be at most 1000 characters." });
      }
      // Escape HTML to reduce XSS risk (stored content will be safe for HTML contexts)
      text = escapeHtml(text);
    }

    const created = await createCommentReport({ userId, commentId, text });
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
};

export default {
  createComment,
  fetchComments,
  likeComment,
  reportComment,
  getCommentReaction,
};
