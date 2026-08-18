import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Need, NeedType } from "@shared/schema";
import { Share } from "lucide-react";
import ShareDialog from "@/components/share-dialog";
import { formatDateInNewYork } from "@/lib/utils";
import { buildNeedShareUrl } from "@/lib/public-url";

interface NeedCompactCardProps {
  need: Need;
  onCardClick: (need: Need) => void;
}

const NeedCompactCard = ({ need, onCardClick }: NeedCompactCardProps) => {
  const [shareOpen, setShareOpen] = useState(false);

  // Create share URL pointing to the parent site
  const shareUrl = buildNeedShareUrl(
    need.id,
    import.meta.env.VITE_PUBLIC_URL as string | undefined,
  );

  // Handle sharing the need
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling to the card click
    setShareOpen(true);
  };
  
  // Format date for display
  const formatDate = (date?: Date | string | null) => {
    if (!date) return "";
    return formatDateInNewYork(date, {
      month: 'short',
      day: 'numeric'
    });
  };

  // Determine if the card should have a highlighted style
  const isHighlighted = need.isHighlighted;
  const highlightedClass = isHighlighted ? "border-t-4 border-t-yellow-400" : "border-t-4 border-t-[#d14633]";

  return (
    <>
    <Card
      className={`bg-white shadow overflow-hidden h-full cursor-pointer hover:shadow-md transition-shadow rounded-xl ${highlightedClass}`}
      onClick={() => onCardClick(need)}
    >
      <CardContent className="p-3">
        <div className="flex flex-col h-full">
          <div className="mb-2 flex items-center justify-end">
            {isHighlighted && (
              <span className="text-yellow-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 drop-shadow-sm" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </span>
            )}
          </div>

          {/* Title */}
          <div className="mb-2">
            <h3 className="text-sm font-bold text-[#212421] line-clamp-2 mb-1.5">{need.title}</h3>
            
            {/* Image Thumbnail - only show if image exists */}
            {need.imageUrl && (
              <div className="mb-2 overflow-hidden rounded-md">
                <img 
                  src={need.imageUrl} 
                  alt={need.title} 
                  className="h-24 w-full object-cover" 
                  onError={(e) => {
                    // Hide the image if it fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
            
          </div>

          {/* Date and Cost - in highlighted container */}
          <div className="bg-gray-50 p-2 rounded-md mt-1 flex items-center justify-between text-xs">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-[#197991]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">
                {need.eventDate ? (
                  <>Event: {formatDate(need.eventDate)}</>
                ) : need.neededBy ? (
                  <>By: {formatDate(need.neededBy)}</>
                ) : need.needType === "GROUP" ? (
                  <>One-time service project</>
                ) : need.needType === "ONGOING" ? (
                  <>Ongoing</>
                ) : (
                  <>One-time need</>
                )}
              </span>
            </div>
            {need.estimatedCost && (
              <span className="text-[#d14633] font-semibold">
                ${(need.estimatedCost / 100).toFixed(2)}
              </span>
            )}
          </div>

          {/* Card Footer */}
          <div className="mt-auto pt-3 flex justify-between items-center">
            <span className="text-xs text-[#197991] font-medium flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tap for details
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-6 w-6 rounded-full hover:bg-gray-100"
              onClick={handleShare}
            >
              <Share className="h-3.5 w-3.5 text-gray-600" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    <ShareDialog
      open={shareOpen}
      onOpenChange={setShareOpen}
      title={need.title}
      url={shareUrl}
    />
    </>
  );
};

export default NeedCompactCard;
