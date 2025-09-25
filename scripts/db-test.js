import db from "../src/models/db.js";

async function test() {
  try {
    // Simple arithmetic query
    const [arithmetic] = await db.pool.execute("SELECT 1 + 1 AS result");
    console.log("arithmetic result:", arithmetic);

    // Check for users table
    const [tables] = await db.pool.execute("SHOW TABLES LIKE 'users'");
    console.log("users table exists:", tables.length > 0);

    if (tables.length > 0) {
      const [rows] = await db.pool.execute(
        "SELECT id, username FROM users LIMIT 5"
      );
      console.log("sample users:", rows);
    }
  } catch (err) {
    console.error("DB test failed:", err);
  } finally {
    if (db && db.pool) await db.pool.end();
    process.exit(0);
  }
}

test();
