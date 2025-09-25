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
}

export default new AuthController();
