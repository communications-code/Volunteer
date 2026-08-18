import { useState, type FormEvent } from "react";
import {
  Sparkles,
  Plus,
  ListChecks,
  FileEdit,
  Users,
  CalendarDays,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskHomeProps {
  openNeedsCount?: number | null;
  draftsCount?: number | null;
  signupsCount?: number | null;
  onAsk: (query: string) => Promise<{ answer?: string } | void>;
  onPostNeed: () => void;
  onManageNeeds: () => void;
  onReviewDrafts: () => void;
  onSignups: () => void;
  onCalendar: () => void;
}

const HERO_PLACEHOLDER = `Try "show open food drives" or "post a need for the Reyes family"`;

export function TaskHome({
  openNeedsCount,
  draftsCount,
  signupsCount,
  onAsk,
  onPostNeed,
  onManageNeeds,
  onReviewDrafts,
  onSignups,
  onCalendar,
}: TaskHomeProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setAnswer(null);
    try {
      const result = await onAsk(trimmed);
      if (result && "answer" in result && result.answer) {
        setAnswer(result.answer);
        setQuery("");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void ask(query);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-[#197991] bg-white px-4 py-3 shadow-sm transition focus-within:ring-2 focus-within:ring-[#197991]/30">
          <Sparkles className="h-5 w-5 shrink-0 text-[#197991]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={HERO_PLACEHOLDER}
            aria-label="Ask Claude or search needs"
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading || !query.trim()}
            className="shrink-0 bg-slate-900 text-white hover:bg-slate-800"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <SuggestionChip label="Open needs" onClick={onManageNeeds} />
          <SuggestionChip label="New sign-ups" onClick={onSignups} />
          <SuggestionChip label="Post a need" onClick={onPostNeed} />
          <SuggestionChip label="This week's events" onClick={onCalendar} />
        </div>
      </form>

      {answer ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#197991]/30 bg-[#197991]/5 p-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#197991]" />
          <p className="flex-1 text-sm leading-relaxed text-slate-700">{answer}</p>
          <button
            type="button"
            onClick={() => setAnswer(null)}
            aria-label="Dismiss answer"
            className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Or jump to a task</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TaskCard
            icon={Plus}
            title="Post a new need"
            description="Share a new need with the community"
            accent="primary"
            onClick={onPostNeed}
          />
          <TaskCard
            icon={ListChecks}
            title="Manage needs"
            description="View and update published needs"
            badge={formatCount(openNeedsCount)}
            onClick={onManageNeeds}
          />
          <TaskCard
            icon={FileEdit}
            title="Review drafts"
            description="Finish needs you've started"
            badge={draftsCount ? `${draftsCount} waiting` : undefined}
            badgeTone="attention"
            onClick={onReviewDrafts}
          />
          <TaskCard
            icon={Users}
            title="Event sign-ups"
            description="See who's volunteered"
            badge={formatCount(signupsCount)}
            onClick={onSignups}
          />
          <TaskCard
            icon={CalendarDays}
            title="Calendar"
            description="Add and edit events"
            onClick={onCalendar}
          />
        </div>
      </div>
    </div>
  );
}

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

interface TaskCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  badgeTone?: "neutral" | "attention";
  accent?: "primary" | "default";
  onClick: () => void;
}

function TaskCard({
  icon: Icon,
  title,
  description,
  badge,
  badgeTone = "neutral",
  accent = "default",
  onClick,
}: TaskCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl border bg-white p-4 text-left transition-colors hover:bg-slate-50",
        accent === "primary" ? "border-[#d14633]/60 hover:border-[#d14633]" : "border-slate-200 hover:border-slate-300",
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            accent === "primary" ? "bg-[#d14633]/10 text-[#d14633]" : "bg-[#197991]/10 text-[#197991]",
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {badge ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              badgeTone === "attention" ? "bg-[#d14633]/10 text-[#d14633]" : "bg-slate-100 text-slate-500",
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </button>
  );
}

function formatCount(count?: number | null): string | undefined {
  return typeof count === "number" ? String(count) : undefined;
}
