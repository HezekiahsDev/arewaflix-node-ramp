import "dotenv/config";
import app from "./app.js";
import passwordOtpStore from "./auth/passwordOtpStore.js";

// The API is now mounted at /api/v1 (see app.js and routes/index.js)
const PORT = process.env.PORT || 4000;

// Start periodic cleanup of expired password reset OTPs (every 60s)
const cleaner = passwordOtpStore.startPeriodicCleanup();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown: stop background cleaner when process exits
process.on("SIGINT", () => {
  cleaner.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleaner.stop();
  process.exit(0);
});
