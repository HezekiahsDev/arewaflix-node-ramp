export const filterBlockedComments = (
  comments,
  blockedIds = [],
  authorKey = "user_id"
) => {
  if (!Array.isArray(comments)) return comments;
  const blockedSet = new Set(
    (blockedIds || [])
      .map((n) => Number(n))
      .filter((n) => Number.isSafeInteger(n) && n > 0)
  );

  return comments.filter((c) => {
    const author = Number(c?.[authorKey] ?? c?.user_id ?? c?.userId ?? 0);
    return !blockedSet.has(author);
  });
};

export default filterBlockedComments;
