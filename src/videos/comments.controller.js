import { postComment, getCommentsForVideo } from "./comments.service.js";

const extractUserId = (req) => {
  const authUser = req?.user;
  if (!authUser) return null;
  const candidates = [authUser.id, authUser.user_id, authUser.ID];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

export const createComment = async (req, res, next) => {
  try {
    const userId = extractUserId(req);
    if (!userId)
      return res.status(401).json({ error: "Authentication required." });

    const videoId = Number(req.params.id);
    const text = req.body?.text;

    const created = await postComment({ userId, videoId, text });
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
};

export const fetchComments = async (req, res, next) => {
  try {
    const videoId = Number(req.params.id);
    const { page, limit } = req.query;
    const result = await getCommentsForVideo({ videoId, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export default { createComment, fetchComments };
