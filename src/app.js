import express from "express";
import cors from "cors";
import helmet from "helmet";
import passport from "passport";
import indexRouter from "./routes/index.js";
import authRouter from "./auth/auth.router.js";
import errorHandler from "./middlewares/errorHandler.js";
import passportJwt from "./auth/strategies/jwt.strategy.js";
import sanitizeInput from "./middlewares/sanitizeInput.js";
import rejectScriptLikeInput from "./middlewares/rejectScriptLikeInput.js";
import rateLimiter from "./middlewares/rateLimiter.js";

const app = express();

// We do not trust client-supplied forwarded headers in this deployment. To avoid
// accidental use or spoofing of X-Forwarded-For / Forwarded / X-Real-IP by clients,
// strip those headers early so downstream middleware (like express-rate-limit)
// and app logic rely only on the real TCP peer IP (req.ip).
app.use((req, _res, next) => {
  // Remove common forwarded headers if present
  if (req.headers) {
    delete req.headers["x-forwarded-for"];
    delete req.headers["forwarded"];
    delete req.headers["x-real-ip"];
  }
  next();
});

// Middleware
// Security headers
app.use(helmet());
// Enable CORS for all origins (temporary for now)
app.use(cors());
// Body parsing then sanitization
app.use(express.json());
app.use(sanitizeInput);
// Reject obvious script-like payloads early (defense-in-depth)
app.use(rejectScriptLikeInput);
app.use(passport.initialize());
passport.use(passportJwt);

// Apply global rate limit to all requests
app.use(rateLimiter.global);

// Mount the index router at /api/v1
app.use("/api/v1", rateLimiter.global, indexRouter);
// Apply a stricter limiter to auth endpoints
app.use("/api/v1/auth", rateLimiter.auth, authRouter);

app.get("/", (req, res) => {
  res.send("API is running");
});

// Error handler middleware (should be last)
app.use(errorHandler);

export default app;
