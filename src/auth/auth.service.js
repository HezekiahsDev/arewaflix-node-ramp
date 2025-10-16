import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../models/db.js";
import config from "../config/config.js";
import HttpError from "../utils/httpError.js";

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
}

export default new AuthService();
