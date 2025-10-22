import db from "../models/db.js";
import HttpError from "../utils/httpError.js";

const normalizeUserId = (value) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return 0;
  return parsed;
};

export const postComment = async ({ userId, videoId, text }) => {
  const uid = normalizeUserId(userId);
  if (!uid) throw new HttpError("Authentication required.", 401);

  const vid = Number(videoId);
  if (!Number.isSafeInteger(vid) || vid <= 0)
    throw new HttpError("'videoId' must be a positive integer.", 400);

  const bodyText = typeof text === "string" ? text.trim() : "";
  if (!bodyText) throw new HttpError("'text' is required.", 400);

  const timestamp = Math.floor(Date.now() / 1000);

  // Ensure video exists
  const rows = await db.query("SELECT id FROM videos WHERE id = ?", [vid]);
  if (!rows?.length) throw new HttpError("Video not found.", 404);

  const result = await db.query(
    "INSERT INTO comments (user_id, video_id, text, time) VALUES (?, ?, ?, ?)",
    [uid, vid, bodyText, timestamp]
  );

  const insertedId = result?.insertId;
  if (!insertedId) throw new HttpError("Unable to create comment.", 500);

  const commentRows = await db.query("SELECT * FROM comments WHERE id = ?", [
    insertedId,
  ]);

  return commentRows?.[0] || null;
};

export const getCommentsForVideo = async ({
  videoId,
  page = 1,
  limit = 20,
}) => {
  const vid = Number(videoId);
  if (!Number.isSafeInteger(vid) || vid <= 0)
    throw new HttpError("'videoId' must be a positive integer.", 400);

  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  const totalRows = await db.query(
    "SELECT COUNT(*) as total FROM comments WHERE video_id = ?",
    [vid]
  );
  const total = Number(totalRows?.[0]?.total || 0);

  const rows = await db.query(
    `SELECT 
      c.*, 
      u.username,
      u.avatar,
      u.verified
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.video_id = ?
    ORDER BY c.time DESC
    LIMIT ? OFFSET ?`,
    [vid, safeLimit, offset]
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

export default { postComment, getCommentsForVideo };
