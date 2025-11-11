-- Migration: create password_reset_otps table

DROP TABLE IF EXISTS `password_reset_otps`;
CREATE TABLE `password_reset_otps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL DEFAULT 0,
  `email` varchar(255) NOT NULL DEFAULT '',
  `otp` varchar(6) NOT NULL DEFAULT '',
  `expires_at` bigint NOT NULL DEFAULT 0,
  `attempts` int NOT NULL DEFAULT 0,
  `consumed` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email` (`email`),
  KEY `user_id` (`user_id`),
  KEY `expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
