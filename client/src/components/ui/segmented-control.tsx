import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  badge?: number | null;
};

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: Array<SegmentOption<T>>;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("clh-segmented-control", className)} role="tablist" aria-orientation="horizontal">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn("clh-segmented-control-item", isActive && "is-active")}
            onClick={() => onValueChange(option.value)}
          >
            {option.icon ? <span className="clh-segmented-control-icon">{option.icon}</span> : null}
            <span>{option.label}</span>
            {typeof option.badge === "number" ? (
              <span className={cn("clh-segmented-control-badge", isActive && "is-active")}>{option.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
