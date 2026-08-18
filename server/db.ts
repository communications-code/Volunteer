import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create a PostgresJS client — limit to 1 connection for serverless
// Supabase Session mode has a hard cap on total connections (pool_size),
// and each Vercel function invocation creates its own module scope.
export const queryClient = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  prepare: false,
  // Keep this small for serverless, but >1 to reduce head-of-line blocking
  // when one request is slow (e.g. cold-start + pooler latency).
  max: 2,
  idle_timeout: 20,    // Close idle connections after 20s
  connect_timeout: 10, // Fail fast on connection issues
});

// Create a Drizzle ORM instance
export const db = drizzle(queryClient);
