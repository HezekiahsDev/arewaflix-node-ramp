// Sanitize notification rows retrieved from the DB before sending to clients.
// Only include safe and necessary fields. Do not expose internal flags like `admin`.

export const sanitizeNotification = (row) => {
  if (!row) return null;

  // Normalize commonly used fields from the legacy schema
  const id = row.id ?? null;
  const notifierId = row.notifier_id ?? null;
  const recipientId = row.recipient_id ?? null;
  const videoId = row.video_id ?? null;
  const type = row.type ?? null;
  const text = row.text ?? null;
  const url = row.url ?? null;
  const seen = row.seen === "1" || row.seen === 1 || row.seen === true;
  // `time` in this DB is stored as a varchar; try to convert to number when possible
  const time = (() => {
    if (row.time === undefined || row.time === null) return null;
    const asNum = Number(row.time);
    return Number.isFinite(asNum) ? asNum : String(row.time);
  })();
  const sentPush = Boolean(row.sent_push);
  const fullLink = row.full_link ?? null;

  return {
    id,
    notifierId,
    recipientId,
    videoId,
    type,
    text,
    url,
    seen,
    time,
    sentPush,
    fullLink,
  };
};

export const sanitizeNotificationsList = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map(sanitizeNotification);
};

export default {
  sanitizeNotification,
  sanitizeNotificationsList,
};
