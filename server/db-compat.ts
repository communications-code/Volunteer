import { sql } from "drizzle-orm";
import { db } from "./db";

let compatibilityEnsured = false;

/**
 * Keep legacy DB constraints aligned with the current app model.
 *
 * - `need_type` now supports EVENT.
 * - categories are dynamic, so the old static category check must be removed.
 */
export async function ensureDatabaseCompatibility(): Promise<void> {
  if (compatibilityEnsured) return;

  // Add per-need response option controls used by the pledge form.
  await db.execute(sql.raw(`
    ALTER TABLE needs
    ADD COLUMN IF NOT EXISTS allow_item_donations BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS allow_money_donations BOOLEAN DEFAULT FALSE;
  `));

  await db.execute(sql.raw(`
    UPDATE needs
    SET allow_item_donations = TRUE
    WHERE allow_item_donations IS NULL;
  `));

  await db.execute(sql.raw(`
    UPDATE needs
    SET allow_money_donations = FALSE
    WHERE allow_money_donations IS NULL;
  `));

  await db.execute(sql.raw(`
    ALTER TABLE needs
    ALTER COLUMN allow_item_donations SET DEFAULT TRUE,
    ALTER COLUMN allow_item_donations SET NOT NULL,
    ALTER COLUMN allow_money_donations SET DEFAULT FALSE,
    ALTER COLUMN allow_money_donations SET NOT NULL;
  `));

  // Legacy static category constraint conflicts with dynamic categories.
  await db.execute(sql.raw(`
    ALTER TABLE needs
    DROP CONSTRAINT IF EXISTS needs_category_check;
  `));

  // Rebuild need type constraint so EVENT inserts do not fail.
  await db.execute(sql.raw(`
    ALTER TABLE needs
    DROP CONSTRAINT IF EXISTS needs_type_check;
  `));

  await db.execute(sql.raw(`
    ALTER TABLE needs
    ADD CONSTRAINT needs_type_check
    CHECK (
      need_type = ANY (
        ARRAY[
          'ONETIME'::text,
          'ONGOING'::text,
          'GROUP'::text,
          'EVENT'::text
        ]
      )
    );
  `));

  compatibilityEnsured = true;
}
