import crypto from "crypto";
import db from "../models/db.js";
import HttpError from "../utils/httpError.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { buildVideoFilterConditions } from "../utils/videoFilterHelper.js";

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
  requestingUserId = null,
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

    // Apply video filtering: exclude blocked videos, videos from blocked creators, and blocked users
    const { whereClauses: filterClauses, whereValues: filterValues } =
      await buildVideoFilterConditions(requestingUserId);
    whereClauses.push(...filterClauses);
    whereValues.push(...filterValues);

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    if (process.env.DEBUG_VIDEO_FILTER === "1") {
      try {
        console.debug(
          "findPaginated: whereSql",
          whereSql,
          "params",
          whereValues,
          "requestingUserId",
          requestingUserId
        );
      } catch (e) {}
    }

    // Count total
    const totalRows = await db.query(
      `SELECT COUNT(*) as total FROM videos ${whereSql}`,
      whereValues
    );
    const total = Number(totalRows?.[0]?.total || 0);
    if (process.env.DEBUG_VIDEO_FILTER === "1") {
      try {
        console.debug(
          "findPaginated: total",
          total,
          "whereSql",
          whereSql,
          "params",
          whereValues
        );
      } catch (e) {}
    }
    if (process.env.DEBUG_VIDEO_FILTER === "1") {
      try {
        // Distinct user counts for videos (see if blocked users cover all)
        const userCounts = await db.query(
          "SELECT user_id, COUNT(*) as c FROM videos GROUP BY user_id ORDER BY c DESC LIMIT 50"
        );
        console.debug(
          "findPaginated: videoOwnerCounts",
          (userCounts || []).slice(0, 10)
        );

        // Videos remaining after excluding video IDs only
        const idsOnlyRows = await db.query(
          `SELECT id, user_id FROM videos WHERE ${
            whereClauses.length ? whereClauses[0] : "1=1"
          } LIMIT 20`
        );
        console.debug(
          "findPaginated: afterIdExclusionSample",
          (idsOnlyRows || []).slice(0, 10)
        );

        // Videos that would be excluded by user_blocks
        const excludedByUserBlocks = await db.query(
          `SELECT id, user_id FROM videos WHERE EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = ? AND ub.blocked_id = videos.user_id) LIMIT 50`,
          [requestingUserId]
        );
        console.debug(
          "findPaginated: excludedByUserBlocksSample",
          (excludedByUserBlocks || []).slice(0, 20)
        );
      } catch (e) {}
    }
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

    // Fetch page of videos (return ALL DB columns). Use parameterized LIMIT/OFFSET.
    const rows = await db.query(
      `SELECT *
       FROM videos
       ${whereSql}
       ${orderBySql}
       LIMIT ? OFFSET ?`,
      [...whereValues, safeLimit, offset]
    );
    if (process.env.DEBUG_VIDEO_FILTER === "1") {
      try {
        console.debug(
          "findPaginated: total",
          total,
          "whereSql",
          whereSql,
          "params",
          whereValues
        );

        // Also log total videos without filters for comparison
        const allRows = await db.query(`SELECT COUNT(*) as total FROM videos`);
        const allTotal = Number(allRows?.[0]?.total || 0);
        console.debug("findPaginated: totalAllVideos", allTotal);

        // Build a quick expanded SQL for debugging (do not use in production)
        let expanded = `SELECT COUNT(*) as total FROM videos ${whereSql}`;
        const vals = [...whereValues];
        for (const v of vals) {
          const rep =
            typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`;
          expanded = expanded.replace("?", rep);
        }
        console.debug("findPaginated: expandedSql", expanded);
      } catch (e) {}
    }
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
  const title = escapeHtml(sanitizeString(payload.title).trim());
  if (!title) {
    throw new HttpError("title is required", 400);
  }

  // Let the database generate `video_id` if none is provided by the client.
  let videoId = sanitizeString(payload.video_id).trim();

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
    description: escapeHtml(sanitizeString(payload.description, "")),
    thumbnail: escapeHtml(sanitizeString(payload.thumbnail, DEFAULT_THUMBNAIL)),
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
    insertData[field] = escapeHtml(sanitizeString(payload[field], fallback));
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
      // Re-query to obtain DB-generated fields (including video_id)
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

  // If no fingerprint is provided, do not record a view (return 200)
  if (!sanitizedFingerprint) {
    return {
      videoId: parsedVideoId,
      views: Number(video.views) || 0,
      counted: false,
    };
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
      // Remove all matching rows for safety (in case duplicates exist)
      await db.query(
        "DELETE FROM likes_dislikes WHERE user_id = ? AND video_id = ?",
        [parsedUserId, parsedVideoId]
      );
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

  // No existing record, create new. If a race caused a duplicate insert, try to update
  try {
    await db.query(
      "INSERT INTO likes_dislikes (user_id, video_id, type, time) VALUES (?, ?, ?, ?)",
      [parsedUserId, parsedVideoId, type, timestamp]
    );
    return { action, message: `Video ${action}d successfully.` };
  } catch (err) {
    // If duplicate entry (race), attempt to update the existing record(s)
    if (err && err.code === "ER_DUP_ENTRY") {
      await db.query(
        "UPDATE likes_dislikes SET type = ?, time = ? WHERE user_id = ? AND video_id = ?",
        [type, timestamp, parsedUserId, parsedVideoId]
      );
      return {
        action,
        message: `Video ${action} (race-handled) updated successfully.`,
      };
    }
    throw err;
  }
};

export const getLikeCount = async (videoId) => {
  const parsedVideoId = Number(videoId);
  if (!Number.isSafeInteger(parsedVideoId) || parsedVideoId <= 0) {
    throw new HttpError("'videoId' must be a positive integer.", 400);
  }

  const [likesResult, dislikesResult] = await Promise.all([
    db.query(
      "SELECT COUNT(*) as count FROM likes_dislikes WHERE video_id = ? AND type = 1",
      [parsedVideoId]
    ),
    db.query(
      "SELECT COUNT(*) as count FROM likes_dislikes WHERE video_id = ? AND type = 2",
      [parsedVideoId]
    ),
  ]);

  return {
    likes: Number(likesResult?.[0]?.count || 0),
    dislikes: Number(dislikesResult?.[0]?.count || 0),
  };
};

export const getUserReaction = async (videoId, userId) => {
  const parsedVideoId = Number(videoId);
  if (!Number.isSafeInteger(parsedVideoId) || parsedVideoId <= 0) {
    throw new HttpError("'videoId' must be a positive integer.", 400);
  }

  const parsedUserId = normalizeUserId(userId);
  if (!parsedUserId) {
    // Caller should ensure authentication, but return 0 for anonymous
    return 0;
  }

  const rows = await db.query(
    "SELECT type FROM likes_dislikes WHERE user_id = ? AND video_id = ? LIMIT 1",
    [parsedUserId, parsedVideoId]
  );

  if (!rows || !rows.length) return 0;
  const t = Number(rows[0].type) || 0;
  return t;
};

export const searchVideos = async ({
  query = "",
  page = 1,
  limit = 20,
  approved,
  privacy,
  featured,
  requestingUserId = null,
} = {}) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  let safePage = Math.max(1, Number(page) || 1);
  let offset = 0;

  const searchTerm = String(query || "").trim();
  if (!searchTerm) {
    // If no search term, return empty results
    return {
      data: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  try {
    // Build WHERE clause with search + optional filters
    const whereClauses = [];
    const whereValues = [];

    // Search in title, description, and tags using LIKE
    // Escape LIKE wildcards and cap length to avoid excessive patterns
    const MAX_SEARCH_TERM_LENGTH = 200;
    const truncateTerm = String(searchTerm).slice(0, MAX_SEARCH_TERM_LENGTH);
    const escapeLike = (s) => String(s).replace(/([\\%_])/g, "\\$1");
    const escaped = escapeLike(truncateTerm);
    const searchPattern = `%${escaped}%`;
    whereClauses.push(
      "(title LIKE ? ESCAPE '\\\\' OR description LIKE ? ESCAPE '\\\\' OR tags LIKE ? ESCAPE '\\\\')"
    );
    whereValues.push(searchPattern, searchPattern, searchPattern);

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

    // Apply video filtering: exclude blocked videos, videos from blocked creators, and blocked users
    const { whereClauses: filterClauses, whereValues: filterValues } =
      await buildVideoFilterConditions(requestingUserId);
    whereClauses.push(...filterClauses);
    whereValues.push(...filterValues);

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
    if (process.env.DEBUG_VIDEO_FILTER === "1") {
      try {
        console.debug(
          "searchVideos: whereSql",
          whereSql,
          "params",
          whereValues,
          "requestingUserId",
          requestingUserId
        );
      } catch (e) {}
    }

    // Count total matching videos
    const totalRows = await db.query(
      `SELECT COUNT(*) as total FROM videos ${whereSql}`,
      whereValues
    );
    const total = Number(totalRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    if (safePage > totalPages) safePage = totalPages;
    offset = (safePage - 1) * safeLimit;

    // Fetch matching videos ordered by relevance (views desc, then recent)
    const rows = await db.query(
      `SELECT *
       FROM videos
       ${whereSql}
       ORDER BY views DESC, publication_date DESC, time DESC
       LIMIT ? OFFSET ?`,
      [...whereValues, safeLimit, offset]
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
      "DB query failed in videos.service.searchVideos — returning empty:",
      err.message
    );
    return {
      data: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 0,
      },
    };
  }
};

export const getRandomVideos = async ({
  page = 1,
  limit = 20,
  approved,
  privacy,
  requestingUserId = null,
} = {}) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  let safePage = Math.max(1, Number(page) || 1);
  let offset = 0;

  try {
    // Build WHERE clause with optional filters
    const whereClauses = [];
    const whereValues = [];

    if (approved !== undefined) {
      whereClauses.push("approved = ?");
      whereValues.push(Number(approved));
    }
    if (privacy !== undefined) {
      whereClauses.push("privacy = ?");
      whereValues.push(Number(privacy));
    }

    // Apply video filtering: exclude blocked videos, videos from blocked creators, and blocked users
    const { whereClauses: filterClauses, whereValues: filterValues } =
      await buildVideoFilterConditions(requestingUserId);
    whereClauses.push(...filterClauses);
    whereValues.push(...filterValues);

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";
    if (process.env.DEBUG_VIDEO_FILTER === "1") {
      try {
        console.debug(
          "getRandomVideos: whereSql",
          whereSql,
          "params",
          whereValues,
          "requestingUserId",
          requestingUserId
        );
      } catch (e) {}
    }

    // Count total matching videos for pagination
    const totalRows = await db.query(
      `SELECT COUNT(*) as total FROM videos ${whereSql}`,
      whereValues
    );
    const total = Number(totalRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    if (safePage > totalPages) safePage = totalPages;
    offset = (safePage - 1) * safeLimit;

    // Fetch random videos with pagination (parameterized LIMIT/OFFSET)
    const rows = await db.query(
      `SELECT *
       FROM videos
       ${whereSql}
       ORDER BY RAND()
       LIMIT ? OFFSET ?`,
      [...whereValues, safeLimit, offset]
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
      "DB query failed in videos.service.getRandomVideos — returning empty:",
      err.message
    );
    return {
      data: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 0,
      },
    };
  }
};

export const createVideoReport = async ({
  userId,
  videoId,
  text = "",
} = {}) => {
  const parsedUserId = normalizeUserId(userId);
  if (!parsedUserId)
    throw new HttpError("User authentication is required.", 401);

  const parsedVideoId = Number(videoId);
  if (!Number.isSafeInteger(parsedVideoId) || parsedVideoId <= 0)
    throw new HttpError("'videoId' must be a positive integer.", 400);

  // Verify video exists
  const rows = await db.query("SELECT id FROM videos WHERE id = ?", [
    parsedVideoId,
  ]);
  if (!rows?.length) throw new HttpError("Video not found.", 404);

  const timestamp = Math.floor(Date.now() / 1000);

  const result = await db.query(
    "INSERT INTO reports (video_id, article_id, ad_id, comment_id, reply_id, profile_id, user_id, text, time, seen, type) VALUES (?, 0, 0, 0, 0, 0, ?, ?, ?, 0, ?)",
    [parsedVideoId, parsedUserId, text || "", String(timestamp), "video"]
  );

  const insertedId = result?.insertId;
  if (!insertedId) throw new HttpError("Unable to create report.", 500);

  const reportRows = await db.query("SELECT * FROM reports WHERE id = ?", [
    insertedId,
  ]);
  return reportRows?.[0] || null;
};

export const createSavedVideo = async ({ userId, videoId } = {}) => {
  const parsedUserId = normalizeUserId(userId);
  if (!parsedUserId)
    throw new HttpError("User authentication is required.", 401);

  const parsedVideoId = Number(videoId);
  if (!Number.isSafeInteger(parsedVideoId) || parsedVideoId <= 0)
    throw new HttpError("'videoId' must be a positive integer.", 400);

  // Verify video exists
  const rows = await db.query("SELECT id FROM videos WHERE id = ?", [
    parsedVideoId,
  ]);
  if (!rows?.length) throw new HttpError("Video not found.", 404);

  const timestamp = Math.floor(Date.now() / 1000);

  // Prevent duplicate saves by same user
  const existing = await db.query(
    "SELECT id FROM saved_videos WHERE user_id = ? AND video_id = ? LIMIT 1",
    [parsedUserId, parsedVideoId]
  );
  if (existing?.length) return { alreadySaved: true, id: existing[0].id };

  const result = await db.query(
    "INSERT INTO saved_videos (user_id, video_id, time) VALUES (?, ?, ?)",
    [parsedUserId, parsedVideoId, timestamp]
  );
  const insertedId = result?.insertId;
  if (!insertedId) throw new HttpError("Unable to save video.", 500);

  const savedRows = await db.query("SELECT * FROM saved_videos WHERE id = ?", [
    insertedId,
  ]);
  return savedRows?.[0] || null;
};

export const createBlockedVideo = async ({ userId, videoId } = {}) => {
  const parsedUserId = normalizeUserId(userId);
  if (!parsedUserId)
    throw new HttpError("User authentication is required.", 401);

  const parsedVideoId = Number(videoId);
  if (!Number.isSafeInteger(parsedVideoId) || parsedVideoId <= 0)
    throw new HttpError("'videoId' must be a positive integer.", 400);

  // Verify video exists
  const rows = await db.query("SELECT id FROM videos WHERE id = ?", [
    parsedVideoId,
  ]);
  if (!rows?.length) throw new HttpError("Video not found.", 404);

  const timestamp = Math.floor(Date.now() / 1000);

  // Prevent duplicate blocks by same user
  const existing = await db.query(
    "SELECT id FROM blocked_videos WHERE user_id = ? AND video_id = ? LIMIT 1",
    [parsedUserId, parsedVideoId]
  );
  if (existing?.length) return { alreadyBlocked: true, id: existing[0].id };

  const result = await db.query(
    "INSERT INTO blocked_videos (user_id, video_id, time) VALUES (?, ?, ?)",
    [parsedUserId, parsedVideoId, timestamp]
  );
  const insertedId = result?.insertId;
  if (!insertedId) throw new HttpError("Unable to block video.", 500);

  const blockedRows = await db.query(
    "SELECT * FROM blocked_videos WHERE id = ?",
    [insertedId]
  );
  return blockedRows?.[0] || null;
};

export const isVideoSaved = async ({ userId, videoId } = {}) => {
  const parsedUserId = normalizeUserId(userId);
  if (!parsedUserId)
    throw new HttpError("User authentication is required.", 401);

  const parsedVideoId = Number(videoId);
  if (!Number.isSafeInteger(parsedVideoId) || parsedVideoId <= 0)
    throw new HttpError("'videoId' must be a positive integer.", 400);

  const rows = await db.query(
    "SELECT id FROM saved_videos WHERE user_id = ? AND video_id = ? LIMIT 1",
    [parsedUserId, parsedVideoId]
  );

  if (rows?.length) return { saved: true, id: rows[0].id };
  return { saved: false };
};

export const getSavedVideosForUser = async ({
  userId,
  page = 1,
  limit = 20,
} = {}) => {
  const parsedUserId = normalizeUserId(userId);
  if (!parsedUserId)
    throw new HttpError("User authentication is required.", 401);

  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  // Build filter conditions for blocked videos and creators
  const { whereClauses: filterClauses, whereValues: filterValues } =
    await buildVideoFilterConditions(parsedUserId);

  // Build additional WHERE clause for filtering
  let additionalWhereClause = "";
  const additionalWhereValues = [];

  if (filterClauses.length > 0) {
    // Replace "id" with "v.id" and "user_id" with "v.user_id" for JOIN context
    const joinFilterClauses = filterClauses.map((clause) => {
      return clause
        .replace(/\bid\b(?!\s*NOT)/g, "v.id")
        .replace(/\buser_id\b/g, "v.user_id");
    });
    additionalWhereClause = ` AND ${joinFilterClauses.join(" AND ")}`;
    additionalWhereValues.push(...filterValues);
  }

  const totalRows = await db.query(
    `SELECT COUNT(*) as total 
     FROM saved_videos sv
     LEFT JOIN videos v ON sv.video_id = v.id
     WHERE sv.user_id = ?${additionalWhereClause}`,
    [parsedUserId, ...additionalWhereValues]
  );
  const total = Number(totalRows?.[0]?.total || 0);

  // Join with videos to return video details alongside save record
  const rows = await db.query(
    `SELECT sv.id as saved_id, sv.time as saved_time, v.*
     FROM saved_videos sv
     LEFT JOIN videos v ON sv.video_id = v.id
     WHERE sv.user_id = ?${additionalWhereClause}
     ORDER BY sv.id DESC
     LIMIT ? OFFSET ?`,
    [parsedUserId, ...additionalWhereValues, safeLimit, offset]
  );

  return {
    data: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};

export const removeSavedVideo = async ({ userId, videoId } = {}) => {
  const parsedUserId = normalizeUserId(userId);
  if (!parsedUserId)
    throw new HttpError("User authentication is required.", 401);

  const parsedVideoId = Number(videoId);
  if (!Number.isSafeInteger(parsedVideoId) || parsedVideoId <= 0)
    throw new HttpError("'videoId' must be a positive integer.", 400);

  const result = await db.query(
    "DELETE FROM saved_videos WHERE user_id = ? AND video_id = ?",
    [parsedUserId, parsedVideoId]
  );
  // mysql2 returns an object with affectedRows when using .query; normalize
  const affected = result?.affectedRows ?? result?.[0]?.affectedRows ?? 0;
  if (affected === 0) return { removed: false };
  return { removed: true };
};

export default {
  findPaginated,
  createVideo,
  createShort,
  recordView,
  toggleLike,
  getLikeCount,
  getUserReaction,
  searchVideos,
  getRandomVideos,
  createVideoReport,
  createSavedVideo,
  getSavedVideosForUser,
  removeSavedVideo,
  createBlockedVideo,
};
