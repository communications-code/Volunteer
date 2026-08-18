import { db } from "./db";
import { sql } from "drizzle-orm";

// Migration function to add new columns to the needs and pledges tables
async function runMigration() {
  try {
    console.log("Starting database migration for new fields...");

    // Check if the volunteersNeeded column already exists
    const checkVolunteersNeededQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'volunteers_needed'
    `;
    
    const volunteersNeededExists = await db.execute(sql.raw(checkVolunteersNeededQuery));
    
    if (volunteersNeededExists.length === 0) {
      // Add the volunteersNeeded column to the needs table
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN volunteers_needed INTEGER
      `));
      console.log("Migration successful: 'volunteers_needed' column added to 'needs' table");
    } else {
      console.log("Column 'volunteers_needed' already exists in 'needs' table");
    }
    
    // Check if the eventDate column already exists
    const checkEventDateQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'event_date'
    `;
    
    const eventDateExists = await db.execute(sql.raw(checkEventDateQuery));
    
    if (eventDateExists.length === 0) {
      // Add the eventDate column to the needs table
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN event_date DATE
      `));
      console.log("Migration successful: 'event_date' column added to 'needs' table");
    } else {
      console.log("Column 'event_date' already exists in 'needs' table");
    }
    
    // Check if the volunteersCount column already exists
    const checkVolunteersCountQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'volunteers_count'
    `;
    
    const volunteersCountExists = await db.execute(sql.raw(checkVolunteersCountQuery));
    
    if (volunteersCountExists.length === 0) {
      // Add the volunteersCount column to the needs table with default value 0
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN volunteers_count INTEGER DEFAULT 0
      `));
      console.log("Migration successful: 'volunteers_count' column added to 'needs' table");
    } else {
      console.log("Column 'volunteers_count' already exists in 'needs' table");
    }

    // Check if the subscribeToEmails column already exists in pledges table
    const checkSubscribeToEmailsQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'pledges' AND column_name = 'subscribe_to_emails'
    `;
    
    const subscribeToEmailsExists = await db.execute(sql.raw(checkSubscribeToEmailsQuery));
    
    if (subscribeToEmailsExists.length === 0) {
      // Add the subscribeToEmails column to the pledges table with default true
      await db.execute(sql.raw(`
        ALTER TABLE pledges ADD COLUMN subscribe_to_emails BOOLEAN DEFAULT TRUE
      `));
      console.log("Migration successful: 'subscribe_to_emails' column added to 'pledges' table");
    } else {
      console.log("Column 'subscribe_to_emails' already exists in 'pledges' table");
    }
    
    // Check if the isOngoingCommitment column already exists in pledges table
    const checkIsOngoingCommitmentQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'pledges' AND column_name = 'is_ongoing_commitment'
    `;
    
    const isOngoingCommitmentExists = await db.execute(sql.raw(checkIsOngoingCommitmentQuery));
    
    if (isOngoingCommitmentExists.length === 0) {
      // Add the isOngoingCommitment column to the pledges table
      await db.execute(sql.raw(`
        ALTER TABLE pledges ADD COLUMN is_ongoing_commitment BOOLEAN DEFAULT FALSE
      `));
      console.log("Migration successful: 'is_ongoing_commitment' column added to 'pledges' table");
    } else {
      console.log("Column 'is_ongoing_commitment' already exists in 'pledges' table");
    }
    
    // Check if the paymentCompleted column already exists in pledges table
    const checkPaymentCompletedQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'pledges' AND column_name = 'payment_completed'
    `;
    
    const paymentCompletedExists = await db.execute(sql.raw(checkPaymentCompletedQuery));
    
    if (paymentCompletedExists.length === 0) {
      // Add the paymentCompleted column to the pledges table
      await db.execute(sql.raw(`
        ALTER TABLE pledges ADD COLUMN payment_completed BOOLEAN DEFAULT FALSE
      `));
      console.log("Migration successful: 'payment_completed' column added to 'pledges' table");
    } else {
      console.log("Column 'payment_completed' already exists in 'pledges' table");
    }
    
    // Check if the isHighlighted column already exists in needs table
    const checkIsHighlightedQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'is_highlighted'
    `;
    
    const isHighlightedExists = await db.execute(sql.raw(checkIsHighlightedQuery));
    
    if (isHighlightedExists.length === 0) {
      // Add the isHighlighted column to the needs table
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN is_highlighted BOOLEAN DEFAULT FALSE
      `));
      console.log("Migration successful: 'is_highlighted' column added to 'needs' table");
    } else {
      console.log("Column 'is_highlighted' already exists in 'needs' table");
    }
    
    // Check if the eventTime column already exists in needs table
    const checkEventTimeQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'event_time'
    `;
    
    const eventTimeExists = await db.execute(sql.raw(checkEventTimeQuery));
    
    if (eventTimeExists.length === 0) {
      // Add the eventTime column to the needs table
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN event_time TEXT
      `));
      console.log("Migration successful: 'event_time' column added to 'needs' table");
    } else {
      console.log("Column 'event_time' already exists in 'needs' table");
    }
    
    // Check if the eventLocation column already exists in needs table
    const checkEventLocationQuery = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'needs' AND column_name = 'event_location'
    `;
    
    const eventLocationExists = await db.execute(sql.raw(checkEventLocationQuery));
    
    if (eventLocationExists.length === 0) {
      // Add the eventLocation column to the needs table
      await db.execute(sql.raw(`
        ALTER TABLE needs ADD COLUMN event_location TEXT
      `));
      console.log("Migration successful: 'event_location' column added to 'needs' table");
    } else {
      console.log("Column 'event_location' already exists in 'needs' table");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log("Migration completed");
    process.exit(0);
  })
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  });