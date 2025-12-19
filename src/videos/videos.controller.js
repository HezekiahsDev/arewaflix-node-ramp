import {
  findPaginated,
  createVideo as createVideoRecord,
  createShort as createShortRecord,
  recordView,
  toggleLike,
  getLikeCount,
  getUserReaction as getUserReactionFromService,
  searchVideos,
  getRandomVideos,
  createVideoReport,
  createSavedVideo,
  getSavedVideosForUser,
  removeSavedVideo,
  isVideoSaved,
  createBlockedVideo,
} from "./videos.service.js";
import { escapeHtml } from "../utils/escapeHtml.js";

// Note: getAllVideos now returns all columns from the `videos` table.
// Response shape: { data: Array<VideoRow>, pagination: { page, limit, total, totalPages } }

const SOURCE_FIELDS = [
  "video_location",
  "youtube",
  "vimeo",
  "daily",
  "facebook",
  "instagram",
  "ok",
  "twitch",
  "trailer",
];

const OPTIONAL_STRING_FIELDS = [
  "description",
  "thumbnail",
  "video_location",
  "youtube",
  "vimeo",
  "daily",
  "facebook",
  "instagram",
  "ok",
  "twitch",
  "twitch_type",
  "tags",
  "type",
  "quality",
  "rating",
  "country",
  "license",
  "duration",
  "live_chating",
  "demo",
  "gif",
  "trailer",
  "registered",
];

const OPTIONAL_NUMERIC_FIELDS = [
  "category_id",
  "privacy",
  "age_restriction",
  "approved",
  "featured",
  "monetization",
  "rent_price",
  "is_movie",
  "featured_movie",
];

const OPTIONAL_TEMPORAL_FIELDS = ["publication_date", "time"];

const hasSourceField = (body = {}) =>
  SOURCE_FIELDS.some((field) => {
    const value = body[field];
    return (
      value !== undefined && value !== null && String(value).trim().length > 0
    );
  });

const assignOptionalStrings = (body = {}, target = {}) => {
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      const value = body[field];
      if (value !== undefined && value !== null) {
        target[field] = typeof value === "string" ? value : String(value);
      }
    }
  }
};

const parseOptionalNumberField = (body, field) => {
  const value = body[field];
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: undefined };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return {
      ok: false,
      message: `'${field}' must be a valid number.`,
    };
  }
  return { ok: true, value: parsed };
};

const assignOptionalNumbers = (body = {}, target = {}, fields = []) => {
  for (const field of fields) {
    const result = parseOptionalNumberField(body, field);
    if (!result.ok) return result.message;
    if (result.value !== undefined) {
      target[field] = result.value;
    }
  }
  return null;
};

const parseVideoId = (value) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const sanitizeFingerprint = (value) => {
  if (value === undefined || value === null) return undefined;
  const stringValue = String(value).trim();
  if (!stringValue) return undefined;
  return stringValue;
};

const parseOptionalUserId = (value) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const getAuthenticatedUserId = (req) => {
  const authUser = req.user;
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

const buildCreatePayload = (req, res, { isShort, userId }) => {
  const body = req.body ?? {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    res.status(400).json({ error: "'title' is required." });
    return null;
  }

  // Allow anonymous uploads for testing: userId may be 0 (anonymous)
  if (!Number.isInteger(userId) || userId < 0) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }

  if (!hasSourceField(body)) {
    res.status(400).json({
      error:
        "Provide at least one video source (video_location, youtube, vimeo, daily, facebook, instagram, ok, twitch, or trailer).",
    });
    return null;
  }

  const payload = { user_id: userId, title };

  assignOptionalStrings(body, payload);

  // Validate lengths for common string fields (defensive limits)
  // DB `videos.title` is `varchar(100)` so enforce 100 chars here to avoid
  // silent truncation or DB errors when strict mode is enabled.
  if (payload.title && String(payload.title).length > 100) {
    res.status(400).json({ error: "'title' must be at most 100 characters." });
    return null;
  }
  if (payload.description && String(payload.description).length > 5000) {
    res
      .status(400)
      .json({ error: "'description' must be at most 5000 characters." });
    return null;
  }
  if (payload.tags && String(payload.tags).length > 500) {
    res.status(400).json({ error: "'tags' must be at most 500 characters." });
    return null;
  }
  // Enforce thumbnail length to fit DB (`varchar(500)`)
  if (payload.thumbnail && String(payload.thumbnail).length > 500) {
    res
      .status(400)
      .json({ error: "'thumbnail' must be at most 500 characters." });
    return null;
  }

  const numericError = assignOptionalNumbers(
    body,
    payload,
    OPTIONAL_NUMERIC_FIELDS
  );
  if (numericError) {
    res.status(400).json({ error: numericError });
    return null;
  }

  const temporalError = assignOptionalNumbers(
    body,
    payload,
    OPTIONAL_TEMPORAL_FIELDS
  );
  if (temporalError) {
    res.status(400).json({ error: temporalError });
    return null;
  }

  payload.is_short = isShort ? 1 : 0;

  return payload;
};

