import authService from "./auth.service.js";

class AuthController {
  async login(req, res, next) {
    try {
      const { username, email, password } = req.body;
      const identifier = username || email;
      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: "username or email, and password are required",
        });
      }

      const data = await authService.login({ identifier, password });
      res.status(200).json({
        success: true,
        message: "User logged in successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== "string") {
        return res
          .status(400)
          .json({ success: false, message: "Valid email is required" });
      }

      const result = await authService.requestPasswordReset(email.trim());
      if (result && result.notFound) {
        return res
          .status(404)
          .json({ success: false, message: "Email not found" });
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
      const { email, otp } = req.body || {};
      if (!email || typeof email !== "string") {
        return res
          .status(400)
          .json({ success: false, message: "Valid email is required" });
      }
      if (!otp || typeof otp !== "string") {
        return res
          .status(400)
          .json({ success: false, message: "OTP is required" });
      }

      const result = await authService.verifyPasswordOtp(
        email.trim(),
        otp.trim()
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
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }

      // Success: OTP verified. Caller can now allow password reset.
      return res.json({ success: true, message: "OTP verified" });
    } catch (err) {
      return next(err);
    }
  }
}

export default new AuthController();
