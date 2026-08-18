import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SITE_TIME_ZONE = "America/New_York";

export function getCurrentDateInNewYork(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function isPastNewYorkDate(date?: string | Date | null): boolean {
  if (!date) return false;

  if (date instanceof Date) {
    const dateKey = formatDateForInput(date);
    return Boolean(dateKey && getCurrentDateInNewYork() > dateKey);
  }

  const trimmed = date.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    return getCurrentDateInNewYork() > `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }

  const dateKey = formatDateForInput(trimmed);
  return Boolean(dateKey && getCurrentDateInNewYork() > dateKey);
}

/**
 * Parse date-only strings (YYYY-MM-DD) as local calendar dates to avoid
 * timezone shifts when rendering in a fixed site timezone.
 */
export function parseDateForDisplay(date?: string | Date | null): Date | null {
  if (!date) return null;

  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const trimmed = date.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    // Noon UTC ensures formatting in America/New_York stays on the same calendar day.
    return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateInNewYork(
  date?: string | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const parsed = parseDateForDisplay(date);
  if (!parsed) return "";
  return parsed.toLocaleDateString("en-US", {
    timeZone: SITE_TIME_ZONE,
    ...options,
  });
}

export function formatDateTimeInNewYork(
  date?: string | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const parsed = parseDateForDisplay(date);
  if (!parsed) return "";
  return parsed.toLocaleString("en-US", {
    timeZone: SITE_TIME_ZONE,
    ...options,
  });
}

const TIME_24_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_12_PATTERN = /^(1[0-2]|0?[1-9]):([0-5]\d)\s*([ap])m?$/i;

function parseTimeToMinutes(rawTime?: string | null): number | null {
  if (!rawTime) return null;
  const trimmed = rawTime.trim();

  const time24 = TIME_24_PATTERN.exec(trimmed);
  if (time24) {
    const hours = Number(time24[1]);
    const minutes = Number(time24[2]);
    return hours * 60 + minutes;
  }

  const normalized12 = trimmed
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const time12 = TIME_12_PATTERN.exec(normalized12);
  if (time12) {
    const hour12 = Number(time12[1]);
    const minutes = Number(time12[2]);
    const meridiem = time12[3];
    const hour24 = hour12 % 12 + (meridiem === "p" ? 12 : 0);
    return hour24 * 60 + minutes;
  }

  return null;
}

function formatMinutesAs12Hour(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")}${suffix}`;
}

export function formatClockTimeForDisplay(time?: string | null): string {
  const parsedMinutes = parseTimeToMinutes(time);
  if (parsedMinutes === null) return time?.trim() || "";
  return formatMinutesAs12Hour(parsedMinutes);
}

export function formatTimeRangeForDisplay(startTime?: string | null, endTime?: string | null): string {
  if (!startTime && !endTime) return "";
  if (startTime && endTime) {
    return `${formatClockTimeForDisplay(startTime)} - ${formatClockTimeForDisplay(endTime)}`;
  }
  return formatClockTimeForDisplay(startTime || endTime || "");
}

export function formatEventTimeForDisplay(eventTime?: string | null): string {
  const trimmed = eventTime?.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s*[–-]\s*/);
  if (parts.length === 2) {
    return formatTimeRangeForDisplay(parts[0], parts[1]);
  }
  return formatClockTimeForDisplay(trimmed);
}

/**
 * Formats a date string or Date object to YYYY-MM-DD format for HTML input fields
 */
export function formatDateForInput(date?: string | Date | null): string {
  const d = parseDateForDisplay(date);
  if (!d) return "";
  if (isNaN(d.getTime())) return ""; // Invalid date
  
  // Format as YYYY-MM-DD
  return d.toISOString().split('T')[0];
}
