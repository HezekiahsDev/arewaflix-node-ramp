import "dotenv/config";
import app from "./app.js";

// The API is now mounted at /api/v1 (see app.js and routes/index.js)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
