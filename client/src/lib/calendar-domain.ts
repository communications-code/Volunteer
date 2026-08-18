import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { RRule, type Weekday, rrulestr } from "rrule";

export const DEFAULT_TIMEZONE = "America/New_York";

export type WeekdayCode = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";
export type RecurrenceKind = "none" | "daily" | "weekly" | "monthly_day" | "monthly_nth_weekday";

export interface RecurrencePattern {
  kind: RecurrenceKind;
  interval?: number;
  weekdays?: WeekdayCode[];
  nth?: number;
  weekday?: WeekdayCode;
  until?: string | null;
}

export interface CalendarEventSeriesRow {
  id: string;
  org_id: string;
  title: string;
  group_name: string | null;
  location: string | null;
  description_html: string;
  event_color: string;
  text_color: string;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
  timezone: string;
  recurrence_rule: string | null;
  recurrence_until: string | null;
  integration_source: string | null;
  integration_key: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CalendarOccurrence {
  id: string;
  seriesId: string;
  orgId?: string;
  isRecurring?: boolean;
  title: string;
  groupName?: string | null;
  integrationSource?: string | null;
  integrationKey?: string | null;
  location: string | null;
  descriptionHtml: string;
  eventColor: string;
  textColor: string;
  allDay: boolean;
  occurrenceStart: string;
  occurrenceEnd: string;
  timezone: string;
}

const codeToRRuleWeekday: Record<WeekdayCode, Weekday> = {
  SU: RRule.SU,
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
};

const jsDayToWeekdayCode: WeekdayCode[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const rruleDayToCode: Record<number, WeekdayCode> = {
  0: "MO",
  1: "TU",
  2: "WE",
  3: "TH",
  4: "FR",
  5: "SA",
  6: "SU",
};

function normalizeWeekdayArray(byweekday: unknown): WeekdayCode[] {
  if (!byweekday) return [];
  const weekdays = Array.isArray(byweekday) ? byweekday : [byweekday];

  return weekdays
    .map((entry) => {
      if (typeof entry === "number") {
        return rruleDayToCode[entry];
      }
      if (typeof entry === "object" && entry && "weekday" in entry) {
        const day = Number((entry as { weekday: number }).weekday);
        return rruleDayToCode[day];
      }
      return undefined;
    })
    .filter((value): value is WeekdayCode => Boolean(value));
}

export function buildRecurrenceRuleFromPattern(params: {
  startsAt: string;
  timezone?: string;
  pattern?: RecurrencePattern | null;
}): { rule: string | null; recurrenceUntil: string | null } {
  const { startsAt, timezone = DEFAULT_TIMEZONE, pattern } = params;

  if (!pattern || pattern.kind === "none") {
    return {
      rule: null,
      recurrenceUntil: pattern?.until ?? null,
    };
  }

  const startDate = new Date(startsAt);
  const zonedStart = toZonedTime(startDate, timezone);
  const localRuleStart = new Date(
    Date.UTC(
      zonedStart.getFullYear(),
      zonedStart.getMonth(),
      zonedStart.getDate(),
      zonedStart.getHours(),
      zonedStart.getMinutes(),
      zonedStart.getSeconds(),
    ),
  );

  const options: ConstructorParameters<typeof RRule>[0] = {
    dtstart: localRuleStart,
    interval: pattern.interval ?? 1,
  };

  if (pattern.until) {
    const zonedUntil = toZonedTime(new Date(pattern.until), timezone);
    options.until = new Date(
      Date.UTC(
        zonedUntil.getFullYear(),
        zonedUntil.getMonth(),
        zonedUntil.getDate(),
        zonedUntil.getHours(),
        zonedUntil.getMinutes(),
        zonedUntil.getSeconds(),
      ),
    );
  }

  switch (pattern.kind) {
    case "daily":
      options.freq = RRule.DAILY;
      break;
    case "weekly":
      options.freq = RRule.WEEKLY;
      options.byweekday = (pattern.weekdays ?? [jsDayToWeekdayCode[zonedStart.getDay()]]).map(
        (weekday) => codeToRRuleWeekday[weekday],
      );
      break;
    case "monthly_day":
      options.freq = RRule.MONTHLY;
      options.bymonthday = [zonedStart.getDate()];
      break;
    case "monthly_nth_weekday":
      options.freq = RRule.MONTHLY;
      options.bysetpos = [pattern.nth ?? 1];
      options.byweekday = [
        codeToRRuleWeekday[pattern.weekday ?? jsDayToWeekdayCode[zonedStart.getDay()]],
      ];
      break;
    default:
      return { rule: null, recurrenceUntil: pattern.until ?? null };
  }

  const rule = new RRule(options);
  return {
    rule: rule.toString(),
    recurrenceUntil: pattern.until ?? null,
  };
}

export function deriveRecurrencePatternFromRule(
  rule: string | null,
  startsAt: string,
  timezone = DEFAULT_TIMEZONE,
): RecurrencePattern {
  if (!rule) {
    return { kind: "none" };
  }

  let parsed: ReturnType<typeof rrulestr>;
  try {
    parsed = rrulestr(rule, { forceset: false });
  } catch {
    return { kind: "none" };
  }

  const options = "origOptions" in parsed ? parsed.origOptions : undefined;
  if (!options || options.freq === undefined) {
    return { kind: "none" };
  }

  const recurrenceUntil = options.until?.toISOString() ?? null;

  if (options.freq === RRule.DAILY) {
    return {
      kind: "daily",
      interval: options.interval ?? 1,
      until: recurrenceUntil,
    };
  }

  if (options.freq === RRule.WEEKLY) {
    return {
      kind: "weekly",
      weekdays: normalizeWeekdayArray(options.byweekday),
      interval: options.interval ?? 1,
      until: recurrenceUntil,
    };
  }

  if (options.freq === RRule.MONTHLY) {
    if (options.bysetpos && options.byweekday) {
      const weekdays = normalizeWeekdayArray(options.byweekday);
      return {
        kind: "monthly_nth_weekday",
        nth: Array.isArray(options.bysetpos) ? options.bysetpos[0] : options.bysetpos,
        weekday: weekdays[0],
        interval: options.interval ?? 1,
        until: recurrenceUntil,
      };
    }

    return {
      kind: "monthly_day",
      interval: options.interval ?? 1,
      until: recurrenceUntil,
    };
  }

  const zonedStart = toZonedTime(new Date(startsAt), timezone);
  return {
    kind: "weekly",
    weekdays: [jsDayToWeekdayCode[zonedStart.getDay()]],
    interval: options.interval ?? 1,
    until: recurrenceUntil,
  };
}

export function toUtcIsoFromLocal(localDateTime: string, timezone: string): string {
  return fromZonedTime(localDateTime, timezone).toISOString();
}

export function toLocalInputValue(iso: string, timezone: string): string {
  const zoned = toZonedTime(iso, timezone);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}T${pad(
    zoned.getHours(),
  )}:${pad(zoned.getMinutes())}`;
}
