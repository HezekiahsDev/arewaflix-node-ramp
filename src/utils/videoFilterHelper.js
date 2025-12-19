import getMyBlockedCreatorsHelper from "../block-creator/block-creator.helper.js";
import getMyBlockedVideosHelper from "../video-block/video-block.helper.js";

/**
 * Build WHERE clause conditions and parameters to filter out:
 * 1. Videos blocked by the current user (from video_blocks table)
 * 2. Videos created by creators blocked by the current user (from creator_blocks table)
 * 3. Videos from users blocked by the current user (from user_blocks table)
 *
 * @param {number|null} userId - The ID of the requesting user
 * @returns {Promise<{whereClauses: string[], whereValues: any[]}>}
 */
export const buildVideoFilterConditions = async (
  userId,
  { includeUserBlocks = true } = {}
) => {
  const whereClauses = [];
  const whereValues = [];

  // If no authenticated user, return empty filters
  if (!userId || !Number.isSafeInteger(userId) || userId <= 0) {
    return { whereClauses, whereValues };
  }

  try {
    // Get all videos blocked by this user (active blocks only) via helper
    // The helper returns a normalized array of video ids and fails safely to []
    const blockedVideoIdsFromHelper = await getMyBlockedVideosHelper(userId);

    // Get all creators blocked by this user (active blocks only) via helper
    // The helper returns a normalized array of creator ids (or full rows when needed)
    const blockedCreatorsFromHelper = await getMyBlockedCreatorsHelper(userId, {
      fullRows: false,
      active: 1,
      limit: 500,
      offset: 0,
    });

    // Helper to coerce and validate integer ids (handles numeric strings)
    const normalizeId = (v) => {
      if (v === undefined || v === null) return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      const i = Math.trunc(n);
      if (i <= 0) return null;
      return i;
    };

    // Use helper output (already normalized ints). Validate and dedupe defensively.
    const blockedVideoIds = Array.from(
      new Set(
        (blockedVideoIdsFromHelper || [])
          .map((v) => normalizeId(v))
          .filter((id) => id !== null)
      )
    );

    // Extract creator IDs that are blocked (coerce, filter, dedupe)
    const blockedCreatorIds = Array.from(
      new Set(
        (blockedCreatorsFromHelper || [])
          .map((v) => normalizeId(v))
          .filter((id) => id !== null)
      )
    );

    // Optional debug logging: enable by setting DEBUG_VIDEO_FILTER=1 in env
    try {
      if (process.env.DEBUG_VIDEO_FILTER === "1") {
        // Keep logs concise and structured
        console.debug(
          "videoFilterHelper:blockedVideoIds",
          blockedVideoIds,
          "blockedCreatorIds",
          blockedCreatorIds
        );
      }
    } catch (e) {
      // swallow debug logging errors
    }

    // Exclude blocked videos by video ID
    if (blockedVideoIds.length > 0) {
      const placeholders = blockedVideoIds.map(() => "?").join(", ");
      whereClauses.push(`id NOT IN (${placeholders})`);
      whereValues.push(...blockedVideoIds);
    }

    // Exclude videos from blocked creators
    if (blockedCreatorIds.length > 0) {
      const placeholders = blockedCreatorIds.map(() => "?").join(", ");
      whereClauses.push(`user_id NOT IN (${placeholders})`);
      whereValues.push(...blockedCreatorIds);
    }

    // Exclude videos from users blocked via user_blocks table (optional)
    if (includeUserBlocks) {
      // For debugging, optionally fetch list of blocked user ids
      if (process.env.DEBUG_VIDEO_FILTER === "1") {
        try {
          const [blockedUsers] = await (
            await import("../models/db.js")
          ).default.pool.execute(
            "SELECT blocked_id FROM user_blocks WHERE blocker_id = ?",
            [userId]
          );
          console.debug(
            "videoFilterHelper:blockedUserIds",
            (blockedUsers || []).map((r) => r.blocked_id)
          );
        } catch (e) {}
      }

      // Use NOT EXISTS to avoid surprising behavior if subquery contains NULLs
      whereClauses.push(
        "NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = ? AND ub.blocked_id = videos.user_id)"
      );
      whereValues.push(userId);
    }
  } catch (err) {
    console.error("Error building video filter conditions:", err.message);
    // On error, still apply user_blocks filtering as a fallback (use NOT EXISTS)
    if (includeUserBlocks) {
      whereClauses.push(
        "NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = ? AND ub.blocked_id = videos.user_id)"
      );
      whereValues.push(userId);
    }
  }

  return { whereClauses, whereValues };
};

/**
 * Apply video filtering to exclude blocked videos and videos from blocked creators
 * This is a convenience function that can be used in video queries
 *
 * @param {number|null} userId - The ID of the requesting user
 * @param {string[]} existingWhereClauses - Existing WHERE clauses
 * @param {any[]} existingWhereValues - Existing WHERE values
 * @returns {Promise<{whereClauses: string[], whereValues: any[]}>}
 */
export const applyVideoFiltering = async (
  userId,
  existingWhereClauses = [],
  existingWhereValues = [],
  options = {}
) => {
  const { whereClauses: filterClauses, whereValues: filterValues } =
    await buildVideoFilterConditions(userId, options);

  return {
    whereClauses: [...existingWhereClauses, ...filterClauses],
    whereValues: [...existingWhereValues, ...filterValues],
  };
};

export default {
  buildVideoFilterConditions,
  applyVideoFiltering,
};
