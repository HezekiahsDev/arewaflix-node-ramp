-- Create user_blocks table for user blocking functionality
-- Migration: 2025-12-07-create-user-blocks.sql

CREATE TABLE IF NOT EXISTS `user_blocks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `blocker_id` int NOT NULL,
  `blocked_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_block` (`blocker_id`, `blocked_id`),
  KEY `blocker_id` (`blocker_id`),
  KEY `blocked_id` (`blocked_id`),
  CONSTRAINT `user_blocks_ibfk_1` FOREIGN KEY (`blocker_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_blocks_ibfk_2` FOREIGN KEY (`blocked_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;