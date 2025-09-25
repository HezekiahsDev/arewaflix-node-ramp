import { findPaginated } from "./videos.service.js";

export const getAllVideos = async (req, res, next) => {
  try {
    const { page, limit, approved, privacy } = req.query;
    const filters = {};
    if (approved !== undefined && approved !== "") {
      const a = Number(approved);
      if (!Number.isNaN(a)) filters.approved = a;
    }
    if (privacy !== undefined && privacy !== "") {
      const p = Number(privacy);
      if (!Number.isNaN(p)) filters.privacy = p;
    }

    const result = await findPaginated({ page, limit, ...filters });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export default { getAllVideos };
