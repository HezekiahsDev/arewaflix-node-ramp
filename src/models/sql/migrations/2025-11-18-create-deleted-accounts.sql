-- Migration: create deleted_accounts table
-- Purpose: store a GDPR-aware record of deleted user accounts. The table
-- contains minimal personal identifiers plus pseudonymized hashes, a JSON
-- snapshot of exported data, and metadata useful for retention/legal basis.
-- Adjust columns/lengths to match your policy. This file is intended for MySQL.

DROP TABLE IF EXISTS `deleted_accounts`;
CREATE TABLE `deleted_accounts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NULL COMMENT 'Original users.id (nullable if removed)',
  `username_hash` VARCHAR(128) NULL COMMENT 'SHA-256 hex of username for pseudonymized lookup',
  `email_hash` VARCHAR(128) NULL COMMENT 'SHA-256 hex of email for pseudonymized lookup',
  `first_name` VARCHAR(150) NULL,
  `last_name` VARCHAR(150) NULL,
  `display_name` VARCHAR(150) NULL,
  `exported_data` JSON NULL COMMENT 'Optional JSON snapshot of user data exported before deletion',
  `deleted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_by` VARCHAR(150) NULL COMMENT 'Who requested/deleted (system/admin/email)',
  `deletion_reason` VARCHAR(255) NULL,
  `legal_basis` VARCHAR(255) NULL COMMENT 'Legal basis or retention reason (e.g., tax, fraud)',
  `retention_until` DATETIME NULL COMMENT 'If data must be retained until a date by law/policy',
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(512) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_deleted_accounts_user_id` (`user_id`),
  INDEX `idx_deleted_accounts_email_hash` (`email_hash`),
  INDEX `idx_deleted_accounts_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notes:
-- 1) Storing plain emails/usernames in deleted records can be a privacy risk.
--    Consider storing only hashes (SHA-256) in `email_hash` / `username_hash` and
--    move plain values to `exported_data` when necessary and justified.
-- 2) `exported_data` can contain a JSON snapshot of the user's profile and
--    any consent flags. Keep exported_data minimal and avoid long-term storage
--    of sensitive identifiers unless required by law.
-- 3) `retention_until` should be set according to your retention policy and
--    cleared/removed after that date via scheduled job.
