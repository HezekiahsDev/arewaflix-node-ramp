import crypto from "crypto";
import db from "../models/db.js";
import HttpError from "../utils/httpError.js";

// Fetch paginated videos from the database with safe defaults and a graceful fallback
export const findPaginated = async ({
  page = 1,
  limit = 20,
  approved,
  featured,
  privacy,
  sort = "latest", // latest | oldest | most_viewed | popular | top_rated
  is_short,
  shortsOnly = false,
} = {}) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  let safePage = Math.max(1, Number(page) || 1);
  let offset = 0;

  try {
    // Build WHERE clause based on optional filters
    const whereClauses = [];
    const whereValues = [];
    if (approved !== undefined) {
      whereClauses.push("approved = ?");
      whereValues.push(Number(approved));
    }
    if (featured !== undefined) {
      whereClauses.push("featured = ?");
      whereValues.push(Number(featured));
    }
    if (privacy !== undefined) {
      whereClauses.push("privacy = ?");
      whereValues.push(Number(privacy));
    }
    if (shortsOnly) {
      whereClauses.push("is_short = 1");
    } else if (is_short !== undefined) {
      whereClauses.push("is_short = ?");
      whereValues.push(Number(is_short));
    }
    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // Count total
    const totalRows = await db.query(
      `SELECT COUNT(*) as total FROM videos ${whereSql}`,
      whereValues
    );
    const total = Number(totalRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    if (safePage > totalPages) safePage = totalPages;
    offset = (safePage - 1) * safeLimit;

    // Map sort option to a safe ORDER BY clause
    // Note: rating is stored as varchar, we cast to unsigned for numeric ordering.
    let orderBySql = "ORDER BY publication_date DESC, time DESC"; // default latest
    switch (String(sort || "").toLowerCase()) {
      case "oldest":
        orderBySql = "ORDER BY publication_date ASC, time ASC";
        break;
      case "most_viewed":
      case "most-viewed":
      case "views":
        orderBySql = "ORDER BY views DESC, publication_date DESC, time DESC";
        break;
      case "popular":
        // Featured first, then by views and recency
        orderBySql =
          "ORDER BY featured DESC, views DESC, publication_date DESC, time DESC";
        break;
      case "top_rated":
      case "top-rated":
      case "rating":
        orderBySql =
          "ORDER BY CAST(rating AS UNSIGNED) DESC, views DESC, publication_date DESC, time DESC";
        break;
      case "latest":
      default:
        orderBySql = "ORDER BY publication_date DESC, time DESC";
        break;
    }

    // Fetch page of videos (return ALL DB columns)
    const rows = await db.query(
      `SELECT *
       FROM videos
       ${whereSql}
       ${orderBySql}
       LIMIT ${safeLimit} OFFSET ${offset}`,
      whereValues
    );

    return {
      data: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  } catch (err) {
    console.warn(
      "DB query failed in videos.service.findPaginated — falling back to placeholder:",
      err.message
    );
    const placeholder = [
      {
        id: 1,
        video_id: "demo-1",
        short_id: "demo",
        title: "Demo Video",
        description:
          "This is a placeholder video returned because the DB is not configured.",
        thumbnail: "",
        duration: "00:30",
        views: 0,
        user_id: 0,
        time_date: new Date().toISOString(),
      },
    ];

    const start = offset;
    const end = offset + safeLimit;
    const pageItems = placeholder.slice(start, end);
    const total = placeholder.length;
    return {
      data: pageItems,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }
};

const DEFAULT_THUMBNAIL = "upload/photos/thumbnail.jpg";
const DEFAULT_DURATION = "00:00";
const DEFAULT_LIVE_CHATING = "on";
const VIDEO_ID_LENGTH = 16;
const SHORT_ID_LENGTH = 7;

const randomAlphanumeric = (length) => {
  let output = "";
  while (output.length < length) {
    output += crypto
      .randomBytes(length)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "");
  }
  return output.slice(0, length);
};

const generateVideoId = () => randomAlphanumeric(VIDEO_ID_LENGTH);
const generateShortId = () => randomAlphanumeric(SHORT_ID_LENGTH);

const buildRegisteredString = (date) =>
  `${date.getFullYear()}/${date.getMonth() + 1}`;

const sanitizeString = (value, fallback = "") =>
  value === undefined || value === null ? fallback : String(value);

const parseRequiredNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(`${fieldName} must be a valid number`, 400);
  }
  return parsed;
};

