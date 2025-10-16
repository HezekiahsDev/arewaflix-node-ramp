import mysql from "mysql2/promise";
import "dotenv/config";

// Create a connection pool using environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || "arewaflix.com",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || "arewaflix_mobile-App",
  password: process.env.DB_PASSWORD || "B2ZiZ1_HJi8!8nXo",
  database: process.env.DB_DATABASE || "arewaflix_mobile-App",
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
