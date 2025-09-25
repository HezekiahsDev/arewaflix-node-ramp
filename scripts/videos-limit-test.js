import "dotenv/config";
import db from "../src/models/db.js";

async function run() {
  try {
    const limit = 10;
    const offset = 0;
    const rows = await db.query(
      `SELECT id, video_id, short_id, title
       FROM videos
       ORDER BY publication_date DESC, time DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    console.log("rows length:", rows.length);
    console.log("first row:", rows[0]);
  } catch (err) {
    console.error("videos-limit-test error:", err.message);
  } finally {
    if (db && db.pool) await db.pool.end();
    process.exit(0);
  }
}

run();
