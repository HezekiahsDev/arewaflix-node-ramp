import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../models/db.js";
import config from "../config/config.js";
import HttpError from "../utils/httpError.js";
import mailService from "../utils/mailService.js";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

function isValidEmail(email) {
  // Simple email validation to avoid obvious invalid input
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(v) {
  return typeof v === "string" && /^[a-zA-Z0-9_]{3,30}$/.test(v);
}

function sanitizeString(v) {
  return typeof v === "string" ? v.trim() : undefined;
}

class AuthService {
  async login(userData) {
    let { identifier, password } = userData;
    identifier = sanitizeString(identifier);
    password = typeof password === "string" ? password : undefined;

    // Basic input checks
    if (!identifier || !password) {
      throw new HttpError("username/email and password are required.", 400);
    }
    if (password.length < 8 || password.length > 128) {
      throw new HttpError("Invalid credentials.", 401);
    }

    // Find by username or email (parameterized query prevents SQL injection)
    const rows = await db.query(
      "SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1",
      [identifier, identifier]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new HttpError("Invalid credentials.", 401);
    }

    const user = rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new HttpError("Invalid credentials.", 401);
    }

    // Generate token (include username in payload)
    const payload = { id: user.id, username: user.username };
    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    // Don't return password
    delete user.password;

    return { user, token };
  }

  async requestPasswordReset(email) {
    email = sanitizeString(email);
    if (!isValidEmail(email)) {
      return { invalid: true };
    }

    // Verify email exists (use parameterized query to prevent SQL injection)
    const rows = await db.query(
      "SELECT id, email FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return { notFound: true };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + OTP_TTL_MS;

    const userId = rows[0].id;

    // Persist OTP into DB
    await db.pool.execute(
      "INSERT INTO password_reset_otps (user_id, email, otp, expires_at, attempts, consumed) VALUES (?, ?, ?, ?, 0, 0)",
      [userId, email, otp, expiresAt]
    );

    // Send OTP via configured mail service (may log if SMTP not configured)
    await mailService.sendPasswordResetOtp(email, otp);

    return { ok: true };
  }

  async verifyPasswordOtp(email, otp) {
    email = sanitizeString(email);
    otp = sanitizeString(otp);
    if (!isValidEmail(email)) {
      return { invalid: true };
    }
    if (!/^[0-9]{6}$/.test(String(otp))) {
      return { invalid: true };
    }

    // Verify email exists first
    const rows = await db.query(
      "SELECT id, email FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return { notFound: true };
    }

    // Find the most recent unconsumed OTP for this email
    const [otpRows] = await db.pool.execute(
      "SELECT * FROM password_reset_otps WHERE email = ? AND consumed = 0 ORDER BY created_at DESC LIMIT 1",
      [email]
    );
    const entry = otpRows[0];
    if (!entry) {
      return { invalid: true };
    }

    const now = Date.now();
    if (now > Number(entry.expires_at)) {
      // Mark consumed to avoid reuse
      await db.pool.execute(
        "UPDATE password_reset_otps SET consumed = 1 WHERE id = ?",
        [entry.id]
      );
      return { expired: true };
    }

    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      await db.pool.execute(
        "UPDATE password_reset_otps SET consumed = 1 WHERE id = ?",
        [entry.id]
      );
      return { invalid: true };
    }

    if (String(entry.otp) !== String(otp)) {
      await db.pool.execute(
        "UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?",
        [entry.id]
      );
      return { invalid: true };
    }

    // Correct OTP — mark as consumed
    await db.pool.execute(
      "UPDATE password_reset_otps SET consumed = 1 WHERE id = ?",
      [entry.id]
    );
    return { ok: true };
  }
}

export default new AuthService();
