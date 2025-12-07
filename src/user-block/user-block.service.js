import db from "../models/db.js";

export const blockUser = async (blockerId, blockedId) => {
  // Insert into user_blocks table or similar
  const [result] = await db.pool.execute(
    "INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE blocker_id = blocker_id",
    [blockerId, blockedId]
  );
  return result;
};

export const unblockUser = async (blockerId, blockedId) => {
  // Delete from user_blocks
  const [result] = await db.pool.execute(
    "DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?",
    [blockerId, blockedId]
  );
  return result;
};

export const getBlockedUsers = async (userId) => {
  // Get list of blocked users with username and block date
  const [rows] = await db.pool.execute(
    "SELECT ub.blocked_id, u.username, ub.created_at FROM user_blocks ub JOIN users u ON ub.blocked_id = u.id WHERE ub.blocker_id = ? ORDER BY ub.created_at DESC",
    [userId]
  );
  return rows;
};

export default {
  blockUser,
  unblockUser,
  getBlockedUsers,
};
