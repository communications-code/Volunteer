import type { RecurrencePattern, WeekdayCode } from "@/lib/calendar-domain";

const weekdayOptions: WeekdayCode[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function weekdayLabel(code: WeekdayCode) {
  return {
    SU: "Sun",
    MO: "Mon",
    TU: "Tue",
    WE: "Wed",
    TH: "Thu",
    FR: "Fri",
    SA: "Sat",
  }[code];
}

function nthLabel(nth?: number) {
  return {
    1: "first",
    2: "second",
    3: "third",
    4: "fourth",
    5: "fifth",
    [-1]: "last",
  }[nth ?? 2] ?? "second";
}

function getDefaultPattern(kind: RecurrencePattern["kind"]): RecurrencePattern {
  switch (kind) {
    case "daily":
      return { kind, interval: 1, until: null };
    case "weekly":
      return { kind, interval: 1, weekdays: ["TU"], until: null };
    case "monthly_day":
      return { kind, interval: 1, until: null };
    case "monthly_nth_weekday":
      return { kind, interval: 1, nth: 2, weekday: "TU", until: null };
    default:
      return { kind: "none" };
  }
}

function summaryText(value: RecurrencePattern) {
  const interval = Math.max(1, value.interval ?? 1);

  if (value.kind === "none") {
    return "This event does not repeat.";
  }

  if (value.kind === "daily") {
    return interval === 1 ? "Repeats every day." : `Repeats every ${interval} days.`;
  }

  if (value.kind === "weekly") {
    const days = (value.weekdays ?? []).map(weekdayLabel);
    const dayText = days.length > 0 ? days.join(", ") : "selected weekdays";
    return interval === 1
      ? `Repeats every week on ${dayText}.`
      : `Repeats every ${interval} weeks on ${dayText}.`;
  }

  if (value.kind === "monthly_day") {
    return interval === 1
      ? "Repeats every month on the same date."
      : `Repeats every ${interval} months on the same date.`;
  }

  if (value.kind === "monthly_nth_weekday") {
    const nth = nthLabel(value.nth);
    const weekday = weekdayLabel(value.weekday ?? "TU");
    return interval === 1
      ? `Repeats every month on the ${nth} ${weekday}.`
      : `Repeats every ${interval} months on the ${nth} ${weekday}.`;
  }

  return "Repeat rule selected.";
}

function intervalUnit(kind: RecurrencePattern["kind"]) {
  if (kind === "daily") return "day(s)";
  if (kind === "weekly") return "week(s)";
  if (kind === "monthly_day" || kind === "monthly_nth_weekday") return "month(s)";
  return "time period(s)";
}

interface RecurrenceBuilderProps {
  value: RecurrencePattern;
  onChange: (value: RecurrencePattern) => void;
}

export function RecurrenceBuilder({ value, onChange }: RecurrenceBuilderProps) {
  const kind = value.kind ?? "none";
  const summary = summaryText(value);

  return (
    <div className="space-y-3 rounded-md border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Repeat
        </label>
        <span className="text-[11px] font-medium text-slate-600">How often this event repeats</span>
      </div>
      <select
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        value={kind}
        onChange={(event) => onChange(getDefaultPattern(event.target.value as RecurrencePattern["kind"]))}
      >
        <option value="none">Does not repeat</option>
        <option value="daily">Every day</option>
        <option value="weekly">Every week</option>
        <option value="monthly_day">Monthly on same date</option>
        <option value="monthly_nth_weekday">Monthly on nth weekday</option>
      </select>
      <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">
        {summary}
      </p>

      {kind !== "none" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Repeat Every
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={12}
                className="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={value.interval ?? 1}
                onChange={(event) =>
                  onChange({
                    ...value,
                    interval: Math.max(1, Number(event.target.value) || 1),
                  })
                }
              />
              <span className="text-sm font-semibold text-slate-800">{intervalUnit(kind)}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Example: 2 means every 2 {intervalUnit(kind).replace("(s)", "s")}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Stop Repeating On (Optional)
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={value.until ? value.until.slice(0, 16) : ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  until: event.target.value ? new Date(event.target.value).toISOString() : null,
                })
              }
            />
            <p className="mt-1 text-[11px] text-slate-600">
              Leave blank if this should continue indefinitely.
            </p>
          </div>
        </div>
      ) : null}

      {kind === "weekly" ? (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Choose Weekdays
          </label>
          <div className="flex flex-wrap gap-2">
            {weekdayOptions.map((weekday) => {
              const selected = (value.weekdays ?? []).includes(weekday);
              return (
                <button
                  type="button"
                  key={weekday}
                  className={`rounded border px-2 py-1 text-xs font-semibold shadow-sm ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                  }`}
                  onClick={() => {
                    const current = new Set(value.weekdays ?? []);
                    if (current.has(weekday)) {
                      current.delete(weekday);
                    } else {
                      current.add(weekday);
                    }
                    onChange({
                      ...value,
                      weekdays: Array.from(current),
                    });
                  }}
                >
                  {weekdayLabel(weekday)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {kind === "monthly_nth_weekday" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Week In Month
            </label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={value.nth ?? 2}
              onChange={(event) =>
                onChange({
                  ...value,
                  nth: Number(event.target.value),
                })
              }
            >
              <option value={1}>First</option>
              <option value={2}>Second</option>
              <option value={3}>Third</option>
              <option value={4}>Fourth</option>
              <option value={5}>Fifth</option>
              <option value={-1}>Last</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Day Of Week
            </label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={value.weekday ?? "TU"}
              onChange={(event) =>
                onChange({
                  ...value,
                  weekday: event.target.value as WeekdayCode,
                })
              }
            >
              {weekdayOptions.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {weekdayLabel(weekday)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
