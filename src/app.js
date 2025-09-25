import express from "express";
import passport from "passport";
import indexRouter from "./routes/index.js";
import authRouter from "./auth/auth.router.js";
import errorHandler from "./middlewares/errorHandler.js";
import passportJwt from "./auth/strategies/jwt.strategy.js";

const app = express();

// Middleware
app.use(express.json());
app.use(passport.initialize());
passport.use(passportJwt);

// Mount the index router at /api/v1
app.use("/api/v1", indexRouter);
app.use("/api/v1/auth", authRouter);

app.get("/", (req, res) => {
  res.send("API is running");
});

// Error handler middleware (should be last)
app.use(errorHandler);

export default app;