export const getAllVideos = async (req, res, next) => {
  try {
    const { page, limit, approved, privacy, featured } = req.query;
    // Validate featured: must be 0 or 1 if provided
    if (featured !== undefined && featured !== "") {
      if (!/^[01]$/.test(String(featured))) {
        return res.status(400).json({
          error: "Invalid 'featured' query param. Allowed values: 0 or 1.",
        });
      }
    }
    const filters = {};
    if (approved !== undefined && approved !== "") {
      const a = Number(approved);
      if (!Number.isNaN(a)) filters.approved = a;
    }
    if (privacy !== undefined && privacy !== "") {
      const p = Number(privacy);
      if (!Number.isNaN(p)) filters.privacy = p;
    }
    if (featured !== undefined && featured !== "") {
      const f = Number(featured);
      if (!Number.isNaN(f)) filters.featured = f;
    }

    const requestingUserId = getAuthenticatedUserId(req);
    const result = await findPaginated({
      page,
      limit,
      ...filters,
      requestingUserId,
    });

    // Video filtering (blocked videos / creators / users) is applied in the
    // service layer via `buildVideoFilterConditions` for authenticated users.
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getFilteredVideos = async (req, res, next) => {
  try {
    const { page, limit, approved, privacy, sort, featured } = req.query;
    // Validate featured: must be 0 or 1 if provided
    if (featured !== undefined && featured !== "") {
      if (!/^[01]$/.test(String(featured))) {
        return res.status(400).json({
          error: "Invalid 'featured' query param. Allowed values: 0 or 1.",
        });
      }
    }
    const filters = { sort };
    if (approved !== undefined && approved !== "") {
      const a = Number(approved);
      if (!Number.isNaN(a)) filters.approved = a;
    }
    if (privacy !== undefined && privacy !== "") {
      const p = Number(privacy);
      if (!Number.isNaN(p)) filters.privacy = p;
    }
    if (featured !== undefined && featured !== "") {
      const f = Number(featured);
      if (!Number.isNaN(f)) filters.featured = f;
    }

    const requestingUserId = getAuthenticatedUserId(req);
    const result = await findPaginated({
      page,
      limit,
      ...filters,
      requestingUserId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getShortsVideos = async (req, res, next) => {
  try {
    const { page, limit, approved, privacy, sort, featured } = req.query;
    // Validate featured: must be 0 or 1 if provided
    if (featured !== undefined && featured !== "") {
      if (!/^[01]$/.test(String(featured))) {
        return res.status(400).json({
          error: "Invalid 'featured' query param. Allowed values: 0 or 1.",
        });
      }
    }
    const requestingUserId = getAuthenticatedUserId(req);
    const result = await findPaginated({
      page,
      limit,
      approved,
      privacy,
      sort,
      featured,
      shortsOnly: true,
      requestingUserId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createVideo = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    // Remove any client-supplied identity or server-generated fields to
    // prevent tampering (e.g., user_id, video_id, short_id, is_short).
    if (req.body && typeof req.body === "object") {
      delete req.body.user_id;
      delete req.body.video_id;
      delete req.body.short_id;
      delete req.body.is_short;
    }

    const payload = buildCreatePayload(req, res, { isShort: false, userId });
    if (!payload) return;

    const created = await createVideoRecord(payload);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
};

export const createShort = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = buildCreatePayload(req, res, { isShort: true, userId });
    if (!payload) return;

    const created = await createShortRecord(payload);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
};

export const createView = async (req, res, next) => {
  try {
    const videoId = parseVideoId(req?.body?.video_id);
    if (!videoId) {
      return res.status(400).json({
        error: "'video_id' is required and must be a positive integer.",
      });
    }

    const fingerprint = sanitizeFingerprint(req?.body?.fingerprint);

    let userId = getAuthenticatedUserId(req);
    if (!userId) {
      const bodyUserId = parseOptionalUserId(req?.body?.user_id);
      if (bodyUserId) {
        userId = bodyUserId;
      }
    }

    const result = await recordView({
      videoId,
      fingerprint,
      userId,
    });

    res.status(result.counted ? 201 : 200).json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const likeVideo = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const videoId = parseVideoId(req?.body?.video_id);
    if (!videoId) {
      return res.status(400).json({
        error: "'video_id' is required and must be a positive integer.",
      });
    }

    const action = req?.body?.action;
    if (!action || !["like", "dislike", "remove"].includes(action)) {
      return res.status(400).json({
        error:
          "'action' is required and must be one of: 'like', 'dislike', 'remove'.",
      });
    }

    const result = await toggleLike({ userId, videoId, action });
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const getSavedStatus = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const videoId = parseVideoId(req?.params?.id);
    if (!videoId) {
      return res.status(400).json({
        error: "'id' parameter is required and must be a positive integer.",
      });
    }

    const result = await isVideoSaved({ userId, videoId });
    if (result && result.saved) {
      return res.status(200).json({ data: { saved: true, id: result.id } });
    }
    return res.status(200).json({ data: { saved: false } });
  } catch (err) {
    next(err);
  }
};

export const getVideoReactions = async (req, res, next) => {
  try {
    const videoId = parseVideoId(req?.params?.id);
    if (!videoId) {
      return res.status(400).json({
        error: "'id' parameter is required and must be a positive integer.",
      });
    }

    const counts = await getLikeCount(videoId);
    res.status(200).json({ data: { videoId, ...counts } });
  } catch (err) {
    next(err);
  }
};

export const getUserReaction = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const videoId = parseVideoId(req?.params?.id);
    if (!videoId) {
      return res.status(400).json({
        error: "'id' parameter is required and must be a positive integer.",
      });
    }

    const reaction = await getUserReactionFromService(videoId, userId);
    res.status(200).json({ data: { videoId, reaction } });
  } catch (err) {
    next(err);
  }
};

export const searchVideosController = async (req, res, next) => {
  try {
    const { q, page, limit, approved, privacy, featured } = req.query;

    if (!q || !String(q).trim()) {
      return res.status(400).json({
        error: "'q' query parameter is required for search.",
      });
    }

    // Validate featured: must be 0 or 1 if provided
    if (featured !== undefined && featured !== "") {
      if (!/^[01]$/.test(String(featured))) {
        return res.status(400).json({
          error: "Invalid 'featured' query param. Allowed values: 0 or 1.",
        });
      }
    }

    const filters = { query: q };
    if (page !== undefined) filters.page = page;
    if (limit !== undefined) filters.limit = limit;
    if (approved !== undefined && approved !== "") {
      const a = Number(approved);
      if (!Number.isNaN(a)) filters.approved = a;
    }
    if (privacy !== undefined && privacy !== "") {
      const p = Number(privacy);
      if (!Number.isNaN(p)) filters.privacy = p;
    }
    if (featured !== undefined && featured !== "") {
      const f = Number(featured);
      if (!Number.isNaN(f)) filters.featured = f;
    }

    const requestingUserId = getAuthenticatedUserId(req);
    const result = await searchVideos({ ...filters, requestingUserId });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getRandomVideosController = async (req, res, next) => {
  try {
    const { page, limit, approved, privacy } = req.query;

    // Validate page if provided
    if (page !== undefined && page !== "") {
      const p = Number(page);
      if (Number.isNaN(p) || p < 1) {
        return res.status(400).json({
          error: "Invalid 'page' query param. Must be a positive integer.",
        });
      }
    }

    // Validate limit if provided
    if (limit !== undefined && limit !== "") {
      const l = Number(limit);
      if (Number.isNaN(l) || l < 1 || l > 100) {
        return res.status(400).json({
          error: "Invalid 'limit' query param. Allowed values: 1-100.",
        });
      }
    }

    const filters = {};
    if (page !== undefined) filters.page = page;
    if (limit !== undefined) filters.limit = limit;
    if (approved !== undefined && approved !== "") {
      const a = Number(approved);
      if (!Number.isNaN(a)) filters.approved = a;
    }
    if (privacy !== undefined && privacy !== "") {
      const p = Number(privacy);
      if (!Number.isNaN(p)) filters.privacy = p;
    }

    const requestingUserId = getAuthenticatedUserId(req);
    const result = await getRandomVideos({ ...filters, requestingUserId });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const reportVideo = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const videoId = parseVideoId(req?.params?.id);
    if (!videoId) {
      return res.status(400).json({
        error: "'id' parameter is required and must be a positive integer.",
      });
    }
    // Validate body: only allow `text` field
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
      text = escapeHtml(text);
    }

    const created = await createVideoReport({ userId, videoId, text });
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
};

export const saveVideo = async (req, res, next) => {
  try {
    // This endpoint should not accept a request body.
    if (
      req.body &&
      typeof req.body === "object" &&
      Object.keys(req.body).length > 0
    ) {
      return res
        .status(400)
        .json({ error: "Request body must be empty for this endpoint." });
    }
    const userId = getAuthenticatedUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const videoId = parseVideoId(req?.params?.id);
    if (!videoId)
      return res.status(400).json({
        error: "'id' parameter is required and must be a positive integer.",
      });

    const created = await createSavedVideo({ userId, videoId });
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
};

export const getSavedVideos = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const page = req?.query?.page;
    const limit = req?.query?.limit;
    const result = await getSavedVideosForUser({ userId, page, limit });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const removeSaved = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const videoId = parseVideoId(req?.params?.id);
    if (!videoId)
      return res.status(400).json({
        error: "'id' parameter is required and must be a positive integer.",
      });

    const result = await removeSavedVideo({ userId, videoId });
    if (result.removed)
      return res.status(200).json({ message: "Saved video removed." });
    return res.status(200).json({ message: "No saved video to remove." });
  } catch (err) {
    next(err);
  }
};

export const blockVideo = async (req, res, next) => {
  try {
    // This endpoint should not accept a request body.
    if (
      req.body &&
      typeof req.body === "object" &&
      Object.keys(req.body).length > 0
    ) {
      return res
        .status(400)
        .json({ error: "Request body must be empty for this endpoint." });
    }

    const userId = getAuthenticatedUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const videoId = parseVideoId(req?.params?.videoID);
    if (!videoId)
      return res.status(400).json({
        error:
          "'videoID' parameter is required and must be a positive integer.",
      });

    const created = await createBlockedVideo({ userId, videoId });
    // Return 201 when newly created, 200 if already existed
    if (created && created.alreadyBlocked) {
      return res.status(200).json({ message: "Video already blocked." });
    }
    return res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
};

export default {
  getAllVideos,
  getFilteredVideos,
  getShortsVideos,
  createVideo,
  createShort,
  createView,
  likeVideo,
  getVideoReactions,
  getUserReaction,
  searchVideosController,
  getRandomVideosController,
  reportVideo,
  saveVideo,
  getSavedVideos,
  removeSaved,
  blockVideo,
};
