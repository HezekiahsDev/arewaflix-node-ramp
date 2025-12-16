-- Create creator_blocks table for blocking creators
-- Migration: 2025-12-16-create-creator-blocks.sql

CREATE TABLE IF NOT EXISTS `creator_blocks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int NOT NULL DEFAULT 0,
  `blocked_by` int NOT NULL DEFAULT 0,
  `reason` varchar(1000) NOT NULL DEFAULT '',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `lifted_by` int NOT NULL DEFAULT 0,
  `lifted_at` bigint NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `creator_id` (`creator_id`),
  KEY `blocked_by` (`blocked_by`),
  KEY `active` (`active`),
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
