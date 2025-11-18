import db from "../models/db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const findAll = async () => {
  // Try to query a `users` table if it exists in the imported SQL structure.
  try {
    const rows = await db.query(
      "SELECT id, username, email, first_name, last_name FROM users LIMIT 10",
      []
    );
    if (Array.isArray(rows)) return rows;
    // If table exists but empty, return empty array
    return [];
  } catch (err) {
    // If something goes wrong (table not found, DB not configured), fall back to placeholder
    console.warn(
      "DB query failed in users.service.findAll — falling back to placeholder:",
      err.message
    );
    return [{ id: 1, name: "John Doe" }];
  }
};

export const findById = async (id) => {
  const [rows] = await db.pool.execute("SELECT * FROM users WHERE id = ?", [
    id,
  ]);
  const user = rows[0];
  if (user) {
    delete user.password;
  }
  return user;
};

export const deleteById = async (id) => {
  // Delete a user by id. Returns the raw result from mysql2 which includes affectedRows.
  const [result] = await db.pool.execute("DELETE FROM users WHERE id = ?", [
    id,
  ]);
  return result;
};

function hmacHash(value) {
  if (!value) return null;
  const secret = process.env.DELETED_ACCOUNTS_HMAC_SECRET || null;
  const normalized = String(value).trim().toLowerCase();
  if (secret) {
    return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
  }
  // Fallback to plain sha256 if secret not provided (less secure)
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export const deleteAndArchiveById = async (
  id,
  deletedBy = "user",
  deletionReason = null,
  ipAddress = null,
  userAgent = null
) => {
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [id]
    );
    const user = rows && rows[0];
    if (!user) {
      await conn.rollback();
      conn.release();
      return { notFound: true };
    }

    // Build exported data snapshot (omit password)
    const exported = { ...user };
    delete exported.password;

    const emailHash = hmacHash(user.email || null);
    const usernameHash = hmacHash(user.username || null);

    const retentionDays = Number(
      process.env.DELETED_ACCOUNTS_RETENTION_DAYS ||
        process.env.RETENTION_DAYS ||
        365
    );
    const retentionUntil =
      retentionDays > 0
        ? new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
        : null;
    const retentionUntilSql = retentionUntil
      ? retentionUntil.toISOString().slice(0, 19).replace("T", " ")
      : null;

    // Insert into deleted_accounts (store hashes, minimal plaintext in exported_data)
    const insertSql = `INSERT INTO deleted_accounts (
      user_id, username_hash, email_hash, first_name, last_name, display_name,
      exported_data, deleted_by, deletion_reason, retention_until, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await conn.execute(insertSql, [
      user.id,
      usernameHash,
      emailHash,
      user.first_name || null,
      user.last_name || null,
      user.display_name || null,
      JSON.stringify(exported),
      deletedBy,
      deletionReason,
      retentionUntilSql,
      ipAddress,
      userAgent,
    ]);

    // Remove or anonymize related user data across several tables.
    // Delete interactions that should not remain after account deletion.
    const deletes = [
      ["DELETE FROM comments WHERE user_id = ?", [id]],
      ["DELETE FROM comments_likes WHERE user_id = ?", [id]],
      ["DELETE FROM likes_dislikes WHERE user_id = ?", [id]],
      ["DELETE FROM views WHERE user_id = ?", [id]],
      ["DELETE FROM saved_videos WHERE user_id = ?", [id]],
      ["DELETE FROM watch_later WHERE user_id = ?", [id]],
      ["DELETE FROM history WHERE user_id = ?", [id]],
      ["DELETE FROM backup_codes WHERE user_id = ?", [id]],
      ["DELETE FROM sessions WHERE user_id = ?", [id]],
      ["DELETE FROM playlist_subscribers WHERE subscriber_id = ?", [id]],
      ["DELETE FROM notifications WHERE notifier_id = ?", [id]],
      ["DELETE FROM notifications WHERE recipient_id = ?", [id]],
      ["DELETE FROM comments WHERE user_id = ?", [id]],
    ];

    for (const [sql, params] of deletes) {
      try {
        await conn.execute(sql, params);
      } catch (e) {
        // Log and continue — do not abort deletion for one-table failure
        console.warn(
          "deleteAndArchiveById: cleanup failed",
          sql,
          e && e.message
        );
      }
    }

    // For content-owned tables, anonymize by setting user_id = 0
    const anonymize = [
      ["UPDATE videos SET user_id = 0 WHERE user_id = ?", [id]],
      ["UPDATE uploaded_videos SET user_id = 0 WHERE user_id = ?", [id]],
      ["UPDATE pt_posts SET user_id = 0 WHERE user_id = ?", [id]],
    ];
    for (const [sql, params] of anonymize) {
      try {
        await conn.execute(sql, params);
      } catch (e) {
        console.warn(
          "deleteAndArchiveById: anonymize failed",
          sql,
          e && e.message
        );
      }
    }

    // Finally delete the user row
    const [delResult] = await conn.execute("DELETE FROM users WHERE id = ?", [
      id,
    ]);

    await conn.commit();
    conn.release();
    return delResult;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (e) {}
    conn.release();
    throw err;
  }
};

export const changePassword = async (id, oldPassword, newPassword) => {
  // Fetch the current hashed password
  const [rows] = await db.pool.execute(
    "SELECT password FROM users WHERE id = ?",
    [id]
  );
  const user = rows[0];
  if (!user) {
    return { notFound: true };
  }

  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) {
    return { incorrectOldPassword: true };
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  const [result] = await db.pool.execute(
    "UPDATE users SET password = ? WHERE id = ?",
    [hashed, id]
  );
  return result;
};

export const register = async (userData) => {
  // Only allow a fixed set of fields to be created to avoid privilege escalation
  const allowed = [
    "username",
    "email",
    "password",
    "gender",
    "first_name",
    "last_name",
    "display_name",
  ];

  const payload = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(userData, k)) {
      payload[k] = userData[k];
    }
  }

  if (!payload.username || !payload.email || !payload.password) {
    throw new Error("username, email and password are required");
  }

  // Hash password
  payload.password = await bcrypt.hash(payload.password, 10);

  const columns = Object.keys(payload);
  const values = Object.values(payload);
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO users (${columns.join(
    ", "
  )}) VALUES (${placeholders})`;

  const [result] = await db.pool.execute(sql, values);

  // Fetch the created user
  const [rows] = await db.pool.execute("SELECT * FROM users WHERE id = ?", [
    result.insertId,
  ]);
  const user = rows[0];

  // Don't return password and only return safe fields
  if (user) delete user.password;
  return user;
};

export default { findAll, register, findById, deleteById, changePassword };
