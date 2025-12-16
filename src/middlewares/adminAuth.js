import db from "../models/db.js";

/**
 * Middleware to verify user is an admin or moderator
 * Must be used after passport authentication
 */
export const requireAdminOrModerator = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required." });
    }

    // Check if user has admin or moderator role
    const [rows] = await db.pool.execute(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "User not found." });
    }

    const user = rows[0];
    if (!user.role || !["admin", "moderator"].includes(user.role)) {
      console.warn(
        `Unauthorized access attempt: User ${userId} with role ${user.role}`
      );
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    // Attach user role to request for logging purposes
    req.user.role = user.role;
    next();
  } catch (err) {
    console.error("Admin verification error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred." });
  }
};

export default {
  requireAdminOrModerator,
};
