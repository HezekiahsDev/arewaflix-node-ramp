import db from "../models/db.js";

/**
 * Create a custom error with status code
 */
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const blockVideo = async ({
  videoId,
  blockedBy,
  blockType = "manual",
  reason = "",
  startAt = 0,
  endAt = 0,
} = {}) => {
  // Validate inputs
  if (!videoId || !Number.isSafeInteger(videoId) || videoId <= 0) {
    throw new ApiError("'videoId' must be a positive integer.", 400);
  }

  if (!blockedBy || !Number.isSafeInteger(blockedBy) || blockedBy <= 0) {
    throw new ApiError("'blockedBy' must be a positive integer.", 400);
  }

  if (typeof reason !== "string") {
    throw new ApiError("'reason' must be a string.", 400);
  }

  if (!Number.isSafeInteger(startAt) || startAt < 0) {
    throw new ApiError("'startAt' must be a non-negative integer.", 400);
  }

  if (!Number.isSafeInteger(endAt) || endAt < 0) {
    throw new ApiError("'endAt' must be a non-negative integer.", 400);
  }

  // Check if video exists
  const [videoExists] = await db.pool.execute(
    "SELECT id FROM videos WHERE id = ? LIMIT 1",
    [videoId]
  );

  if (!videoExists || videoExists.length === 0) {
    throw new ApiError("Video not found.", 404);
  }

  // Check if active block already exists for this video
  const [existingBlock] = await db.pool.execute(
    "SELECT id FROM video_blocks WHERE video_id = ? AND active = 1 LIMIT 1",
    [videoId]
  );

  if (existingBlock && existingBlock.length > 0) {
    throw new ApiError("Video is already blocked.", 409);
  }

  try {
    // Insert into video_blocks table with parameterized query
    const [result] = await db.pool.execute(
      `INSERT INTO video_blocks 
       (video_id, blocked_by, block_type, reason, start_at, end_at, active) 
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [videoId, blockedBy, blockType, reason, startAt, endAt]
    );

    return {
      id: result.insertId,
      videoId,
      blockedBy,
      blockType,
      reason,
      startAt,
      endAt,
      active: 1,
    };
  } catch (err) {
    console.error("Database error while blocking video:", err.message);
    throw new ApiError("Failed to block video. Please try again.", 500);
  }
};

export const unblockVideo = async (blockId, liftedBy) => {
  // Validate inputs
  if (!blockId || !Number.isSafeInteger(blockId) || blockId <= 0) {
    throw new ApiError("'blockId' must be a positive integer.", 400);
  }

  if (!liftedBy || !Number.isSafeInteger(liftedBy) || liftedBy <= 0) {
    throw new ApiError("'liftedBy' must be a positive integer.", 400);
  }

  // Verify the block exists before updating
  const [blockExists] = await db.pool.execute(
    "SELECT id, active FROM video_blocks WHERE id = ? LIMIT 1",
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
    // Update the block record to mark it as lifted
    const [result] = await db.pool.execute(
      `UPDATE video_blocks 
       SET active = 0, lifted_by = ?, lifted_at = ? 
       WHERE id = ?`,
      [liftedBy, liftedAt, blockId]
    );

    return result;
  } catch (err) {
    console.error("Database error while unblocking video:", err.message);
    throw new ApiError("Failed to unblock video. Please try again.", 500);
  }
};

export default {
  blockVideo,
  unblockVideo,
};
