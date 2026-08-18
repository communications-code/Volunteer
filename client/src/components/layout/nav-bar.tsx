import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface NavBarProps {
  leading?: ReactNode;
  title?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function NavBar({ leading, title, trailing, className }: NavBarProps) {
  return (
    <div className={cn("clh-nav-bar", className)}>
      <div className="clh-nav-slot justify-start">{leading}</div>
      <div className="clh-nav-title">{title}</div>
      <div className="clh-nav-slot justify-end">{trailing}</div>
    </div>
  );
}
