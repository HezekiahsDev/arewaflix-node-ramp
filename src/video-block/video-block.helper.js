import { getBlockedVideos } from "./video-block.service.js";

/**
 * Retrieve a normalized list of blocked video IDs for a given user.
 * - Returns an array of positive integers (video ids)
 * - Returns an empty array on missing userId or on errors (fail-safe)
 */
export const getMyBlockedVideosHelper = async (userId) => {
  const parsed = Number(userId);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return [];

  try {
    // Fetch blocked videos for the user. Use a reasonable limit (service enforces max 500).
    const rows = await getBlockedVideos({
      blockedBy: parsed,
      active: 1,
      limit: 500,
      offset: 0,
    });
    if (!Array.isArray(rows) || rows.length === 0) return [];

    // Normalize video ids to numbers and filter out invalid values
    const ids = rows
      .map((r) => {
        const v = Number(r.video_id ?? r.videoId ?? r.id);
        return Number.isSafeInteger(v) && v > 0 ? v : null;
      })
      .filter((v) => v !== null);

    // Deduplicate
    return Array.from(new Set(ids));
  } catch (err) {
    console.error(
      "getMyBlockedVideosHelper error:",
      err && err.message ? err.message : err
    );
    // Fail-safe: return empty array so callers can return unfiltered videos
    return [];
  }
};

export default getMyBlockedVideosHelper;
