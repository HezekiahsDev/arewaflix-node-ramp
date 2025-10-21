import mysql from "mysql2/promise";
import "dotenv/config";

// Create a connection pool using environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || "dev",
  password: process.env.DB_PASSWORD || "dev",
  database: process.env.DB_DATABASE || "arewaflix_web",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  timezone: "Z",
});

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export default {
  pool,
  query,
};
