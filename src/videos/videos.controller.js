import {
  findPaginated,
  createVideo as createVideoRecord,
  createShort as createShortRecord,
  recordView,
  toggleLike,
  getLikeCount,
} from "./videos.service.js";

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

    const result = await findPaginated({ page, limit, ...filters });
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

    const result = await findPaginated({ page, limit, ...filters });
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
    const result = await findPaginated({
      page,
      limit,
      approved,
      privacy,
      sort,
      featured,
      shortsOnly: true,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createVideo = async (req, res, next) => {
  try {
    let userId = getAuthenticatedUserId(req);
    // If not authenticated, allow client to provide user_id (or default to 0 for anonymous)
    if (!userId) {
      const bodyUserId = parseOptionalUserId(req?.body?.user_id);
      userId = bodyUserId || 0;
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

export const getVideoLikes = async (req, res, next) => {
  try {
    const videoId = parseVideoId(req?.params?.id);
    if (!videoId) {
      return res.status(400).json({
        error: "'id' parameter is required and must be a positive integer.",
      });
    }

    const likeCount = await getLikeCount(videoId);
    res.status(200).json({ data: { videoId, likes: likeCount } });
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
  getVideoLikes,
};
