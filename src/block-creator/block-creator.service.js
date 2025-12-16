import db from "../models/db.js";

class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const blockCreator = async ({
  creatorId,
  blockedBy,
  reason = "",
} = {}) => {
  if (!creatorId || !Number.isSafeInteger(creatorId) || creatorId <= 0) {
    throw new ApiError("'creatorId' must be a positive integer.", 400);
  }
  if (!blockedBy || !Number.isSafeInteger(blockedBy) || blockedBy <= 0) {
    throw new ApiError("'blockedBy' must be a positive integer.", 400);
  }

  // Verify creator exists (users table)
  const [creatorExists] = await db.pool.execute(
    "SELECT id FROM users WHERE id = ? LIMIT 1",
    [creatorId]
  );
  if (!creatorExists || creatorExists.length === 0) {
    throw new ApiError("Creator not found.", 404);
  }

  // Check active block for this creator by this user
  const [existingBlock] = await db.pool.execute(
    "SELECT id FROM creator_blocks WHERE creator_id = ? AND blocked_by = ? AND active = 1 LIMIT 1",
    [creatorId, blockedBy]
  );
  if (existingBlock && existingBlock.length > 0) {
    throw new ApiError("Creator is already blocked.", 409);
  }

  try {
    const [result] = await db.pool.execute(
      `INSERT INTO creator_blocks (creator_id, blocked_by, reason, active) VALUES (?, ?, ?, 1)`,
      [creatorId, blockedBy, reason]
    );

    return {
      id: result.insertId,
      creatorId,
      blockedBy,
      reason,
      active: 1,
    };
  } catch (err) {
    console.error("Database error while blocking creator:", err.message);
    throw new ApiError("Failed to block creator. Please try again.", 500);
  }
};

export const unblockCreator = async (blockId, liftedBy) => {
  if (!blockId || !Number.isSafeInteger(blockId) || blockId <= 0) {
    throw new ApiError("'blockId' must be a positive integer.", 400);
  }
  if (!liftedBy || !Number.isSafeInteger(liftedBy) || liftedBy <= 0) {
    throw new ApiError("'liftedBy' must be a positive integer.", 400);
  }

  const [blockExists] = await db.pool.execute(
    "SELECT id, active FROM creator_blocks WHERE id = ? LIMIT 1",
    [blockId]
  );
  if (!blockExists || blockExists.length === 0) {
    throw new ApiError("Block record not found.", 404);
  }
  if (!blockExists[0].active) {
    throw new ApiError("Block record is already inactive.", 409);
  }

  const liftedAt = Math.floor(Date.now() / 1000);
  try {
    const [result] = await db.pool.execute(
      `UPDATE creator_blocks SET active = 0, lifted_by = ?, lifted_at = ? WHERE id = ?`,
      [liftedBy, liftedAt, blockId]
    );
    return result;
  } catch (err) {
    console.error("Database error while unblocking creator:", err.message);
    throw new ApiError("Failed to unblock creator. Please try again.", 500);
  }
};

export const getBlockedCreators = async ({
  blockedBy = null,
  active = 1,
  limit = 100,
  offset = 0,
} = {}) => {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 500) {
    throw new ApiError("'limit' must be between 1 and 500.", 400);
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new ApiError("'offset' must be a non-negative integer.", 400);
  }

  let query = `SELECT cb.id, cb.creator_id, u.username, cb.reason, cb.blocked_by, cb.active, cb.lifted_by, cb.lifted_at, cb.created_at
               FROM creator_blocks cb
               JOIN users u ON cb.creator_id = u.id
               WHERE 1=1`;
  const params = [];

  if (active !== null && active !== undefined) {
    query += " AND cb.active = ?";
    params.push(active ? 1 : 0);
  }

  if (blockedBy !== null && blockedBy !== undefined) {
    if (!Number.isSafeInteger(blockedBy) || blockedBy <= 0) {
      throw new ApiError("'blockedBy' must be a positive integer.", 400);
    }
    query += " AND cb.blocked_by = ?";
    params.push(blockedBy);
  }

  query += " ORDER BY cb.created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  try {
    const [rows] = await db.pool.execute(query, params);
    return rows || [];
  } catch (err) {
    console.error(
      "Database error while fetching blocked creators:",
      err.message
    );
    throw new ApiError("Failed to fetch blocked creators.", 500);
  }
};

export default {
  blockCreator,
  unblockCreator,
  getBlockedCreators,
};
