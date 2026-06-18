import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

pool.on("error", (err) => {
  console.error("DB pool error:", err.message);
});

// Test connection on startup
pool.query("SELECT 1").then(() => {
  console.info("DB connected successfully");
}).catch((err) => {
  console.error("DB connection failed:", err.message);
});

export const db = drizzle(pool);
