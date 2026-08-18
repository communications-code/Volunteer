import { useLocation } from "wouter";
import {
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  ExternalLink,
  FileEdit,
  HandHelping,
  LayoutDashboard,
  PlusCircle,
  Settings,
} from "lucide-react";

import CalendarAdminClient from "@/components/admin/calendar-admin-client";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ADMIN_CALENDAR_NAV = [
  { label: "Today", href: "/admin", icon: LayoutDashboard, group: "work" },
  { label: "Events", href: "/admin/events", icon: CalendarCheck2, group: "work" },
  { label: "Needs", href: "/admin/needs", icon: HandHelping, group: "work" },
  { label: "Drafts", href: "/admin/drafts", icon: FileEdit, group: "work" },
  { label: "Post a need", href: "/admin/new", icon: PlusCircle, group: "work" },
  { label: "Calendar", href: "/admin/calendar", icon: CalendarDays, group: "work" },
  { label: "Reports", href: "/admin/reports", icon: BarChart3, group: "system" },
  { label: "Settings", href: "/admin/settings", icon: Settings, group: "system" },
];

export default function AdminCalendarPage() {
  const [, navigate] = useLocation();

  const sidebar = (
    <div className="space-y-4">
      <div className="rounded-[1.25rem] bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-slate-900 text-white">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">Calendar</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
        </div>
      </div>

      {(["work", "system"] as const).map((group) => (
        <div key={group} className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {group === "work" ? "Work" : "System"}
          </p>
          {ADMIN_CALENDAR_NAV.filter((item) => item.group === group).map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/admin/calendar";
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => navigate(item.href)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-[1rem] border px-3 py-2 text-left text-sm font-medium transition-colors",
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-current" : "text-slate-500")} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <AdminShell
      title="Calendar"
      subtitle="Manage the public calendar directly inside Serving Network."
      sidebar={sidebar}
      topActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin")}>
            Today
          </Button>
          <Button asChild>
            <a href="/calendar" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open Public Page
            </a>
          </Button>
        </div>
      }
    >
      <CalendarAdminClient onBack={() => navigate("/admin")} />
    </AdminShell>
  );
}
