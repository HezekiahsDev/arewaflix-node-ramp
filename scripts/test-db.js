import "dotenv/config";
import usersService from "../src/users/users.service.js";
import db from "../src/models/db.js";
import bcrypt from "bcryptjs";

async function seedUsers() {
  const usersToSeed = [
    {
      username: "admin",
      email: "admin@example.com",
      password: "password",
      gender: "male",
      first_name: "Admin",
      last_name: "User",
    },
    {
      username: "testuser",
      email: "test@example.com",
      password: "password",
      gender: "female",
      first_name: "Test",
      last_name: "User",
    },
  ];

  for (const userData of usersToSeed) {
    try {
      await usersService.register(userData);
      console.log(`User ${userData.username} seeded.`);
    } catch (error) {
      if (
        error.message.includes("already taken") ||
        error.message.includes("already exists")
      ) {
        console.log(
          `User ${userData.username} or email already exists, skipping.`
        );
      } else {
        console.error(`Failed to seed user ${userData.username}:`, error);
      }
    }
  }
}

(async function run() {
  try {
    const users = await usersService.findAll();
    if (users.length === 0) {
      console.log("No users found, seeding database...");
      await seedUsers();
      const newUsers = await usersService.findAll();
      console.log("Users after seeding:", newUsers.slice(0, 5));
    } else {
      console.log("Users found:", users.slice ? users.slice(0, 5) : users);
    }
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    // Close the database connection pool
    if (db && db.pool) {
      await db.pool.end();
    }
    process.exit(0);
  }
})();
