import fetch from "node-fetch";
import { Need, NeedStatus, NeedType, Pledge } from "@shared/schema";
import { createHmac } from "crypto";
import { formatDateInNewYork, formatTimeRangeForDisplay } from "./timezone";
import type { EventRoleSummary } from "./storage";
import { areEmailsEnabled } from "./email-delivery-settings";

const MAILERSEND_API_TOKEN =
  process.env.MAILERSEND_API_TOKEN?.trim() || process.env.MAILERSEND_API_KEY?.trim();
const MAILERSEND_API_BASE = "https://api.mailersend.com/v1/";

const DEFAULT_FROM_EMAIL = process.env.DEFAULT_FROM_EMAIL?.trim() || "communications@vfwharrisonoh.org";

const HOST_URL =
  process.env.HOST_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://apps.vfwharrisonoh.org");

const PUBLIC_URL = process.env.PUBLIC_URL || "https://vfwharrisonoh.org/volunteer/";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || "communications@vfwharrisonoh.org";
const CONTACT_PHONE = process.env.CONTACT_PHONE?.trim() || "513-367-7570";

const BRAND_LOGO_URL = process.env.BRAND_LOGO_URL?.trim() || `${HOST_URL}/assets/vfw-logo-full-color.svg`;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>\s*<p[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getDonationTypeLabel(donationType: string): string {
  if (donationType === "money") return "Financial Support";
  if (donationType === "signup") return "Event Sign-Up";
  return "Item Support";
}

function parseTimeToMinutes(time?: string | null): number {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatRoleSlot(role: EventRoleSummary): string {
  const dateLabel = role.slotDate
    ? `${formatDateInNewYork(role.slotDate, {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
      })} `
    : "";
  const quantityLabel =
    typeof role.quantity === "number" && role.quantity > 1 ? ` x${role.quantity}` : "";
  return `${role.name}${quantityLabel} (${dateLabel}${formatTimeRangeForDisplay(role.startTime, role.endTime)})`;
}

function sortEventRoles(roles: EventRoleSummary[]): EventRoleSummary[] {
  return [...roles].sort((a, b) => {
    const aDate = a.slotDate || "9999-12-31";
    const bDate = b.slotDate || "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);

    const aStart = parseTimeToMinutes(a.startTime);
    const bStart = parseTimeToMinutes(b.startTime);
    if (aStart !== bStart) return aStart - bStart;

    return a.id - b.id;
  });
}

function renderSelectedSlotsHtml(selectedEventRoles?: EventRoleSummary[]): string {
  if (!selectedEventRoles || selectedEventRoles.length === 0) return "";

  const rows = sortEventRoles(selectedEventRoles)
    .map((role) => `<li style="margin: 0 0 4px 0;">${escapeHtml(formatRoleSlot(role))}</li>`)
    .join("");

  return `<div style="margin-top: 8px;">
    <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Selected Slots:</strong></p>
    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333;">${rows}</ul>
  </div>`;
}

function renderSelectedSlotsText(selectedEventRoles?: EventRoleSummary[]): string {
  if (!selectedEventRoles || selectedEventRoles.length === 0) return "";
  const lines = sortEventRoles(selectedEventRoles)
    .map((role) => `- ${formatRoleSlot(role)}`)
    .join("\n");
  return `Selected Slots:\n${lines}`;
}

function getEventAddress(need: Pick<Need, "eventLocation">): string {
  return need.eventLocation?.trim() || "";
}

function renderEventAddressHtml(need: Pick<Need, "eventLocation">): string {
  const address = getEventAddress(need);
  if (!address) return "";
  return `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Address:</strong> ${escapeHtml(address)}</p>`;
}

function renderEventAddressText(need: Pick<Need, "eventLocation">): string {
  const address = getEventAddress(need);
  return address ? `Address: ${address}` : "";
}

function wrapInEmailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background-color: #991A1E; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="right">
                    <img
                      src="${BRAND_LOGO_URL}"
                      alt="VFW Post 7570"
                      width="200"
                      style="display: block; height: auto; max-width: 100%;"
                    />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 32px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 24px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #888;">VFW Post 7570</p>
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #888;">9160 Lawrenceburg Rd, Harrison, OH 45030</p>
              <p style="margin: 0; font-size: 13px; color: #888;">
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                &nbsp;|&nbsp;
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateSecureToken(entityId: number, action: string): string {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable must be set");
  }

  const expiryTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `${entityId}:${action}:${expiryTime}`;

  const hmac = createHmac("sha256", process.env.SESSION_SECRET);
  hmac.update(payload);
  const signature = hmac.digest("hex");

  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

export function buildEventSignupManageLink(pledgeId: number): string | null {
  try {
    const token = generateSecureToken(pledgeId, "manage_signup");
    return `${HOST_URL}/signup/manage?token=${encodeURIComponent(token)}`;
  } catch (error) {
    console.error("Error generating manage-signup link token:", error);
    return null;
  }
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  sendAtUnix?: number;
  ignoreEmailDeliveryPause?: boolean;
}

function toRecipients(to: string): Array<{ email: string }> {
  return to
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!params.ignoreEmailDeliveryPause) {
    try {
      const emailsEnabled = await areEmailsEnabled();
      if (!emailsEnabled) {
        console.log(`Email delivery paused; skipping "${params.subject}" to ${params.to}`);
        return false;
      }
    } catch (error) {
      console.warn("Email delivery settings check failed; continuing with send attempt:", error);
    }
  }

  if (!MAILERSEND_API_TOKEN) {
    console.error("MailerSend email error: MAILERSEND_API_TOKEN (or MAILERSEND_API_KEY) is not configured");
    return false;
  }

  const recipients = toRecipients(params.to);
  if (recipients.length === 0) {
    console.error("MailerSend email error: at least one recipient is required");
    return false;
  }

  const payload: Record<string, unknown> = {
    from: { email: params.from },
    to: recipients,
    subject: params.subject,
    text: params.text || undefined,
    html: params.html || params.text || "",
    settings: {
      track_clicks: false,
      track_opens: false,
      track_content: false,
    },
  };

  if (params.replyTo?.trim()) {
    payload.reply_to = { email: params.replyTo.trim() };
  }

  if (typeof params.sendAtUnix === "number" && Number.isFinite(params.sendAtUnix)) {
    payload.send_at = Math.floor(params.sendAtUnix);
  }

  try {
    const response = await fetch(`${MAILERSEND_API_BASE}email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MailerSend email error (${response.status}):`, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("MailerSend email error:", error);
    return false;
  }
}

export async function sendPledgeConfirmation(
  need: Need,
  pledge: Pledge & { selectedEventRoles?: EventRoleSummary[] },
): Promise<boolean> {
  const isEventSignup = need.needType === NeedType.EVENT || pledge.donationType === "signup";
  const descriptionText = stripHtml(need.description || "No description provided");

  if (isEventSignup) {
    const subject = "Thanks for signing up for our event!";
    const manageLink = buildEventSignupManageLink(pledge.id);

    const bodyHtml = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">Thanks for signing up for our event!</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                We appreciate your willingness to serve with VFW Post 7570.
              </p>

              <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 24px 0;">Dear ${escapeHtml(pledge.firstName)},</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Event You've Volunteered For</h3>
                          <p style="margin: 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          ${renderEventAddressHtml(need)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #164C83; font-weight: bold;">Sign Up Details</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Name:</strong> ${escapeHtml(pledge.firstName)} ${escapeHtml(pledge.lastName)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Email:</strong> ${escapeHtml(pledge.email)}</p>
                          ${pledge.phone ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Phone:</strong> ${escapeHtml(pledge.phone)}</p>` : ""}
                          ${pledge.organization ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Church / Organization:</strong> ${escapeHtml(pledge.organization)}</p>` : ""}
                          ${renderSelectedSlotsHtml(pledge.selectedEventRoles)}
                          ${pledge.notes ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Notes:</strong> ${escapeHtml(pledge.notes)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${manageLink ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #164C83; border-radius: 25px;">
                          <a href="${manageLink}" target="_blank" style="display: inline-block; padding: 12px 30px; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none;">Change or Cancel Sign Up</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ""}

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${PUBLIC_URL}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">View Serving Network</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #888; text-align: center; margin: 24px 0 0 0;">
                Questions? Contact us at
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                or
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>`;

    const html = wrapInEmailShell(subject, bodyHtml);

    const text = `THANKS FOR SIGNING UP FOR OUR EVENT!

Dear ${pledge.firstName},

We appreciate your willingness to serve with VFW Post 7570.

EVENT YOU'VE VOLUNTEERED FOR
Title: ${need.title}
${renderEventAddressText(need)}

SIGN UP DETAILS
Name: ${pledge.firstName} ${pledge.lastName}
Email: ${pledge.email}
${pledge.phone ? `Phone: ${pledge.phone}` : ""}
${pledge.organization ? `Church / Organization: ${pledge.organization}` : ""}
${renderSelectedSlotsText(pledge.selectedEventRoles)}
${pledge.notes ? `Notes: ${pledge.notes}` : ""}
${manageLink ? `\nChange or cancel your sign up: ${manageLink}` : ""}

View the Serving Network: ${PUBLIC_URL}

Questions? Contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}

VFW Post 7570
444 S State St, Harrison, OH 45030`;

    return await sendEmail({
      to: pledge.email,
      from: DEFAULT_FROM_EMAIL,
      subject,
      text,
      html,
    });
  }

  const subject = "Thank you for your pledge to VFW Post 7570";

  const bodyHtml = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">Thank You for Your Pledge!</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                Your commitment to help makes a difference in our community.
              </p>

              <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 8px 0;">Dear ${escapeHtml(pledge.firstName)},</p>
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 8px 0;">
                Thank you for your generous pledge to help with a need in our community! We appreciate your willingness to serve and make a difference through VFW Post 7570.
              </p>
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px 0;">
                Someone from our team will be in touch with you within 2-3 business days (if not sooner) to coordinate the details of fulfilling this need.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Need You've Pledged to Help With</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(need.category)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #555; line-height: 1.5;">${escapeHtml(descriptionText)}</p>
                          ${need.neededBy ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Needed By:</strong> ${formatDateInNewYork(need.neededBy, { month: "long", day: "numeric", year: "numeric" })}</p>` : ""}
                          ${need.estimatedCost ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Estimated Cost:</strong> $${(need.estimatedCost / 100).toFixed(2)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #164C83; font-weight: bold;">Your Pledge Details</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Name:</strong> ${escapeHtml(pledge.firstName)} ${escapeHtml(pledge.lastName)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Email:</strong> ${escapeHtml(pledge.email)}</p>
                          ${pledge.phone ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Phone:</strong> ${escapeHtml(pledge.phone)}</p>` : ""}
                          ${pledge.organization ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Church / Organization:</strong> ${escapeHtml(pledge.organization)}</p>` : ""}
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Support Type:</strong> ${getDonationTypeLabel(pledge.donationType)}</p>
                          ${renderSelectedSlotsHtml(pledge.selectedEventRoles)}
                          ${pledge.notes ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Notes:</strong> ${escapeHtml(pledge.notes)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${PUBLIC_URL}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">View Serving Network</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #888; text-align: center; margin: 24px 0 0 0;">
                Questions? Contact us at
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                or
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>`;

  const html = wrapInEmailShell(subject, bodyHtml);

  const text = `THANK YOU FOR YOUR PLEDGE!

Dear ${pledge.firstName},

Thank you for your generous pledge to help with a need in our community! We appreciate your willingness to serve and make a difference through VFW Post 7570.

Someone from our team will be in touch with you within 2-3 business days (if not sooner) to coordinate the details of fulfilling this need.

NEED YOU'VE PLEDGED TO HELP WITH
Title: ${need.title}
Category: ${need.category}
${descriptionText}
${need.neededBy ? `Needed By: ${formatDateInNewYork(need.neededBy, { month: "long", day: "numeric", year: "numeric" })}` : ""}
${need.estimatedCost ? `Estimated Cost: $${(need.estimatedCost / 100).toFixed(2)}` : ""}

YOUR PLEDGE DETAILS
Name: ${pledge.firstName} ${pledge.lastName}
Email: ${pledge.email}
${pledge.phone ? `Phone: ${pledge.phone}` : ""}
${pledge.organization ? `Church / Organization: ${pledge.organization}` : ""}
Support Type: ${getDonationTypeLabel(pledge.donationType)}
${renderSelectedSlotsText(pledge.selectedEventRoles)}
${pledge.notes ? `Notes: ${pledge.notes}` : ""}

View the Serving Network: ${PUBLIC_URL}

Questions? Contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}

VFW Post 7570
444 S State St, Harrison, OH 45030`;

  return await sendEmail({
    to: pledge.email,
    from: DEFAULT_FROM_EMAIL,
    subject,
    text,
    html,
  });
}

export async function sendPledgeNotification(
  need: Need,
  pledge: Pledge & { selectedEventRoles?: EventRoleSummary[] },
  adminEmails: string[] | string,
): Promise<boolean> {
  const to = Array.isArray(adminEmails) ? adminEmails : [adminEmails];
  const subject = `[VFW Post 7570] New Pledge for "${need.title}"`;

  let fulfillLink = "";
  try {
    const canGenerateFulfillLink =
      need.status === NeedStatus.PLEDGED ||
      (need.needType === NeedType.GROUP && need.status === NeedStatus.FLOATING);

    if (canGenerateFulfillLink) {
      const fulfillToken = generateSecureToken(need.id, "fulfill");
      fulfillLink = `${HOST_URL}/fulfill?token=${fulfillToken}`;
    }
  } catch (error) {
    console.error("Error generating token for email:", error);
  }

  const descriptionText = stripHtml(need.description || "No description provided");

  const bodyHtml = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">New Pledge Received</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                A need has been pledged in the Serving Network. Please reach out to the donor to coordinate fulfillment.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Need Details</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(need.category)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #555; line-height: 1.5;">${escapeHtml(descriptionText)}</p>
                          ${need.neededBy ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Needed By:</strong> ${formatDateInNewYork(need.neededBy, { month: "long", day: "numeric", year: "numeric" })}</p>` : ""}
                          ${need.estimatedCost ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Estimated Cost:</strong> $${(need.estimatedCost / 100).toFixed(2)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #164C83; font-weight: bold;">Pledge Contact Information</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Name:</strong> ${escapeHtml(pledge.firstName)} ${escapeHtml(pledge.lastName)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Email:</strong> <a href="mailto:${escapeHtml(pledge.email)}" style="color: #164C83; text-decoration: none;">${escapeHtml(pledge.email)}</a></p>
                          ${pledge.phone ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Phone:</strong> <a href="tel:${escapeHtml(pledge.phone)}" style="color: #164C83; text-decoration: none;">${escapeHtml(pledge.phone)}</a></p>` : ""}
                          ${pledge.organization ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Church / Organization:</strong> ${escapeHtml(pledge.organization)}</p>` : ""}
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Support Type:</strong> ${getDonationTypeLabel(pledge.donationType)}</p>
                          ${renderSelectedSlotsHtml(pledge.selectedEventRoles)}
                          ${pledge.notes ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Notes:</strong> ${escapeHtml(pledge.notes)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${fulfillLink ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <p style="margin: 0 0 12px 0; font-size: 15px; color: #333; font-weight: bold;">Once the need has been fulfilled, click below:</p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${fulfillLink}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">Mark as Fulfilled</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #888;">This link will expire in 7 days and can only be used once.</p>
                  </td>
                </tr>
              </table>
              ` : ""}`;

  const html = wrapInEmailShell(subject, bodyHtml);

  const text = `NEW PLEDGE RECEIVED

A need has been pledged in the Serving Network.

NEED DETAILS
Title: ${need.title}
Category: ${need.category}
${descriptionText}
${need.neededBy ? `Needed By: ${formatDateInNewYork(need.neededBy, { month: "long", day: "numeric", year: "numeric" })}` : ""}
${need.estimatedCost ? `Estimated Cost: $${(need.estimatedCost / 100).toFixed(2)}` : ""}

PLEDGE CONTACT INFORMATION
Name: ${pledge.firstName} ${pledge.lastName}
Email: ${pledge.email}
${pledge.phone ? `Phone: ${pledge.phone}` : ""}
${pledge.organization ? `Church / Organization: ${pledge.organization}` : ""}
Support Type: ${getDonationTypeLabel(pledge.donationType)}
${renderSelectedSlotsText(pledge.selectedEventRoles)}
${pledge.notes ? `Notes: ${pledge.notes}` : ""}
${fulfillLink ? `
MARK AS FULFILLED
Once the need has been fulfilled, visit this link:
${fulfillLink}
(This link will expire in 7 days and can only be used once)
` : ""}
Please reach out to the donor to coordinate fulfillment of this need.

VFW Post 7570
444 S State St, Harrison, OH 45030`;

  return await sendEmail({
    to: to.join(","),
    from: DEFAULT_FROM_EMAIL,
    subject,
    text,
    html,
  });
}

type EventSignupChangeType = "updated" | "canceled";
type EventSignupChangeAudience = "volunteer" | "admin";

export async function sendEventSignupChangeConfirmation(
  need: Pick<Need, "id" | "title" | "eventLocation">,
  pledge: Pick<Pledge, "id" | "firstName" | "lastName" | "email" | "phone" | "organization" | "notes"> & {
    selectedEventRoles?: EventRoleSummary[];
  },
  changeType: EventSignupChangeType,
  recipients: string[] | string,
  audience: EventSignupChangeAudience,
): Promise<boolean> {
  const to = (Array.isArray(recipients) ? recipients : [recipients])
    .map((value) => value.trim())
    .filter(Boolean);

  if (to.length === 0) {
    return false;
  }

  const sortedRoles = sortEventRoles(pledge.selectedEventRoles || []);
  const selectedSlotsHtml =
    sortedRoles.length > 0
      ? renderSelectedSlotsHtml(sortedRoles)
      : '<p style="margin: 0; font-size: 14px; color: #333;"><strong>Selected Slots:</strong> None</p>';
  const selectedSlotsText =
    sortedRoles.length > 0 ? renderSelectedSlotsText(sortedRoles) : "Selected Slots: None";

  const isUpdated = changeType === "updated";
  const subject = isUpdated
    ? `Event sign-up updated: ${need.title}`
    : `Event sign-up canceled: ${need.title}`;
  const heading = isUpdated ? "Event Sign-Up Updated" : "Event Sign-Up Canceled";
  const intro =
    audience === "volunteer"
      ? isUpdated
        ? "This email confirms that your event sign-up details were updated."
        : "This email confirms that your event sign-up has been canceled."
      : isUpdated
        ? "A volunteer has updated their event sign-up details."
        : "A volunteer has canceled their event sign-up.";
  const detailHeading = isUpdated ? "Current Sign-Up Details" : "Canceled Sign-Up Details";
  const salutation = audience === "volunteer" ? pledge.firstName || "Volunteer" : "Admin Team";

  const bodyHtml = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">${heading}</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                ${intro}
              </p>

              <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 16px 0;">Dear ${escapeHtml(salutation)},</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Event</h3>
                          <p style="margin: 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          ${renderEventAddressHtml(need)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #164C83; font-weight: bold;">${detailHeading}</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Name:</strong> ${escapeHtml(pledge.firstName)} ${escapeHtml(pledge.lastName)}</p>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Email:</strong> ${escapeHtml(pledge.email)}</p>
                          ${pledge.phone ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Phone:</strong> ${escapeHtml(pledge.phone)}</p>` : ""}
                          ${pledge.organization ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Church / Organization:</strong> ${escapeHtml(pledge.organization)}</p>` : ""}
                          ${selectedSlotsHtml}
                          ${pledge.notes ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #333;"><strong>Notes:</strong> ${escapeHtml(pledge.notes)}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${PUBLIC_URL}?need=${need.id}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">View Event</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #888; text-align: center; margin: 24px 0 0 0;">
                Questions? Contact us at
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                or
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>`;

  const html = wrapInEmailShell(subject, bodyHtml);

  const text = `${heading.toUpperCase()}

${intro}

Dear ${salutation},

EVENT
Title: ${need.title}
${renderEventAddressText(need)}

${detailHeading.toUpperCase()}
Name: ${pledge.firstName} ${pledge.lastName}
Email: ${pledge.email}
${pledge.phone ? `Phone: ${pledge.phone}` : ""}
${pledge.organization ? `Church / Organization: ${pledge.organization}` : ""}
${selectedSlotsText}
${pledge.notes ? `Notes: ${pledge.notes}` : ""}

View Event: ${PUBLIC_URL}?need=${need.id}

Questions? Contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}

VFW Post 7570
444 S State St, Harrison, OH 45030`;

  return await sendEmail({
    to: to.join(","),
    from: DEFAULT_FROM_EMAIL,
    subject,
    text,
    html,
  });
}

export async function sendEventSignupReminder(
  need: Pick<Need, "id" | "title" | "eventLocation">,
  recipient: { email: string; firstName?: string | null },
  selectedEventRoles: EventRoleSummary[],
  options?: {
    sendAtUnix?: number;
  },
): Promise<boolean> {
  if (!selectedEventRoles || selectedEventRoles.length === 0) {
    return false;
  }

  const sortedRoles = sortEventRoles(selectedEventRoles);
  const firstSlot = sortedRoles[0];
  const firstSlotLabel = formatRoleSlot(firstSlot);
  const subject = `Reminder: ${need.title} is tomorrow`;

  const bodyHtml = `
              <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #231F20;">Event Reminder</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #555; line-height: 1.5;">
                This is a reminder that your event is tomorrow.
              </p>

              <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 16px 0;">Dear ${escapeHtml(recipient.firstName || "Volunteer")},</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9f9f9; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #231F20; font-weight: bold;">Event</h3>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>Title:</strong> ${escapeHtml(need.title)}</p>
                          ${renderEventAddressHtml(need)}
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>First Slot:</strong> ${escapeHtml(firstSlotLabel)}</p>
                          ${renderSelectedSlotsHtml(sortedRoles)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #991A1E; border-radius: 25px;">
                          <a href="${PUBLIC_URL}?need=${need.id}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">View Event</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #888; text-align: center; margin: 24px 0 0 0;">
                Questions? Contact us at
                <a href="mailto:${CONTACT_EMAIL}" style="color: #164C83; text-decoration: none;">${CONTACT_EMAIL}</a>
                or
                <a href="tel:${CONTACT_PHONE}" style="color: #164C83; text-decoration: none;">${CONTACT_PHONE}</a>
              </p>`;

  const html = wrapInEmailShell(subject, bodyHtml);
  const text = `EVENT REMINDER

Dear ${recipient.firstName || "Volunteer"},

This is a reminder that your event is tomorrow.

EVENT
Title: ${need.title}
${renderEventAddressText(need)}
First Slot: ${firstSlotLabel}
${renderSelectedSlotsText(sortedRoles)}

View Event: ${PUBLIC_URL}?need=${need.id}

Questions? Contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}

VFW Post 7570
444 S State St, Harrison, OH 45030`;

  return await sendEmail({
    to: recipient.email,
    from: DEFAULT_FROM_EMAIL,
    subject,
    text,
    html,
    sendAtUnix: options?.sendAtUnix,
  });
}
