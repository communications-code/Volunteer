import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type StorageAccessDocument = Document & {
  hasStorageAccess?: () => Promise<boolean>;
  requestStorageAccess?: () => Promise<void>;
};

interface EmbeddedLoginAccessProps {
  compact?: boolean;
}

export function EmbeddedLoginAccess({ compact = false }: EmbeddedLoginAccessProps) {
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const isIframe = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.self !== window.top;
  }, []);

  const storageDoc = (typeof document !== "undefined" ? document : null) as StorageAccessDocument | null;
  const canRequestAccess = typeof storageDoc?.requestStorageAccess === "function";
  const canCheckAccess = typeof storageDoc?.hasStorageAccess === "function";

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (!isIframe) {
        setIsChecking(false);
        return;
      }

      if (!canCheckAccess || !storageDoc) {
        setHasAccess(false);
        setIsChecking(false);
        return;
      }

      try {
        const granted = await storageDoc.hasStorageAccess!();
        if (!cancelled) setHasAccess(Boolean(granted));
      } catch {
        if (!cancelled) setHasAccess(false);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    void checkAccess();
    return () => {
      cancelled = true;
    };
  }, [isIframe, canCheckAccess, storageDoc]);

  const handleEnableAccess = async () => {
    if (!isIframe || !storageDoc || !canRequestAccess) return;

    setIsRequesting(true);
    try {
      await storageDoc.requestStorageAccess!();
      setHasAccess(true);
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Embedded login enabled",
        description: "You can now sign in and save changes inside this embedded view.",
      });
    } catch {
      toast({
        title: "Could not enable embedded login",
        description: "Your browser blocked this request. Open the app in a full page tab and sign in there.",
        variant: "destructive",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleOpenFullPage = () => {
    if (typeof window === "undefined") return;
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  if (!isIframe) return null;

  const wrapperClass = compact
    ? "rounded-[1rem] border border-slate-200 bg-slate-50 p-3 space-y-2"
    : "rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 space-y-2";

  return (
    <div className={wrapperClass}>
      <p className="text-xs text-slate-700 flex items-center gap-1.5 font-medium">
        <ShieldCheck className="h-3.5 w-3.5" />
        Embedded mode detected
      </p>
      <p className="text-xs text-slate-600">
        Enable embedded login so admin actions (like saving edits) work reliably in this iframe.
      </p>
      <div className="flex flex-wrap gap-2">
        {canRequestAccess && (
          <Button
            type="button"
            size="sm"
            onClick={handleEnableAccess}
            disabled={isChecking || isRequesting || hasAccess}
            className="text-xs"
          >
            {isRequesting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
            {isChecking ? "Checking..." : hasAccess ? "Embedded login enabled" : "Enable embedded login"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpenFullPage}
          className="text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          Open full page
        </Button>
      </div>
    </div>
  );
}
