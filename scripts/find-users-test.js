import { findAll } from "../src/users/users.service.js";
import db from "../src/models/db.js";

(async function run() {
  try {
    const users = await findAll();
    console.log("findAll returned:", users);
  } catch (err) {
    console.error("findAll failed:", err);
  } finally {
    if (db && db.pool) await db.pool.end();
    process.exit(0);
  }
})();
