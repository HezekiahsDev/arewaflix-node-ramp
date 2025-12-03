import db from "../models/db.js";
import HttpError from "../utils/httpError.js";
import { escapeHtml } from "../utils/escapeHtml.js";

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

  // Escape HTML before storing to reduce XSS risk when content is rendered
  const safeText = escapeHtml(bodyText);
  const result = await db.query(
    "INSERT INTO comments (user_id, video_id, text, time) VALUES (?, ?, ?, ?)",
    [uid, vid, safeText, timestamp]
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

export const toggleCommentLike = async ({
  userId,
  commentId,
  videoId,
  action,
}) => {
  const uid = normalizeUserId(userId);
  if (!uid) throw new HttpError("User authentication is required.", 401);

  const cid = Number(commentId);
  if (!Number.isSafeInteger(cid) || cid <= 0)
    throw new HttpError("'commentId' must be a positive integer.", 400);

  // Use a transaction to keep counters in `comments` consistent
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the comment row for update and confirm existence
    const [commentRows] = await conn.execute(
      "SELECT id FROM comments WHERE id = ? FOR UPDATE",
      [cid]
    );
    if (!commentRows?.length) {
      await conn.rollback();
      throw new HttpError("Comment not found.", 404);
    }

    // Fetch all existing reactions by this user for this comment (duplicates possible)
    const [existingRows] = await conn.execute(
      "SELECT id, type FROM comments_likes WHERE user_id = ? AND comment_id = ?",
      [uid, cid]
    );

    const timestamp = Math.floor(Date.now() / 1000);

    // Count existing types (defensive: handle duplicates)
    const removedLikeCount = (existingRows || []).filter(
      (r) => Number(r.type) === 1
    ).length;
    const removedDislikeCount = (existingRows || []).filter(
      (r) => Number(r.type) === 2
    ).length;

    // Helper: decrement counters (use GREATEST to avoid negative values)
    const decrementCounters = async (likesDec, dislikesDec) => {
      if (likesDec > 0) {
        await conn.execute(
          "UPDATE comments SET likes = GREATEST(likes - ?, 0) WHERE id = ?",
          [likesDec, cid]
        );
      }
      if (dislikesDec > 0) {
        await conn.execute(
          "UPDATE comments SET dis_likes = GREATEST(dis_likes - ?, 0) WHERE id = ?",
          [dislikesDec, cid]
        );
      }
    };

    // Helper: increment counters
    const incrementCounters = async (likesInc, dislikesInc) => {
      if (likesInc > 0) {
        await conn.execute(
          "UPDATE comments SET likes = likes + ? WHERE id = ?",
          [likesInc, cid]
        );
      }
      if (dislikesInc > 0) {
        await conn.execute(
          "UPDATE comments SET dis_likes = dis_likes + ? WHERE id = ?",
          [dislikesInc, cid]
        );
      }
    };

    if (action === "remove") {
      if ((existingRows || []).length) {
        // delete all existing rows for this user/comment
        await conn.execute(
          "DELETE FROM comments_likes WHERE user_id = ? AND comment_id = ?",
          [uid, cid]
        );
        // decrement counters by counts removed
        await decrementCounters(removedLikeCount, removedDislikeCount);
        await conn.commit();
        return { action: "removed", message: "Reaction removed successfully." };
      }
      await conn.commit();
      return { action: "no-op", message: "No reaction to remove." };
    }

    const newType = action === "like" ? 1 : 2;

    if ((existingRows || []).length) {
      // If existing rows exist, but they are the same type -> toggle off
      const first = existingRows[0];
      if (
        Number(first.type) === newType &&
        removedLikeCount + removedDislikeCount > 0
      ) {
        // remove all and decrement corresponding counters
        await conn.execute(
          "DELETE FROM comments_likes WHERE user_id = ? AND comment_id = ?",
          [uid, cid]
        );
        await decrementCounters(removedLikeCount, removedDislikeCount);
        await conn.commit();
        return {
          action: "removed",
          message: `Comment ${action} removed successfully.`,
        };
      }

      // Different type: remove existing duplicates, decrement old counters, insert new single row, increment new counter
      await conn.execute(
        "DELETE FROM comments_likes WHERE user_id = ? AND comment_id = ?",
        [uid, cid]
      );
      await decrementCounters(removedLikeCount, removedDislikeCount);
      await conn.execute(
        "INSERT INTO comments_likes (user_id, comment_id, video_id, time, type) VALUES (?, ?, ?, ?, ?)",
        [uid, cid, Number(videoId) || 0, timestamp, newType]
      );
      if (newType === 1) await incrementCounters(1, 0);
      else await incrementCounters(0, 1);
      await conn.commit();
      return {
        action: action,
        message: `Comment ${action} updated successfully.`,
      };
    }

    // No existing rows: insert new and increment counter
    await conn.execute(
      "INSERT INTO comments_likes (user_id, comment_id, video_id, time, type) VALUES (?, ?, ?, ?, ?)",
      [uid, cid, Number(videoId) || 0, timestamp, newType]
    );
    if (newType === 1) await incrementCounters(1, 0);
    else await incrementCounters(0, 1);
    await conn.commit();
    return { action: action, message: `Comment ${action}d successfully.` };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (e) {
      // ignore rollback error
    }
    // If duplicate race occurred during insert, attempt a safe fallback outside transaction
    if (err && err.code === "ER_DUP_ENTRY") {
      // Fallback: ensure single upsert behavior
      await db.query(
        "UPDATE comments_likes SET type = ?, time = ? WHERE user_id = ? AND comment_id = ?",
        [action === "like" ? 1 : 2, Math.floor(Date.now() / 1000), uid, cid]
      );
      return {
        action,
        message: `Comment ${action} (race-handled) updated successfully.`,
      };
    }
    throw err;
  } finally {
    try {
      conn.release();
    } catch (e) {
      // ignore
    }
  }
};

