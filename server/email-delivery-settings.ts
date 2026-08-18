import { eq, sql } from "drizzle-orm";

import { db } from "./db";
import { emailDeliverySettings, type EmailDeliverySettings } from "@shared/schema";

const DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY = "default";

let emailDeliverySettingsEnsured = false;

export async function ensureEmailDeliverySettings(): Promise<void> {
  if (emailDeliverySettingsEnsured) {
    return;
  }

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS email_delivery_settings (
      key TEXT PRIMARY KEY,
      emails_enabled BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));

  await db.execute(sql.raw(`
    INSERT INTO email_delivery_settings (key, emails_enabled)
    VALUES ('default', true)
    ON CONFLICT (key) DO NOTHING;
  `));

  emailDeliverySettingsEnsured = true;
}

export async function getEmailDeliverySettings(): Promise<EmailDeliverySettings> {
  await ensureEmailDeliverySettings();

  const [settings] = await db
    .select()
    .from(emailDeliverySettings)
    .where(eq(emailDeliverySettings.key, DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY))
    .limit(1);

  if (settings) {
    return settings;
  }

  const updatedAt = new Date();

  await db
    .insert(emailDeliverySettings)
    .values({
      key: DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY,
      emailsEnabled: true,
      updatedAt,
    })
    .onConflictDoNothing();

  return {
    key: DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY,
    emailsEnabled: true,
    updatedAt,
  };
}

export async function areEmailsEnabled(): Promise<boolean> {
  const settings = await getEmailDeliverySettings();
  return settings.emailsEnabled;
}

export async function setEmailsEnabled(emailsEnabled: boolean): Promise<EmailDeliverySettings> {
  await ensureEmailDeliverySettings();

  const updatedAt = new Date();

  await db
    .insert(emailDeliverySettings)
    .values({
      key: DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY,
      emailsEnabled,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: emailDeliverySettings.key,
      set: {
        emailsEnabled,
        updatedAt,
      },
    });

  return {
    key: DEFAULT_EMAIL_DELIVERY_SETTINGS_KEY,
    emailsEnabled,
    updatedAt,
  };
}
