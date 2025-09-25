import "dotenv/config";
import db from "../src/models/db.js";

async function run() {
  try {
    const totalRows = await db.query(
      "SELECT COUNT(*) as total FROM videos",
      []
    );
    const total = Number(totalRows?.[0]?.total || 0);
    console.log("videos total:", total);

    const rows = await db.query(
      `SELECT id, video_id, short_id, title, approved, privacy, publication_date, time
       FROM videos
       ORDER BY publication_date DESC, time DESC
       LIMIT 5`,
      []
    );
    console.log("sample videos:", rows);
  } catch (err) {
    console.error("videos-test failed:", err.message);
  } finally {
    if (db && db.pool) await db.pool.end();
    process.exit(0);
  }
}

run();
