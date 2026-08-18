import { sql } from "drizzle-orm";
import { db } from "./db";

let authCompatibilityEnsured = false;

/**
 * Ensure auth tables/columns exist in production databases that predate
 * the newer auth reliability features (lockouts, magic-link tokens, audit log).
 */
export async function ensureAuthCompatibility(): Promise<void> {
  if (authCompatibilityEnsured) return;

  // Runtime schema compatibility should be opt-in in serverless production.
  // Heavy DDL on cold starts can cause FUNCTION_INVOCATION_FAILED and block app boot.
  const runtimeCompatEnabled =
    (process.env.RUNTIME_SCHEMA_COMPAT || "").trim().toLowerCase() === "true";
  if (!runtimeCompatEnabled) {
    authCompatibilityEnsured = true;
    return;
  }

  await db.execute(sql.raw(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP;
  `));

  await db.execute(sql.raw(`
    ALTER TABLE pledges
    ADD COLUMN IF NOT EXISTS organization TEXT;
  `));

  await db.execute(sql.raw(`
    ALTER TABLE needs
    ADD COLUMN IF NOT EXISTS event_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE,
    ADD COLUMN IF NOT EXISTS event_start_time TEXT,
    ADD COLUMN IF NOT EXISTS event_end_time TEXT,
    ADD COLUMN IF NOT EXISTS category_selections TEXT DEFAULT '[]';
  `));

  await db.execute(sql.raw(`
    UPDATE needs
    SET category_selections = CASE
      WHEN category IS NULL OR trim(category) = '' THEN '[]'
      ELSE to_json(ARRAY[trim(category)])::text
    END
    WHERE category_selections IS NULL OR trim(category_selections) = '';
  `));

  await db.execute(sql.raw(`
    ALTER TABLE needs
    ALTER COLUMN category_selections SET DEFAULT '[]',
    ALTER COLUMN category_selections SET NOT NULL;
  `));

  await db.execute(sql.raw(`
    UPDATE users
    SET failed_login_attempts = 0
    WHERE failed_login_attempts IS NULL;
  `));

  await db.execute(sql.raw(`
    ALTER TABLE users
    ALTER COLUMN failed_login_attempts SET DEFAULT 0,
    ALTER COLUMN failed_login_attempts SET NOT NULL;
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS admin_magic_login_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_ip TEXT,
      created_user_agent TEXT
    );
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_admin_magic_login_tokens_user_id
    ON admin_magic_login_tokens(user_id);
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_admin_magic_login_tokens_token_hash
    ON admin_magic_login_tokens(token_hash);
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS auth_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username_attempt TEXT,
      event_type TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_auth_events_created_at
    ON auth_events(created_at DESC);
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS admin_notification_preferences (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      receive_all_notifications BOOLEAN NOT NULL DEFAULT true,
      enabled_categories TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_admin_notification_preferences_user_id
    ON admin_notification_preferences(user_id);
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS event_roles (
      id SERIAL PRIMARY KEY,
      need_id INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slot_date DATE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      capacity INTEGER,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));

  // Backward-compat for legacy event_roles shape:
  // - role_name -> name
  // - slots_needed -> capacity
  // - missing timing/status columns for modern slot model
  await db.execute(sql.raw(`
    ALTER TABLE event_roles
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS slot_date DATE,
    ADD COLUMN IF NOT EXISTS start_time TEXT,
    ADD COLUMN IF NOT EXISTS end_time TEXT,
    ADD COLUMN IF NOT EXISTS capacity INTEGER,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
  `));

  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'event_roles' AND column_name = 'role_name'
      ) THEN
        EXECUTE 'UPDATE event_roles SET name = role_name WHERE name IS NULL AND role_name IS NOT NULL';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'event_roles' AND column_name = 'slots_needed'
      ) THEN
        EXECUTE 'UPDATE event_roles SET capacity = slots_needed WHERE capacity IS NULL AND slots_needed IS NOT NULL';
      END IF;
    END $$;
  `));

  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'event_roles' AND column_name = 'role_name'
      ) THEN
        EXECUTE 'ALTER TABLE event_roles ALTER COLUMN role_name DROP NOT NULL';
      END IF;
    END $$;
  `));

  await db.execute(sql.raw(`
    UPDATE event_roles
    SET
      name = COALESCE(name, 'General Volunteer'),
      start_time = COALESCE(start_time, '00:00'),
      end_time = COALESCE(end_time, '01:00'),
      updated_at = COALESCE(updated_at, NOW());
  `));

  await db.execute(sql.raw(`
    UPDATE event_roles AS er
    SET slot_date = n.event_date
    FROM needs AS n
    WHERE er.need_id = n.id
      AND er.slot_date IS NULL
      AND n.event_date IS NOT NULL;
  `));

  await db.execute(sql.raw(`
    ALTER TABLE event_roles
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN start_time SET NOT NULL,
    ALTER COLUMN end_time SET NOT NULL,
    ALTER COLUMN is_active SET DEFAULT true,
    ALTER COLUMN updated_at SET DEFAULT NOW();
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_roles_need_id
    ON event_roles(need_id);
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS event_role_signups (
      id SERIAL PRIMARY KEY,
      pledge_id INTEGER NOT NULL REFERENCES pledges(id) ON DELETE CASCADE,
      need_id INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
      event_role_id INTEGER NOT NULL REFERENCES event_roles(id) ON DELETE CASCADE,
      signer_email TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));

  await db.execute(sql.raw(`
    ALTER TABLE event_role_signups
    ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
  `));

  await db.execute(sql.raw(`
    UPDATE event_role_signups
    SET quantity = 1
    WHERE quantity IS NULL OR quantity <= 0;
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_role_signups_pledge_id
    ON event_role_signups(pledge_id);
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_role_signups_need_id
    ON event_role_signups(need_id);
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_role_signups_role_id
    ON event_role_signups(event_role_id);
  `));

  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_event_role_signups_role_email_unique
    ON event_role_signups(event_role_id, signer_email);
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS event_signup_reminders (
      id SERIAL PRIMARY KEY,
      need_id INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
      signer_email TEXT NOT NULL,
      first_slot_at TIMESTAMP NOT NULL,
      reminder_type TEXT NOT NULL DEFAULT 'FIRST_SLOT_24H',
      sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));

  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS event_signup_reminders_unique_idx
    ON event_signup_reminders(need_id, signer_email, first_slot_at, reminder_type);
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_event_signup_reminders_first_slot_at
    ON event_signup_reminders(first_slot_at);
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS calendar_sync_queue (
      need_id INTEGER PRIMARY KEY,
      action TEXT NOT NULL CHECK (action IN ('UPSERT', 'DELETE')),
      payload TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_attempt_at TIMESTAMP,
      last_error TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS idx_calendar_sync_queue_next_attempt_at
    ON calendar_sync_queue(next_attempt_at);
  `));

  // NOTE: Security hardening DDL (RLS/grant changes) should not run on the hot
  // request path in serverless; concurrent invocations can conflict with
  // "tuple concurrently updated" catalog errors.
  //
  // Keep runtime compatibility focused on additive schema safety only.
  // If explicit runtime hardening is needed, allow it behind an opt-in flag.
  if (process.env.RUNTIME_AUTH_HARDENING === "true") {
    try {
      await db.execute(sql.raw(`
        ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public."session" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.pledges ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.needs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.admin_magic_login_tokens ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.auth_events ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.event_roles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.event_role_signups ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.event_signup_reminders ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.calendar_sync_queue ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;
      `));

      await db.execute(sql.raw(`
        DO $$
        DECLARE
          role_name TEXT;
          table_name TEXT;
          target_tables TEXT[] := ARRAY[
            'users',
            'session',
            'pledges',
            'needs',
            'admin_magic_login_tokens',
            'auth_events',
            'event_roles',
            'event_role_signups',
            'event_signup_reminders',
            'calendar_sync_queue',
            'categories',
            'admin_notification_preferences'
          ];
        BEGIN
          FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
          LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
              FOREACH table_name IN ARRAY target_tables
              LOOP
                IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
                  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
                END IF;
              END LOOP;
            END IF;
          END LOOP;
        END $$;
      `));
    } catch (error) {
      console.warn("Runtime auth hardening skipped due to DDL conflict:", error);
    }
  }

  authCompatibilityEnsured = true;
}
