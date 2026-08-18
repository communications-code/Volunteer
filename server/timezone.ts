export const SITE_TIME_ZONE = "America/New_York";

type DateInput = string | Date | null | undefined;

function parseDateForDisplay(date: DateInput): Date | null {
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
    // Noon UTC prevents date-only strings from shifting a day in New York display.
    return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateInNewYork(
  date: DateInput,
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
  date: DateInput,
  options?: Intl.DateTimeFormatOptions
): string {
  const parsed = parseDateForDisplay(date);
  if (!parsed) return "";
  return parsed.toLocaleString("en-US", {
    timeZone: SITE_TIME_ZONE,
    ...options,
  });
}

export function formatTimeInNewYork(
  date: DateInput,
  options?: Intl.DateTimeFormatOptions
): string {
  const parsed = parseDateForDisplay(date);
  if (!parsed) return "";
  return parsed.toLocaleTimeString("en-US", {
    timeZone: SITE_TIME_ZONE,
    ...options,
  });
}

export function getCurrentDateInNewYork(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format current date in New York");
  }

  return `${year}-${month}-${day}`;
}

const TIME_24_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_12_PATTERN = /^(1[0-2]|0?[1-9]):([0-5]\d)\s*([ap])m?$/i;

function parseTimeToMinutes(rawTime?: string | null): number | null {
  if (!rawTime) return null;
  const trimmed = rawTime.trim();

  const match24 = TIME_24_PATTERN.exec(trimmed);
  if (match24) {
    const hours = Number(match24[1]);
    const minutes = Number(match24[2]);
    return hours * 60 + minutes;
  }

  const normalized12 = trimmed
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const match12 = TIME_12_PATTERN.exec(normalized12);
  if (match12) {
    const hour12 = Number(match12[1]);
    const minutes = Number(match12[2]);
    const meridiem = match12[3];
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
