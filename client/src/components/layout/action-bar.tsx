import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function ActionBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("clh-action-bar", className)} {...props} />;
}