const parseOptionalNumber = (value, fallback, fieldName) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(`${fieldName} must be a valid number`, 400);
  }
  return parsed;
};

const MAX_FINGERPRINT_LENGTH = 300;

const sanitizeFingerprint = (value) => {
  if (value === undefined || value === null) return "";
  const stringValue = String(value).trim();
  if (!stringValue) return "";
  return stringValue.slice(0, MAX_FINGERPRINT_LENGTH);
};

const normalizeUserId = (value) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return 0;
  return parsed;
};

const insertVideoRecord = async (payload = {}, { isShort = false } = {}) => {
  const userId = parseRequiredNumber(payload.user_id, "user_id");
  const title = sanitizeString(payload.title).trim();
  if (!title) {
    throw new HttpError("title is required", 400);
  }

  let videoId = sanitizeString(payload.video_id).trim();
  if (!videoId) videoId = generateVideoId();

  let shortId = sanitizeString(payload.short_id).trim();
  if (!shortId) shortId = generateShortId();

  const now = new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const publicationDate = parseOptionalNumber(
    payload.publication_date,
    nowSeconds,
    "publication_date"
  );
  const timeValue = parseOptionalNumber(payload.time, nowSeconds, "time");

  const insertData = {
    video_id: videoId,
    short_id: shortId,
    user_id: userId,
    title,
    description: sanitizeString(payload.description, ""),
    thumbnail: sanitizeString(payload.thumbnail, DEFAULT_THUMBNAIL),
    time: timeValue,
    publication_date: publicationDate,
    time_date: sanitizeString(payload.time_date, now.toISOString()),
    registered: sanitizeString(payload.registered, buildRegisteredString(now)),
    is_short: isShort
      ? 1
      : parseOptionalNumber(payload.is_short, 0, "is_short"),
    duration: sanitizeString(payload.duration, DEFAULT_DURATION),
    live_chating: sanitizeString(payload.live_chating, DEFAULT_LIVE_CHATING),
  };

  const stringDefaults = {
    video_location: "",
    youtube: "",
    vimeo: "",
    daily: "",
    facebook: "",
    instagram: "",
    ok: "",
    twitch: "",
    twitch_type: "",
    tags: "",
    type: "",
    quality: "",
    rating: "",
    country: "",
    license: "",
    demo: "",
    gif: "",
    trailer: "",
  };

  for (const [field, fallback] of Object.entries(stringDefaults)) {
    insertData[field] = sanitizeString(payload[field], fallback);
  }

  const numericDefaults = {
    category_id: 0,
    privacy: 0,
    age_restriction: 1,
    approved: 1,
    featured: 0,
    monetization: 1,
    rent_price: 0,
    is_movie: 0,
    views: 0,
    size: 0,
    embed: 0,
    converted: 1,
    featured_movie: 0,
  };

  for (const [field, fallback] of Object.entries(numericDefaults)) {
    insertData[field] = parseOptionalNumber(payload[field], fallback, field);
  }

  const columns = Object.keys(insertData);
  const placeholders = columns.map(() => "?").join(", ");
  const insertSql = `INSERT INTO videos (${columns.join(
    ", "
  )}) VALUES (${placeholders})`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const values = columns.map((col) => insertData[col]);
    try {
      const result = await db.query(insertSql, values);
      const insertedId = result.insertId;
      if (!insertedId) return null;
      const rows = await db.query("SELECT * FROM videos WHERE id = ?", [
        insertedId,
      ]);
      return rows?.[0] || null;
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY" && attempt < 4) {
        insertData.video_id = generateVideoId();
        insertData.short_id = generateShortId();
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to create video record after multiple attempts.");
};

export const createVideo = async (payload = {}) =>
  insertVideoRecord(payload, { isShort: false });

export const createShort = async (payload = {}) =>
  insertVideoRecord(payload, { isShort: true });

export const recordView = async ({ videoId, fingerprint, userId } = {}) => {
  const parsedVideoId = Number(videoId);
  if (!Number.isSafeInteger(parsedVideoId) || parsedVideoId <= 0) {
    throw new HttpError("'videoId' must be a positive integer.", 400);
  }

  const sanitizedFingerprint = sanitizeFingerprint(fingerprint);
  const normalizedUserId = normalizeUserId(userId);
  const timestamp = Math.floor(Date.now() / 1000);

  const videoRows = await db.query(
    "SELECT id, views FROM videos WHERE id = ?",
    [parsedVideoId]
  );
  const video = Array.isArray(videoRows) ? videoRows[0] : undefined;
  if (!video) {
    throw new HttpError("Video not found.", 404);
  }

  let counted = true;
  let existingViewId = null;

  if (sanitizedFingerprint) {
    const existing = await db.query(
      "SELECT id FROM views WHERE video_id = ? AND fingerprint = ? LIMIT 1",
      [parsedVideoId, sanitizedFingerprint]
    );
    if (existing?.length) {
      counted = false;
      existingViewId = existing[0]?.id;
    }
  } else if (normalizedUserId) {
    const existing = await db.query(
      "SELECT id FROM views WHERE video_id = ? AND user_id = ? LIMIT 1",
      [parsedVideoId, normalizedUserId]
    );
    if (existing?.length) {
      counted = false;
      existingViewId = existing[0]?.id;
    }
  }

  if (counted) {
    const insertResult = await db.query(
      "INSERT INTO views (video_id, fingerprint, user_id, time) VALUES (?, ?, ?, ?)",
      [parsedVideoId, sanitizedFingerprint, normalizedUserId, timestamp]
    );

    const updateResult = await db.query(
      "UPDATE videos SET views = views + 1 WHERE id = ?",
      [parsedVideoId]
    );

    if (!updateResult || updateResult.affectedRows === 0) {
      const insertedId = insertResult?.insertId;
      if (insertedId) {
        await db.query("DELETE FROM views WHERE id = ?", [insertedId]);
      }
      throw new HttpError(
        "Unable to increment views for the specified video.",
        500
      );
    }
  } else if (existingViewId) {
    await db.query("UPDATE views SET time = ? WHERE id = ?", [
      timestamp,
      existingViewId,
    ]);
  }

  const latestRows = await db.query(
    "SELECT id, views FROM videos WHERE id = ?",
    [parsedVideoId]
  );
  const latest = Array.isArray(latestRows) ? latestRows[0] : undefined;
  if (!latest) {
    throw new HttpError("Video not found.", 404);
  }

  return {
    videoId: parsedVideoId,
    views: Number(latest.views) || 0,
    counted,
  };
};

export const toggleLike = async ({ userId, videoId, action }) => {
  const parsedUserId = normalizeUserId(userId);
  if (!parsedUserId) {
    throw new HttpError("User authentication is required.", 401);
  }

  const parsedVideoId = Number(videoId);
  if (!Number.isSafeInteger(parsedVideoId) || parsedVideoId <= 0) {
    throw new HttpError("'videoId' must be a positive integer.", 400);
  }

  const videoRows = await db.query("SELECT id FROM videos WHERE id = ?", [
    parsedVideoId,
  ]);
  if (!videoRows?.length) {
    throw new HttpError("Video not found.", 404);
  }

  const existingLike = await db.query(
    "SELECT id, type FROM likes_dislikes WHERE user_id = ? AND video_id = ?",
    [parsedUserId, parsedVideoId]
  );

  const timestamp = Math.floor(Date.now() / 1000);

  if (action === "remove") {
    if (existingLike?.length) {
      await db.query("DELETE FROM likes_dislikes WHERE id = ?", [
        existingLike[0].id,
      ]);
      return {
        action: "removed",
        message: "Like/dislike removed successfully.",
      };
    }
    return { action: "no-op", message: "No like/dislike to remove." };
  }

  const type = action === "like" ? 1 : 2;

  if (existingLike?.length) {
    const like = existingLike[0];
    if (like.type === type) {
      // Already the same, remove it (toggle off)
      await db.query("DELETE FROM likes_dislikes WHERE id = ?", [like.id]);
      return {
        action: "removed",
        message: `Video ${action} removed successfully.`,
      };
    }
    // Update to new type
    await db.query(
      "UPDATE likes_dislikes SET type = ?, time = ? WHERE id = ?",
      [type, timestamp, like.id]
    );
    return { action, message: `Video ${action} updated successfully.` };
  }

  // No existing record, create new
  await db.query(
    "INSERT INTO likes_dislikes (user_id, video_id, type, time) VALUES (?, ?, ?, ?)",
    [parsedUserId, parsedVideoId, type, timestamp]
  );

  return { action, message: `Video ${action}d successfully.` };
};

export default {
  findPaginated,
  createVideo,
  createShort,
  recordView,
  toggleLike,
};
