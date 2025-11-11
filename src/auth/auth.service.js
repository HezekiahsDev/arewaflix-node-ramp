import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../models/db.js";
import config from "../config/config.js";
import HttpError from "../utils/httpError.js";

// In-memory OTP store: Map<email, { otp: string, expiresAt: number, attempts: number }>
const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

async function sendOtpByEmail(email, otp) {
  // Placeholder email sender. Replace with real email provider (nodemailer, SES, SendGrid, etc.)
  // Keep this asynchronous to allow easy replacement.
  console.log(`Sending OTP ${otp} to ${email}`);
  return Promise.resolve();
}

function isValidEmail(email) {
  // Simple email validation to avoid obvious invalid input
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

class AuthService {
  async login(userData) {
    const { identifier, password } = userData;

    // Find by username or email
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

    otpStore.set(email, { otp, expiresAt, attempts: 0 });

    // Send OTP via email (placeholder)
    await sendOtpByEmail(email, otp);

    return { ok: true };
  }

  async verifyPasswordOtp(email, otp) {
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

    const entry = otpStore.get(email);
    if (!entry) {
      return { invalid: true };
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(email);
      return { expired: true };
    }

    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      otpStore.delete(email);
      return { invalid: true };
    }

    if (entry.otp !== String(otp)) {
      entry.attempts += 1;
      otpStore.set(email, entry);
      return { invalid: true };
    }

    // Successful verification — consume OTP
    otpStore.delete(email);
    return { ok: true };
  }
}

export default new AuthService();
