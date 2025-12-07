import authService from "./auth.service.js";

// Basic validators/sanitizers kept local to avoid adding a dependency.
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/; // allow alphanumeric + underscore, 3-30 chars
const otpRegex = /^[0-9]{6}$/;

function sanitizeString(v) {
  return typeof v === "string" ? v.trim() : undefined;
}

function isValidEmail(v) {
  return typeof v === "string" && emailRegex.test(v);
}

function isValidUsername(v) {
  return typeof v === "string" && usernameRegex.test(v);
}

function isValidPassword(v) {
  return typeof v === "string" && v.length >= 8 && v.length <= 16;
}

class AuthController {
  async login(req, res, next) {
    try {
      // Sanitize inputs
      const rawUsername = sanitizeString(req.body && req.body.username);
      const rawEmail = sanitizeString(req.body && req.body.email);
      const rawPassword =
        typeof req.body?.password === "string" ? req.body.password : undefined;

      // Determine identifier
      let identifier;
      if (rawEmail && isValidEmail(rawEmail)) {
        identifier = rawEmail;
      } else if (rawUsername && isValidUsername(rawUsername)) {
        identifier = rawUsername;
      }

      if (!identifier) {
        return res.status(400).json({
          success: false,
          message: "Invalid input",
        });
      }

      if (!isValidPassword(rawPassword)) {
        return res.status(400).json({
          success: false,
          message: "Invalid input",
        });
      }

      // Call service with sanitized identifier and password
      const data = await authService.login({
        identifier,
        password: rawPassword,
      });
      return res
        .status(200)
        .json({ success: true, message: "User logged in successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async requestPasswordReset(req, res, next) {
    try {
      const rawEmail = sanitizeString(req.body && req.body.email);
      if (!rawEmail || !isValidEmail(rawEmail) || rawEmail.length > 254) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid input" });
      }

      const result = await authService.requestPasswordReset(rawEmail);
      if (result && result.notFound) {
        return res
          .status(404)
          .json({ success: false, message: "Invalid credentials" });
      }

      // Do not include the OTP in the response. Email sending is handled in service.
      return res.json({
        success: true,
        message: "OTP sent to email if it exists",
      });
    } catch (err) {
      return next(err);
    }
  }

  async verifyPasswordOtp(req, res, next) {
    try {
      const rawEmail = sanitizeString(req.body && req.body.email);
      const rawOtp = sanitizeString(req.body && req.body.otp);

      if (!rawEmail || !isValidEmail(rawEmail)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid input" });
      }
      if (!rawOtp || !otpRegex.test(rawOtp)) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }

      const result = await authService.verifyPasswordOtp(rawEmail, rawOtp);

      if (result && result.notFound) {
        return res
          .status(404)
          .json({ success: false, message: "Invalid credentials" });
      }
      if (result && result.expired) {
        return res.status(400).json({ success: false, message: "OTP expired" });
      }
      if (result && result.invalid) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }

      // Success: OTP verified. Return a short-lived token the client can use
      // to optionally authorize the password reset operation.
      return res.json({
        success: true,
        message: "OTP verified",
        token: result.token,
      });
    } catch (err) {
      return next(err);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const rawEmail = sanitizeString(req.body && req.body.email);
      const rawOtp = sanitizeString(req.body && req.body.otp);
      const rawPassword =
        typeof req.body?.password === "string" ? req.body.password : undefined;

      if (!rawEmail || !isValidEmail(rawEmail)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid input" });
      }
      if (!rawOtp || !otpRegex.test(rawOtp)) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }
      if (!isValidPassword(rawPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must be 8-24 characters",
        });
      }

      const result = await authService.resetPassword(
        rawEmail,
        rawOtp,
        rawPassword
      );

      if (result && result.notFound) {
        return res
          .status(404)
          .json({ success: false, message: "Email not found" });
      }
      if (result && result.expired) {
        return res.status(400).json({ success: false, message: "OTP expired" });
      }
      if (result && result.invalid) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP or too many attempts",
        });
      }
      if (result && result.invalidPassword) {
        return res.status(400).json({
          success: false,
          message: "Password must be 8-128 characters",
        });
      }

      return res.json({ success: true, message: "Password reset successful" });
    } catch (err) {
      return next(err);
    }
  }
}

export default new AuthController();
