/**
 * This file is a wrapper around the actual implementation in need-card-new.tsx.
 * It passes through all props including admin overlays and onCardClick.
 */
import NeedCardImpl, { type NeedCardDensity } from './need-card-new';
import type { NeedListItem } from '@/types/need-list-item';

interface NeedCardProps {
  need: NeedListItem;
  onCardClick?: (need: NeedListItem) => void;
  onPledge?: (need: NeedListItem) => void;
  isAdmin?: boolean;
  onEdit?: (need: NeedListItem) => void;
  onDuplicateAndEdit?: (need: NeedListItem) => void;
  onDelete?: (need: NeedListItem) => void;
  onToggleHighlight?: (need: NeedListItem) => void;
  density?: NeedCardDensity;
}

const NeedCard = (props: NeedCardProps) => {
  return <NeedCardImpl {...props} />;
};

export default NeedCard;
export type { NeedCardDensity };
