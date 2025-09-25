import db from "../models/db.js";

const emailRegex =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const validateRegistration = async (req, res, next) => {
  const { username, email, password, gender } = req.body;

  // 1. Presence checks
  if (!username || !email || !password || !gender) {
    return res.status(400).json({
      success: false,
      message: "Username, email, password, and gender are required.",
    });
  }

  // 2. Format checks
  if (username.length < 3) {
    return res.status(400).json({
      success: false,
      message: "Username must be at least 3 characters long.",
    });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long.",
    });
  }

  try {
    // 3. Uniqueness checks (run in parallel and report both if present)
    const [existingUserByUsername, existingUserByEmail] = await Promise.all([
      db.query("SELECT id FROM users WHERE username = ?", [username]),
      db.query("SELECT id FROM users WHERE email = ?", [email]),
    ]);

    const errors = [];
    if (
      Array.isArray(existingUserByUsername) &&
      existingUserByUsername.length > 0
    ) {
      errors.push({ field: "username", message: "Username is already taken." });
    }
    if (Array.isArray(existingUserByEmail) && existingUserByEmail.length > 0) {
      errors.push({
        field: "email",
        message: "An account with this email already exists.",
      });
    }

    if (errors.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "Validation failed.", errors });
    }

    // All checks passed
    next();
  } catch (error) {
    // Pass database or other unexpected errors to the global error handler
    next(error);
  }
};
