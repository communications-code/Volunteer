import type { ReactNode } from "react";

import { NavBar } from "@/components/layout/nav-bar";
import { LargeTitleHeader } from "@/components/layout/large-title-header";
import { cn } from "@/lib/utils";

interface AdminShellProps {
  title: string;
  subtitle?: string;
  sidebar: ReactNode;
  children: ReactNode;
  topActions?: ReactNode;
  titleActions?: ReactNode;
  contentClassName?: string;
}

export function AdminShell({
  title,
  subtitle,
  sidebar,
  children,
  topActions,
  titleActions,
  contentClassName,
}: AdminShellProps) {
  return (
    <div className="clh-admin-shell">
      <div className="clh-admin-frame">
        <NavBar
          leading={<span className="text-sm font-semibold text-slate-700">VFW Serving Network Admin</span>}
          title={<span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Post CRM Workspace</span>}
          trailing={topActions}
        />

        <LargeTitleHeader title={title} subtitle={subtitle} actions={titleActions} className="pb-4" />

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <aside className="clh-admin-sidebar">{sidebar}</aside>
          <section className={cn("min-w-0 space-y-4", contentClassName)}>{children}</section>
        </div>
      </div>
    </div>
  );
}
