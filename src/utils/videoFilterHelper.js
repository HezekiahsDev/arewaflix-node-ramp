import { getBlockedVideos } from "../video-block/video-block.service.js";
import { getBlockedCreators } from "../block-creator/block-creator.service.js";

/**
 * Build WHERE clause conditions and parameters to filter out:
 * 1. Videos blocked by the current user (from video_blocks table)
 * 2. Videos created by creators blocked by the current user (from creator_blocks table)
 * 3. Videos from users blocked by the current user (from user_blocks table)
 *
 * @param {number|null} userId - The ID of the requesting user
 * @returns {Promise<{whereClauses: string[], whereValues: any[]}>}
 */
export const buildVideoFilterConditions = async (userId) => {
  const whereClauses = [];
  const whereValues = [];

  // If no authenticated user, return empty filters
  if (!userId || !Number.isSafeInteger(userId) || userId <= 0) {
    return { whereClauses, whereValues };
  }

  try {
    // Get all videos blocked by this user (active blocks only)
    const blockedVideos = await getBlockedVideos({
      blockedBy: userId,
      active: 1,
      limit: 500, // Get maximum allowed
      offset: 0,
    });

    // Get all creators blocked by this user (active blocks only)
    const blockedCreators = await getBlockedCreators({
      blockedBy: userId,
      active: 1,
      limit: 500, // Get maximum allowed
      offset: 0,
    });

    // Extract video IDs that are blocked
    const blockedVideoIds = blockedVideos
      .map((block) => block.video_id)
      .filter((id) => Number.isSafeInteger(id) && id > 0);

    // Extract creator IDs that are blocked
    const blockedCreatorIds = blockedCreators
      .map((block) => block.creator_id)
      .filter((id) => Number.isSafeInteger(id) && id > 0);

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

    // Exclude videos from users blocked via user_blocks table
    whereClauses.push(
      "user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)"
    );
    whereValues.push(userId);
  } catch (err) {
    console.error("Error building video filter conditions:", err.message);
    // On error, still apply user_blocks filtering as a fallback
    whereClauses.push(
      "user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)"
    );
    whereValues.push(userId);
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
  existingWhereValues = []
) => {
  const { whereClauses: filterClauses, whereValues: filterValues } =
    await buildVideoFilterConditions(userId);

  return {
    whereClauses: [...existingWhereClauses, ...filterClauses],
    whereValues: [...existingWhereValues, ...filterValues],
  };
};

export default {
  buildVideoFilterConditions,
  applyVideoFiltering,
};
