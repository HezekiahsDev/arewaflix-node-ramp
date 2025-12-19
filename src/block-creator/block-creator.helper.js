import { getBlockedCreators } from "./block-creator.service.js";

class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Retrieve a normalized list of blocked creator IDs for a given user.
 * - By default returns an array of positive integer creator IDs (deduped).
 * - If `fullRows` is true, returns the raw rows from the service (throws on error).
 * - Fails safely to `[]` when `fullRows` is false and errors occur.
 */
export const getMyBlockedCreatorsHelper = async (
  userId,
  { fullRows = false, active = 1, limit = 500, offset = 0 } = {}
) => {
  const parsed = Number(userId);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fullRows ? [] : [];

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
    const rows = await getBlockedCreators({
      blockedBy: parsed,
      active,
      limit,
      offset,
    });
    if (fullRows) return rows || [];

    if (!Array.isArray(rows) || rows.length === 0) return [];

    const ids = Array.from(
      new Set(
        rows
          .map((r) => Number(r.creator_id ?? r.creatorId ?? r.id))
          .filter((v) => Number.isSafeInteger(v) && v > 0)
      )
    );
    return ids;
  } catch (err) {
    console.error(
      "getMyBlockedCreatorsHelper error:",
      err && err.message ? err.message : err
    );
    if (fullRows) throw err;
    return [];
  }
};

export default getMyBlockedCreatorsHelper;
