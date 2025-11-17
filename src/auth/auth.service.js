import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../models/db.js";
import config from "../config/config.js";
import HttpError from "../utils/httpError.js";
import mailService from "../utils/mailService.js";
import passwordOtpStore from "./passwordOtpStore.js";

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

function sanitizeUserForClient(user) {
  if (!user || typeof user !== "object") return {};
  // Pick a small allowlist of safe public fields. Extend if you explicitly
  // want to expose more fields, but avoid returning internal flags/secrets.
  const allowed = [
    "id",
    "username",
    "email",
    "display_name",
    "first_name",
    "last_name",
    "created_at",
    "updated_at",
    "is_active",
  ];
  const out = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(user, k)) {
      out[k] = user[k];
    }
  }
  // Always include id and username if present
  if (!out.id && user.id) out.id = user.id;
  if (!out.username && user.username) out.username = user.username;
  return out;
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

    // Don't return password and only expose a minimal user object to clients
    const publicUser = sanitizeUserForClient(user);
    return { user: publicUser, token };
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

    // Persist OTP into JSON store (file-based)
    await passwordOtpStore.createOtp({
      userId,
      email,
      otp,
      expiresAt,
    });

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
    const entry = await passwordOtpStore.getLatest(email);
    if (!entry) {
      return { invalid: true };
    }

    const now = Date.now();
    if (now > Number(entry.expires_at)) {
      // Remove expired entry
      await passwordOtpStore.deleteById(entry.id);
      return { expired: true };
    }

    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      await passwordOtpStore.deleteById(entry.id);
      return { invalid: true };
    }

    if (String(entry.otp) !== String(otp)) {
      const attempts = await passwordOtpStore.incrementAttempts(entry.id);
      if (attempts !== null && attempts >= MAX_OTP_ATTEMPTS) {
        // remove if max attempts reached
        await passwordOtpStore.deleteById(entry.id);
      }
      return { invalid: true };
    }

    // Correct OTP — do NOT delete it yet. We'll delete it only after the
    // password has actually been reset (so the OTP can be used in the reset
    // endpoint). Issue a short-lived JWT for optional client flows.
    const tokenExpires = process.env.PASSWORD_RESET_TOKEN_EXPIRES || "15m";
    const payload = {
      id: rows[0].id,
      email: rows[0].email,
      purpose: "password_reset",
    };
    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: tokenExpires,
    });

    return { ok: true, token };
  }

  // Reset password using OTP and new password. Deletes the OTP only after
  // successful password update.
  async resetPassword(email, otp, newPassword) {
    email = sanitizeString(email);
    otp = sanitizeString(otp);
    newPassword = typeof newPassword === "string" ? newPassword : undefined;

    if (!isValidEmail(email)) return { invalid: true };
    if (!/^[0-9]{6}$/.test(String(otp))) return { invalid: true };
    if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
      return { invalidPassword: true };
    }

    const rows = await db.query(
      "SELECT id, email FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return { notFound: true };
    }

    const userId = rows[0].id;

    const entry = await passwordOtpStore.getLatest(email);
    if (!entry) return { invalid: true };

    const now = Date.now();
    if (now > Number(entry.expires_at)) {
      await passwordOtpStore.deleteById(entry.id);
      return { expired: true };
    }

    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      await passwordOtpStore.deleteById(entry.id);
      return { invalid: true };
    }

    if (String(entry.otp) !== String(otp)) {
      const attempts = await passwordOtpStore.incrementAttempts(entry.id);
      if (attempts !== null && attempts >= MAX_OTP_ATTEMPTS) {
        await passwordOtpStore.deleteById(entry.id);
      }
      return { invalid: true };
    }

    // OTP matches — update password and then delete the OTP
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.pool.execute("UPDATE users SET password = ? WHERE id = ?", [
      hashed,
      userId,
    ]);

    await passwordOtpStore.deleteById(entry.id);
    return { ok: true };
  }
}

export default new AuthService();
