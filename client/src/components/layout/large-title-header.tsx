import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface LargeTitleHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function LargeTitleHeader({ title, subtitle, actions, className }: LargeTitleHeaderProps) {
  return (
    <div className={cn("clh-large-title-row", className)}>
      <div className="min-w-0">
        <h1 className="clh-large-title">{title}</h1>
        {subtitle ? <p className="clh-large-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="clh-large-title-actions">{actions}</div> : null}
    </div>
  );
}
