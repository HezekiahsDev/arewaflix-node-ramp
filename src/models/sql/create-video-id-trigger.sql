-- Trigger to generate a short, URL-safe, unique video_id before insert
-- Uses UNHEX(REPLACE(UUID(),'-','')) to get 16 bytes and encodes with TO_BASE64
-- Replaces +,/ and = with safe characters and takes first 16 chars
DELIMITER $$
DROP TRIGGER IF EXISTS `videos_before_insert`$$
CREATE TRIGGER `videos_before_insert`
BEFORE INSERT ON `videos`
FOR EACH ROW
BEGIN
  IF NEW.video_id IS NULL OR NEW.video_id = '' THEN
    SET NEW.video_id = LEFT(REPLACE(REPLACE(REPLACE(TO_BASE64(UNHEX(REPLACE(UUID(),'-',''))),'+','A'),'/','B'),'=',''),16);
    -- Try to ensure uniqueness (simple loop); collisions are extremely unlikely but handled
    WHILE (SELECT COUNT(*) FROM videos WHERE video_id = NEW.video_id) > 0 DO
      SET NEW.video_id = LEFT(REPLACE(REPLACE(REPLACE(TO_BASE64(UNHEX(REPLACE(UUID(),'-',''))),'+','A'),'/','B'),'=',''),16);
    END WHILE;
  END IF;
END$$
DELIMITER ;

-- Notes:
-- Run this file against your MySQL database (schema: arewaflix) to create the trigger.
-- Example: mysql -u root -p arewaflix < create-video-id-trigger.sql
