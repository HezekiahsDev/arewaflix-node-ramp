-- Migration: dedupe likes_dislikes and add UNIQUE(user_id, video_id)
-- Run this on a development/staging DB before production. Make a backup first.

START TRANSACTION;

-- 1) Remove exact duplicate rows keeping the most recent `time` per (user_id, video_id)
DELETE ld1 FROM likes_dislikes ld1
INNER JOIN likes_dislikes ld2
  ON ld1.user_id = ld2.user_id
  AND ld1.video_id = ld2.video_id
  AND ld1.id < ld2.id;

-- Optionally, if you prefer to keep the latest by `time` instead of id, use:
-- DELETE ld1 FROM likes_dislikes ld1
-- INNER JOIN likes_dislikes ld2
--   ON ld1.user_id = ld2.user_id
--   AND ld1.video_id = ld2.video_id
--   AND (ld1.time < ld2.time OR (ld1.time = ld2.time AND ld1.id < ld2.id));

-- 2) Add unique constraint to prevent future duplicates
ALTER TABLE likes_dislikes
  ADD UNIQUE KEY ux_user_video (user_id, video_id);

COMMIT;

-- Note: If the ALTER TABLE fails because the key already exists, skip that step.
-- If you prefer a safer approach, run the DELETE first, then run:
-- SHOW INDEX FROM likes_dislikes WHERE Key_name = 'ux_user_video';
-- and only run ALTER TABLE if it doesn't exist.