export const getCommentReaction = async ({ userId, commentId }) => {
  const uid = normalizeUserId(userId);
  if (!uid) throw new HttpError("User authentication is required.", 401);

  const cid = Number(commentId);
  if (!Number.isSafeInteger(cid) || cid <= 0)
    throw new HttpError("'commentId' must be a positive integer.", 400);

  // Fetch the most recent reaction by this user for this comment
  const rows = await db.query(
    "SELECT type FROM comments_likes WHERE user_id = ? AND comment_id = ? ORDER BY id DESC LIMIT 1",
    [uid, cid]
  );

  if (!rows?.length) return null;

  const t = Number(rows[0].type);
  if (t === 1) return "like";
  if (t === 2) return "dislike";
  return null;
};

// (default export extended at end of file)

export const createCommentReport = async ({ userId, commentId, text = "" }) => {
  const uid = normalizeUserId(userId);
  if (!uid) throw new HttpError("User authentication is required.", 401);

  const cid = Number(commentId);
  if (!Number.isSafeInteger(cid) || cid <= 0)
    throw new HttpError("'commentId' must be a positive integer.", 400);

  // Verify comment exists and get its video_id if available
  const rows = await db.query(
    "SELECT id, video_id FROM comments WHERE id = ?",
    [cid]
  );
  if (!rows?.length) throw new HttpError("Comment not found.", 404);
  const videoId = Number(rows[0].video_id) || 0;

  const timestamp = Math.floor(Date.now() / 1000);

  const result = await db.query(
    "INSERT INTO reports (video_id, article_id, ad_id, comment_id, reply_id, profile_id, user_id, text, time, seen, type) VALUES (?, 0, 0, ?, 0, 0, ?, ?, ?, 0, ?)",
    [videoId, cid, uid, text || "", String(timestamp), "comment"]
  );

  const insertedId = result?.insertId;
  if (!insertedId) throw new HttpError("Unable to create report.", 500);

  const reportRows = await db.query("SELECT * FROM reports WHERE id = ?", [
    insertedId,
  ]);
  return reportRows?.[0] || null;
};

// extend default export
export default {
  postComment,
  getCommentsForVideo,
  toggleCommentLike,
  createCommentReport,
};
