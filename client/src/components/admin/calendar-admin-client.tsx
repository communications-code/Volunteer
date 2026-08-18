import { useCallback, useEffect, useMemo, useState } from "react";

import { PublicCalendar } from "@/components/calendar/public-calendar";
import { RecurrenceBuilder } from "@/components/admin/recurrence-builder";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DEFAULT_TIMEZONE,
  deriveRecurrencePatternFromRule,
  toLocalInputValue,
  toUtcIsoFromLocal,
  type CalendarEventSeriesRow,
  type CalendarOccurrence,
  type RecurrencePattern,
} from "@/lib/calendar-domain";

type EditableSeries = CalendarEventSeriesRow & { recurrencePattern?: RecurrencePattern };
type GroupSection = { name: string; key: string; rows: EditableSeries[] };

type CalendarAdminClientProps = {
  onBack: () => void;
};

const colorPresets = [
  { eventColor: "#2563eb", textColor: "#ffffff", label: "Blue" },
  { eventColor: "#15803d", textColor: "#ffffff", label: "Green" },
  { eventColor: "#7c3aed", textColor: "#ffffff", label: "Purple" },
  { eventColor: "#b91c1c", textColor: "#ffffff", label: "Red" },
  { eventColor: "#f59e0b", textColor: "#111827", label: "Gold" },
  { eventColor: "#0f172a", textColor: "#e2e8f0", label: "Slate" },
];

const emptyPattern: RecurrencePattern = { kind: "none" };

type IconProps = { className?: string };

function GripIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="8" cy="7" r="1.5" />
      <circle cx="8" cy="12" r="1.5" />
      <circle cx="8" cy="17" r="1.5" />
      <circle cx="14" cy="7" r="1.5" />
      <circle cx="14" cy="12" r="1.5" />
      <circle cx="14" cy="17" r="1.5" />
    </svg>
  );
}

function CopyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 15V7a2 2 0 0 1 2-2h8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 4h6" stroke="currentColor" strokeWidth="1.8" />
      <path d="m7 7 1 11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-11" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronIcon({ className, up = false }: IconProps & { up?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d={up ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function defaultDateTimeValue() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  const plusHour = new Date(date.getTime() + 60 * 60 * 1000);
  const format = (value: Date) => {
    const pad = (num: number) => num.toString().padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
      value.getHours(),
    )}:${pad(value.getMinutes())}`;
  };

  return {
    start: format(date),
    end: format(plusHour),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDuplicateTitle(existingTitles: string[], sourceTitle: string) {
  const normalized = new Set(existingTitles.map((title) => title.trim().toLowerCase()));
  const base = `${sourceTitle.trim()} (Copy)`;
  if (!normalized.has(base.toLowerCase())) {
    return base;
  }

  let index = 2;
  while (normalized.has(`${base} ${index}`.toLowerCase())) {
    index += 1;
  }
  return `${base} ${index}`;
}

function toCanonicalIsoString(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export default function CalendarAdminClient({ onBack: _onBack }: CalendarAdminClientProps) {
  const initialDateTimes = useMemo(() => defaultDateTimeValue(), []);

  const [embedOrigin, setEmbedOrigin] = useState("");
  const [series, setSeries] = useState<EditableSeries[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<CalendarOccurrence | null>(null);
  const [deletingOccurrenceId, setDeletingOccurrenceId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [mobileView, setMobileView] = useState<"calendar" | "editor">("calendar");

  const [title, setTitle] = useState("");
  const [groupName, setGroupName] = useState("");
  const [location, setLocation] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("<p></p>");
  const [eventColor, setEventColor] = useState("#2563eb");
  const [textColor, setTextColor] = useState("#ffffff");
  const [allDay, setAllDay] = useState(false);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [startsAtLocal, setStartsAtLocal] = useState(initialDateTimes.start);
  const [endsAtLocal, setEndsAtLocal] = useState(initialDateTimes.end);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>(emptyPattern);

  const embedSnippet = `<iframe src="${embedOrigin}/embed" width="100%" height="900" style="border:0;" loading="lazy" allow="clipboard-write"></iframe>`;

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const filteredSeries = series.filter((row) => {
    const needle = search.toLowerCase().trim();
    if (!needle) return true;
    return row.title.toLowerCase().includes(needle) || (row.group_name ?? "").toLowerCase().includes(needle);
  });

  const groupSections = useMemo<GroupSection[]>(() => {
    const grouped = new Map<string, EditableSeries[]>();
    for (const row of filteredSeries) {
      const normalized = row.group_name?.trim() || "Ungrouped";
      const current = grouped.get(normalized) ?? [];
      current.push(row);
      grouped.set(normalized, current);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => {
        if (a[0] === "Ungrouped") return 1;
        if (b[0] === "Ungrouped") return -1;
        return a[0].localeCompare(b[0]);
      })
      .map(([name, rows]) => ({
        name,
        key: name.toLowerCase(),
        rows: rows.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [filteredSeries]);

  const existingGroupNames = useMemo(
    () =>
      Array.from(
        new Set(
          series
            .map((row) => row.group_name?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [series],
  );

  const resetForm = useCallback(() => {
    const defaults = defaultDateTimeValue();
    setSelectedId(null);
    setSelectedOccurrence(null);
    setTitle("");
    setGroupName("");
    setLocation("");
    setDescriptionHtml("<p></p>");
    setEventColor("#2563eb");
    setTextColor("#ffffff");
    setAllDay(false);
    setTimezone(DEFAULT_TIMEZONE);
    setStartsAtLocal(defaults.start);
    setEndsAtLocal(defaults.end);
    setRecurrencePattern({ kind: "none" });
  }, []);

  const loadSeries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/calendar/events?mode=series", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load events (${response.status})`);
      }

      const data = await response.json();
      setSeries((data.eventSeries ?? []) as EditableSeries[]);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  useEffect(() => {
    setEmbedOrigin(window.location.origin);
  }, []);

  function applySelection(row: EditableSeries, occurrence: CalendarOccurrence | null = null) {
    const activeTimezone = occurrence?.timezone || row.timezone || DEFAULT_TIMEZONE;
    setSelectedId(row.id);
    setSelectedOccurrence(occurrence);
    setTitle(row.title);
    setGroupName(row.group_name ?? "");
    setLocation(row.location ?? "");
    setDescriptionHtml(row.description_html || "<p></p>");
    setEventColor(row.event_color || "#2563eb");
    setTextColor(row.text_color || "#ffffff");
    setAllDay(occurrence?.allDay ?? row.all_day);
    setTimezone(activeTimezone);
    setStartsAtLocal(toLocalInputValue(occurrence?.occurrenceStart ?? row.starts_at, activeTimezone));
    setEndsAtLocal(toLocalInputValue(occurrence?.occurrenceEnd ?? row.ends_at, activeTimezone));
    setRecurrencePattern(
      row.recurrencePattern ??
        deriveRecurrencePatternFromRule(row.recurrence_rule, row.starts_at, row.timezone),
    );
  }

  function openCreateEditor() {
    resetForm();
    setEditorOpen(true);
    setMobileView("editor");
  }

  function openCreateEditorForDate(clickDate: { dateStr: string }) {
    resetForm();
    const datePart = clickDate.dateStr.split("T")[0];
    setStartsAtLocal(`${datePart}T09:00`);
    setEndsAtLocal(`${datePart}T10:00`);
    setEditorOpen(true);
    setMobileView("editor");
  }

  function toggleSeriesEditor(row: EditableSeries) {
    if (editorOpen && selectedId === row.id) {
      setEditorOpen(false);
      return;
    }

    setSearch("");
    setCollapsedGroups((current) => ({
      ...current,
      [(row.group_name?.trim() || "Ungrouped").toLowerCase()]: false,
    }));
    applySelection(row);
    setEditorOpen(true);
    setMobileView("editor");
  }

  async function parseApiError(response: Response, fallbackMessage: string) {
    const data = await response.json().catch(() => null);
    const details =
      typeof data?.details === "string"
        ? data.details
        : data?.details?.message || data?.details?.details || null;
    const message = data?.error ?? fallbackMessage;
    return details ? `${message}: ${details}` : message;
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
      setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  function openEmbedPopup() {
    const popup = window.open("", "clhEmbedCode", "width=760,height=520,resizable=yes,scrollbars=yes");

    if (!popup) {
      void copySnippet();
      return;
    }

    const escapedSnippet = escapeHtml(embedSnippet);

    popup.document.open();
    popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Calendar Embed Code</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; background: #0f172a; color: #e2e8f0; }
      .card { background: #111827; border: 1px solid #334155; border-radius: 14px; padding: 18px; }
      h1 { margin: 0 0 8px 0; font-size: 1.25rem; }
      p { margin: 0 0 14px 0; color: #94a3b8; font-size: 0.95rem; }
      textarea { width: 100%; min-height: 180px; font-family: Menlo, Consolas, monospace; font-size: 0.85rem; padding: 12px; border-radius: 10px; border: 1px solid #334155; box-sizing: border-box; background: #020617; color: #e2e8f0; }
      .actions { margin-top: 12px; display: flex; gap: 10px; }
      button { border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
      .copy { background: #2563eb; color: #fff; }
      .close { background: #334155; color: #e2e8f0; }
      .status { margin-top: 10px; font-size: 0.85rem; color: #7dd3fc; min-height: 18px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Calendar Embed Code</h1>
      <p>Paste this snippet into your website HTML where the calendar should appear.</p>
      <textarea id="embedCode" readonly>${escapedSnippet}</textarea>
      <div class="actions">
        <button class="copy" id="copyBtn">Copy to Clipboard</button>
        <button class="close" id="closeBtn">Close</button>
      </div>
      <div class="status" id="status"></div>
    </div>
    <script>
      const textarea = document.getElementById('embedCode');
      const status = document.getElementById('status');
      document.getElementById('copyBtn').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(textarea.value);
          status.textContent = 'Copied to clipboard.';
        } catch {
          textarea.focus();
          textarea.select();
          status.textContent = 'Clipboard blocked. Code selected for manual copy.';
        }
      });
      document.getElementById('closeBtn').addEventListener('click', () => window.close());
    </script>
  </body>
</html>`);
    popup.document.close();
    popup.focus();
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const selectedRow = selectedId ? series.find((row) => row.id === selectedId) : null;
    const formStartsAt = toUtcIsoFromLocal(startsAtLocal, timezone);
    const formEndsAt = toUtcIsoFromLocal(endsAtLocal, timezone);
    const isRecurringOccurrenceSelection = Boolean(selectedOccurrence?.isRecurring && selectedRow);
    const occurrenceDatesChanged = selectedOccurrence
      ? formStartsAt !== toCanonicalIsoString(selectedOccurrence.occurrenceStart) ||
        formEndsAt !== toCanonicalIsoString(selectedOccurrence.occurrenceEnd)
      : false;

    const payload = {
      title,
      groupName: groupName.trim() || null,
      location: location || null,
      descriptionHtml,
      eventColor,
      textColor,
      allDay,
      timezone,
      startsAt:
        isRecurringOccurrenceSelection && selectedRow ? toCanonicalIsoString(selectedRow.starts_at) : formStartsAt,
      endsAt:
        isRecurringOccurrenceSelection && selectedRow ? toCanonicalIsoString(selectedRow.ends_at) : formEndsAt,
      recurrencePattern,
    };

    try {
      if (isRecurringOccurrenceSelection && selectedOccurrence && occurrenceDatesChanged) {
        const moveResponse = await fetch("/api/v1/calendar/events/occurrence", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            seriesId: selectedOccurrence.seriesId,
            occurrenceStart: selectedOccurrence.occurrenceStart,
            occurrenceEnd: selectedOccurrence.occurrenceEnd,
            newOccurrenceStart: formStartsAt,
            newOccurrenceEnd: formEndsAt,
          }),
        });

        if (!moveResponse.ok) {
          throw new Error(await parseApiError(moveResponse, `Move occurrence failed (${moveResponse.status})`));
        }
      }

      const isUpdate = Boolean(selectedId);
      const url = isUpdate ? `/api/v1/calendar/events/${selectedId}` : "/api/v1/calendar/events";
      const method = isUpdate ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, `Save failed (${response.status})`));
      }

      await loadSeries();
      resetForm();
      setEditorOpen(false);
      setMobileView("calendar");
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(id: string) {
    const source = series.find((row) => row.id === id);
    if (!source) {
      setError("Could not find selected event to duplicate.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title: buildDuplicateTitle(
        series.map((row) => row.title),
        source.title,
      ),
      groupName: source.group_name ?? null,
      location: source.location ?? null,
      descriptionHtml: source.description_html || "<p></p>",
      eventColor: source.event_color || "#2563eb",
      textColor: source.text_color || "#ffffff",
      allDay: source.all_day,
      timezone: source.timezone || DEFAULT_TIMEZONE,
      startsAt: toCanonicalIsoString(source.starts_at),
      endsAt: toCanonicalIsoString(source.ends_at),
      recurrencePattern:
        source.recurrencePattern ??
        deriveRecurrencePatternFromRule(
          source.recurrence_rule,
          source.starts_at,
          source.timezone || DEFAULT_TIMEZONE,
        ),
    };

    try {
      const response = await fetch("/api/v1/calendar/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, `Duplicate failed (${response.status})`));
      }

      await loadSeries();
      resetForm();
      setError(null);
    } catch (duplicateError) {
      setError((duplicateError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function toggleGroupCollapsed(groupKey: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this event series?")) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/v1/calendar/events/${id}`, {
        method: "DELETE",
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
        },
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, `Delete failed (${response.status})`));
      }

      await loadSeries();
      if (selectedId === id) {
        resetForm();
        setEditorOpen(false);
      }
    } catch (deleteError) {
      setError((deleteError as Error).message);
    }
  }

  async function handleDeleteOccurrence(occurrence: CalendarOccurrence) {
    const labelDate = new Date(occurrence.occurrenceStart).toLocaleString();
    const confirmed = window.confirm(`Delete this occurrence of "${occurrence.title}" on ${labelDate}?`);
    if (!confirmed) {
      return;
    }

    setDeletingOccurrenceId(occurrence.id);
    setError(null);

    try {
      const response = await fetch("/api/v1/calendar/events/occurrence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          seriesId: occurrence.seriesId,
          occurrenceStart: occurrence.occurrenceStart,
          occurrenceEnd: occurrence.occurrenceEnd,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, `Delete occurrence failed (${response.status})`));
      }

      await loadSeries();
    } catch (deleteOccurrenceError) {
      const message = (deleteOccurrenceError as Error).message;
      setError(message);
      throw deleteOccurrenceError;
    } finally {
      setDeletingOccurrenceId(null);
    }
  }

  function handleCalendarEventSelect(occurrence: CalendarOccurrence) {
    const row = series.find((item) => item.id === occurrence.seriesId);
    if (!row) {
      setError(`Could not find "${occurrence.title}" in the editor list.`);
      return;
    }

    setSearch("");
    setCollapsedGroups((current) => ({
      ...current,
      [(row.group_name?.trim() || "Ungrouped").toLowerCase()]: false,
    }));
    applySelection(row, occurrence);
    setEditorOpen(true);
    setMobileView("editor");
    setError(null);
  }

  async function handleMoveOccurrence(payload: {
    occurrence: CalendarOccurrence;
    oldStart: string;
    oldEnd: string;
    newStart: string;
    newEnd: string;
  }) {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/calendar/events/occurrence", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          seriesId: payload.occurrence.seriesId,
          occurrenceStart: payload.oldStart,
          occurrenceEnd: payload.oldEnd,
          newOccurrenceStart: payload.newStart,
          newOccurrenceEnd: payload.newEnd,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, `Move occurrence failed (${response.status})`));
      }

      await loadSeries();
    } catch (moveError) {
      const message = (moveError as Error).message;
      setError(message);
      throw moveError;
    } finally {
      setSaving(false);
    }
  }

  function renderEditorForm(formClassName: string) {
    return (
      <form className={formClassName} onSubmit={handleSave}>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Start Date
          </label>
          <input
            type="datetime-local"
            required
            value={startsAtLocal}
            onChange={(event) => setStartsAtLocal(event.target.value)}
            className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[hsl(var(--primary))] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            End Date
          </label>
          <input
            type="datetime-local"
            required
            value={endsAtLocal}
            onChange={(event) => setEndsAtLocal(event.target.value)}
            className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[hsl(var(--primary))] focus:outline-none"
          />
        </div>

        <label className="flex items-center justify-between rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
          All Day
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
        </label>

        <RecurrenceBuilder value={recurrencePattern} onChange={setRecurrencePattern} />

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Title
          </label>
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[hsl(var(--primary))] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Group / Category
          </label>
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            list="clh-event-groups"
            placeholder="Example: Food Pantry"
            className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[hsl(var(--primary))] focus:outline-none"
          />
          <datalist id="clh-event-groups">
            {existingGroupNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Location
          </label>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[hsl(var(--primary))] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Description
          </label>
          <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} />
        </div>

        <div className="space-y-2 rounded-[1rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Format / Colors</p>
          <div className="flex flex-wrap gap-2">
            {colorPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  setEventColor(preset.eventColor);
                  setTextColor(preset.textColor);
                }}
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.eventColor }} />
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-600">
              Event Color
              <input
                type="color"
                value={eventColor}
                onChange={(event) => setEventColor(event.target.value)}
                className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Text Color
              <input
                type="color"
                value={textColor}
                onChange={(event) => setTextColor(event.target.value)}
                className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white"
              />
            </label>
          </div>
        </div>

        {error ? (
          <p className="rounded-[1rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-[1rem] bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(209,70,51,0.18)] hover:bg-[hsl(var(--primary))/0.9] disabled:opacity-60"
        >
          {saving ? "Saving..." : selectedId ? "Update Event" : "Add Event"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="md:hidden">
        <SegmentedControl
          value={mobileView}
          onValueChange={setMobileView}
          options={[
            { value: "calendar", label: "Calendar" },
            { value: "editor", label: "Editor" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[390px_minmax(0,1fr)]">
        <section className={`${mobileView === "editor" ? "block" : "hidden"} lg:block`}>
          <div className="clh-inset-group p-4 lg:h-[calc(100vh-11rem)] lg:overflow-y-auto">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Event Series</h2>
              <input
                placeholder="Search events"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-3 w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[hsl(var(--primary))] focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              {loading ? <p className="text-xs text-slate-500">Loading...</p> : null}
              {!loading && filteredSeries.length === 0 ? <p className="text-xs text-slate-500">No events yet.</p> : null}

              {groupSections.map((section) => {
                const collapsed = collapsedGroups[section.key] ?? true;
                return (
                  <div key={section.key} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapsed(section.key)}
                      className="flex w-full items-center justify-between rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2 text-left"
                    >
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{section.name}</span>
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                        {section.rows.length}
                        <ChevronIcon className="h-4 w-4" up={!collapsed} />
                      </span>
                    </button>

                    {!collapsed
                      ? section.rows.map((row) => {
                          const isExpanded = editorOpen && selectedId === row.id;

                          return (
                            <div
                              key={row.id}
                              className={`rounded-[1.15rem] border ${
                                isExpanded ? "border-[hsl(var(--primary))/0.4] bg-[hsl(var(--primary))/0.06]" : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 px-3 py-3">
                                <GripIcon className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                                <button
                                  type="button"
                                  onClick={() => toggleSeriesEditor(row)}
                                  className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-900"
                                >
                                  {row.title}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDuplicate(row.id)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                  title="Duplicate event"
                                  aria-label="Duplicate event"
                                >
                                  <CopyIcon className="h-[18px] w-[18px]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(row.id)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-500 hover:bg-slate-100 hover:text-rose-700"
                                  title="Delete event"
                                  aria-label="Delete event"
                                >
                                  <TrashIcon className="h-[18px] w-[18px]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleSeriesEditor(row)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                  title={isExpanded ? "Collapse details" : "Expand details"}
                                  aria-label={isExpanded ? "Collapse details" : "Expand details"}
                                >
                                  <ChevronIcon className="h-[18px] w-[18px]" up={isExpanded} />
                                </button>
                              </div>
                              {isExpanded ? renderEditorForm("mx-3 mb-3 space-y-3 rounded-[1rem] border border-slate-200 bg-slate-50 p-4") : null}
                            </div>
                          );
                        })
                      : null}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={openCreateEditor}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[1rem] border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
            >
              <PlusIcon className="h-[18px] w-[18px]" />
              Add an Event
            </button>

            {editorOpen && !selectedId ? renderEditorForm("mt-4 space-y-3 rounded-[1rem] border border-slate-200 bg-slate-50 p-4") : null}
          </div>
        </section>

        <section className={`${mobileView === "calendar" ? "block" : "hidden"} lg:block`}>
          <div className="clh-inset-group p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-slate-50 p-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Calendar Dashboard</h2>
                <p className="text-sm text-slate-500">Manage events, delete recurring occurrences, and copy your embed code.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openEmbedPopup}
                  className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(209,70,51,0.18)] hover:bg-[hsl(var(--primary))/0.9]"
                >
                  Generate Embed
                </button>
                <button
                  type="button"
                  onClick={() => void copySnippet()}
                  className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Copy Code
                </button>
              </div>
            </div>

            {copyState === "copied" ? <p className="mb-3 text-sm font-medium text-emerald-700">Embed code copied.</p> : null}
            {copyState === "failed" ? (
              <p className="mb-3 text-sm font-medium text-amber-700">Clipboard blocked. Use the popup window copy button.</p>
            ) : null}
            {error ? (
              <p className="mb-3 rounded-[1rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="rounded-[1.25rem] border border-slate-200 bg-white p-3">
              <PublicCalendar
                sourceUrl="/api/v1/calendar/events"
                onDeleteOccurrence={handleDeleteOccurrence}
                deletingOccurrenceId={deletingOccurrenceId}
                onDateClick={openCreateEditorForDate}
                onEventSelect={handleCalendarEventSelect}
                onEventDrop={handleMoveOccurrence}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
