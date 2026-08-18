import type { Need } from "@shared/schema";

export type NeedListItem = Need & {
  eventRolePreviewLabel?: string | null;
  eventLastDate?: string | null;
};
