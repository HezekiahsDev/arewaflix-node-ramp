import db from "../models/db.js";

// Fetch paginated videos from the database with safe defaults and a graceful fallback
export const findPaginated = async ({
  page = 1,
  limit = 20,
  approved,
  privacy,
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
    if (privacy !== undefined) {
      whereClauses.push("privacy = ?");
      whereValues.push(Number(privacy));
    }
    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // Count total
    const totalRows = await db.query(
      `SELECT COUNT(*) as total FROM videos ${whereSql}`,
      whereValues
    );
    const total = Number(totalRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    if (safePage > totalPages) safePage = totalPages;
    offset = (safePage - 1) * safeLimit;

    // Fetch page of videos
    const rows = await db.query(
      `SELECT id, video_id, short_id, title, description, thumbnail, duration, views, user_id, time_date
       FROM videos
       ${whereSql}
       ORDER BY publication_date DESC, time DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      whereValues
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

export default { findPaginated };
