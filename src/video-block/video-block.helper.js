import db from "../models/db.js";

/**
 * Simple API error with statusCode for compatibility with controllers
 */
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Retrieve a normalized list of blocked video IDs for a given user.
 * - Returns an array of positive integers (video ids)
 * - Returns an empty array on missing userId or on errors (fail-safe)
 */
/**
 * Retrieve blocked videos for a user.
 * Behavior:
 * - By default (fullRows = false) returns an array of numeric video IDs (deduped). Fails safely to [].
 * - If fullRows = true returns full rows (same shape as previous service) and throws on DB errors
 */
export const getMyBlockedVideosHelper = async (
  userId,
  {
    fullRows = false,
    blockType = null,
    active = 1,
    limit = 500,
    offset = 0,
  } = {}
) => {
  const parsed = Number(userId);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fullRows ? [] : [];

  // Validate pagination
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 500) {
    if (fullRows) throw new ApiError("'limit' must be between 1 and 500.", 400);
    limit = 500;
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    if (fullRows)
      throw new ApiError("'offset' must be a non-negative integer.", 400);
    offset = 0;
  }

  try {
    if (fullRows) {
      // Return rows (same shape as previous service)
      let query = `SELECT vb.id, vb.video_id, v.title, v.thumbnail, 
               vb.block_type, vb.reason, vb.blocked_by, vb.start_at, vb.end_at, vb.active, 
               vb.lifted_by, vb.lifted_at, vb.created_at, vb.updated_at
               FROM video_blocks vb
               JOIN videos v ON vb.video_id = v.id
               WHERE vb.blocked_by = ?`;
      const params = [parsed];
      if (active !== null && active !== undefined) {
        query += " AND vb.active = ?";
        params.push(active ? 1 : 0);
      }
      if (blockType) {
        query += " AND vb.block_type = ?";
        params.push(blockType);
      }
      query += " ORDER BY vb.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [rows] = await db.pool.execute(query, params);
      return rows || [];
    }

    // Only IDs (fail-safe)
    let q = "SELECT video_id FROM video_blocks WHERE blocked_by = ?";
    const p = [parsed];
    if (active !== null && active !== undefined) {
      q += " AND active = ?";
      p.push(active ? 1 : 0);
    }
    if (blockType) {
      q += " AND block_type = ?";
      p.push(blockType);
    }
    q += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    p.push(limit, offset);

    const [rows] = await db.pool.execute(q, p);
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const ids = Array.from(
      new Set(
        rows
          .map((r) => Number(r.video_id ?? r.videoId ?? r.id))
          .filter((v) => Number.isSafeInteger(v) && v > 0)
      )
    );
    return ids;
  } catch (err) {
    console.error(
      "getMyBlockedVideosHelper error:",
      err && err.message ? err.message : err
    );
    if (fullRows) throw err;
    return [];
  }
};

export default getMyBlockedVideosHelper;
