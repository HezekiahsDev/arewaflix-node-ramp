import db from "../models/db.js";
import bcrypt from "bcryptjs";

export const findAll = async () => {
  // Try to query a `users` table if it exists in the imported SQL structure.
  try {
    const rows = await db.query(
      "SELECT id, username, email, first_name, last_name FROM users LIMIT 10",
      []
    );
    if (Array.isArray(rows)) return rows;
    // If table exists but empty, return empty array
    return [];
  } catch (err) {
    // If something goes wrong (table not found, DB not configured), fall back to placeholder
    console.warn(
      "DB query failed in users.service.findAll — falling back to placeholder:",
      err.message
    );
    return [{ id: 1, name: "John Doe" }];
  }
};

export const findById = async (id) => {
  const [rows] = await db.pool.execute("SELECT * FROM users WHERE id = ?", [
    id,
  ]);
  const user = rows[0];
  if (user) {
    delete user.password;
  }
  return user;
};

export const register = async (userData) => {
  const { username, email, password, gender, ...otherData } = userData;

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const newUser = {
    username,
    email,
    password: hashedPassword,
    gender,
    ...otherData,
  };

  const columns = Object.keys(newUser);
  const values = Object.values(newUser);
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO users (${columns.join(
    ", "
  )}) VALUES (${placeholders})`;

  const [result] = await db.pool.execute(sql, values);

  // Fetch the created user
  const [rows] = await db.pool.execute("SELECT * FROM users WHERE id = ?", [
    result.insertId,
  ]);
  const user = rows[0];

  // Don't return password
  delete user.password;

  return user;
};

export default { findAll, register, findById };
