import { db } from "./db";
import { sql } from "drizzle-orm";

// Migration function to add recipient contact info fields
async function runMigration() {
  try {
    console.log("Starting migration to add recipient contact information fields...");

    // Add recipient name field
    const checkRecipientNameQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'recipient_name'
    `;
    
    const recipientNameExists = await db.execute(sql.raw(checkRecipientNameQuery));
    
    if (recipientNameExists.length === 0) {
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN recipient_name TEXT
      `));
      console.log("Migration successful: 'recipient_name' column added to 'needs' table");
    } else {
      console.log("Column 'recipient_name' already exists in 'needs' table");
    }

    // Add recipient phone field
    const checkRecipientPhoneQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'recipient_phone'
    `;
    
    const recipientPhoneExists = await db.execute(sql.raw(checkRecipientPhoneQuery));
    
    if (recipientPhoneExists.length === 0) {
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN recipient_phone TEXT
      `));
      console.log("Migration successful: 'recipient_phone' column added to 'needs' table");
    } else {
      console.log("Column 'recipient_phone' already exists in 'needs' table");
    }

    // Add recipient email field
    const checkRecipientEmailQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'recipient_email'
    `;
    
    const recipientEmailExists = await db.execute(sql.raw(checkRecipientEmailQuery));
    
    if (recipientEmailExists.length === 0) {
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN recipient_email TEXT
      `));
      console.log("Migration successful: 'recipient_email' column added to 'needs' table");
    } else {
      console.log("Column 'recipient_email' already exists in 'needs' table");
    }

    // Add recipient address field
    const checkRecipientAddressQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'recipient_address'
    `;
    
    const recipientAddressExists = await db.execute(sql.raw(checkRecipientAddressQuery));
    
    if (recipientAddressExists.length === 0) {
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN recipient_address TEXT
      `));
      console.log("Migration successful: 'recipient_address' column added to 'needs' table");
    } else {
      console.log("Column 'recipient_address' already exists in 'needs' table");
    }

    // Add recipient notes field
    const checkRecipientNotesQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'recipient_notes'
    `;
    
    const recipientNotesExists = await db.execute(sql.raw(checkRecipientNotesQuery));
    
    if (recipientNotesExists.length === 0) {
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN recipient_notes TEXT
      `));
      console.log("Migration successful: 'recipient_notes' column added to 'needs' table");
    } else {
      console.log("Column 'recipient_notes' already exists in 'needs' table");
    }

  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  });