import userBlockService from "./user-block.service.js";

export const blockUser = async (req, res, next) => {
  try {
    if (req.user.id == req.params.userId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request." });
    }
    const result = await userBlockService.blockUser(
      req.user.id,
      req.params.userId
    );
    if (result.affectedRows === 0) {
      return res
        .status(409)
        .json({ success: false, message: "Already blocked." });
    }
    return res.json({ success: true, message: "User blocked." });
  } catch (err) {
    console.error("Block user error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred." });
  }
};

export const unblockUser = async (req, res, next) => {
  try {
    if (req.user.id == req.params.userId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request." });
    }
    const result = await userBlockService.unblockUser(
      req.user.id,
      req.params.userId
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Not blocked." });
    }
    return res.json({ success: true, message: "User unblocked." });
  } catch (err) {
    console.error("Unblock user error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred." });
  }
};

export const getBlockedUsers = async (req, res, next) => {
  try {
    const blockedUsers = await userBlockService.getBlockedUsers(req.user.id);
    return res.json({ success: true, data: blockedUsers });
  } catch (err) {
    console.error("Get blocked users error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred." });
  }
};
