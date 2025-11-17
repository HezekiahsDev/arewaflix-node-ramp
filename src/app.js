import express from "express";
import cors from "cors";
import helmet from "helmet";
import passport from "passport";
import indexRouter from "./routes/index.js";
import authRouter from "./auth/auth.router.js";
import errorHandler from "./middlewares/errorHandler.js";
import passportJwt from "./auth/strategies/jwt.strategy.js";
import sanitizeInput from "./middlewares/sanitizeInput.js";
import rateLimiter from "./middlewares/rateLimiter.js";

const app = express();

// Middleware
// Security headers
app.use(helmet());
// Enable CORS for all origins (temporary for now)
app.use(cors());
// Body parsing then sanitization
app.use(express.json());
app.use(sanitizeInput);
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
