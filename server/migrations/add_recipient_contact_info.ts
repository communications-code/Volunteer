import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runMigration() {
  console.log("Starting migration to add recipient contact information fields...");
  
  try {
    // Add recipient contact information fields to the needs table
    await db.execute(sql`
      ALTER TABLE needs
      ADD COLUMN IF NOT EXISTS recipient_name TEXT,
      ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
      ADD COLUMN IF NOT EXISTS recipient_email TEXT,
      ADD COLUMN IF NOT EXISTS recipient_address TEXT,
      ADD COLUMN IF NOT EXISTS recipient_notes TEXT;
    `);
    
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

export default runMigration;