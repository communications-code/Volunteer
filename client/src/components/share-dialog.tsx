import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Copy, ExternalLink, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string;
  heading?: string;
  description?: string;
  shareText?: string;
}

let lastPointerPosition: { x: number; y: number } | null = null;

function SharePanel({
  title,
  url,
  shareText,
  copied,
  onCopy,
  canShare,
}: {
  title: string;
  url: string;
  shareText: string;
  copied: boolean;
  onCopy: () => void;
  canShare: boolean;
}) {
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}${
    shareText ? `&quote=${encodeURIComponent(shareText)}` : ""
  }`;

  return (
    <div className="space-y-4">
      <input
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
        aria-label="Share link"
      />
      <div className="grid gap-3">
        <Button type="button" variant="outline" onClick={onCopy} className="w-full justify-start">
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button type="button" variant="outline" asChild className="w-full justify-start" disabled={!canShare}>
          <a
            href={canShare ? `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}` : undefined}
          >
            <Mail className="h-4 w-4" />
            Share by email
          </a>
        </Button>
        <Button type="button" variant="outline" asChild className="w-full justify-start" disabled={!canShare}>
          <a href={canShare ? facebookShareUrl : undefined} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Share on Facebook
          </a>
        </Button>
      </div>
    </div>
  );
}

async function copyText(text: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back below. Embedded frames can block the async Clipboard API.
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function isEmbedded() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function openCopyHelper(text: string, title: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const popup = window.open("", "clhShareCopyHelper", "width=520,height=360,resizable=yes,scrollbars=yes");
  if (!popup) {
    return false;
  }

  const escapedText = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const escapedTitle = title
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  popup.document.open();
  popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Copy Share Link</title>
    <style>
      body { margin: 0; padding: 22px; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
      .card { border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; padding: 18px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.14); }
      h1 { margin: 0 0 8px; font-size: 18px; line-height: 1.25; }
      p { margin: 0 0 14px; color: #475569; font-size: 14px; line-height: 1.45; }
      input { box-sizing: border-box; width: 100%; border: 1px solid #cbd5e1; border-radius: 12px; padding: 11px 12px; font-size: 14px; color: #0f172a; background: #f8fafc; }
      .actions { display: flex; gap: 10px; margin-top: 14px; }
      button, a { appearance: none; border: 0; border-radius: 10px; padding: 10px 13px; font-weight: 700; font-size: 14px; cursor: pointer; text-decoration: none; }
      button { background: #1d4ed8; color: #fff; }
      a { background: #e2e8f0; color: #0f172a; }
      .status { min-height: 18px; margin-top: 12px; color: #047857; font-size: 13px; font-weight: 650; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Copy share link</h1>
      <p>Your browser blocked clipboard access inside the embedded Serving Network frame. Copy the link from this top-level window.</p>
      <input id="shareLink" readonly value="${escapedText}" aria-label="Share link for ${escapedTitle}" />
      <div class="actions">
        <button id="copyButton" type="button">Copy Link</button>
        <a href="${escapedText}" target="_blank" rel="noreferrer">Open Link</a>
      </div>
      <div id="status" class="status"></div>
    </div>
    <script>
      const input = document.getElementById("shareLink");
      const status = document.getElementById("status");
      const selectLink = () => {
        input.focus();
        input.select();
        input.setSelectionRange(0, input.value.length);
      };
      document.getElementById("copyButton").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(input.value);
          status.textContent = "Link copied.";
        } catch {
          selectLink();
          status.textContent = "Clipboard blocked. The link is selected for manual copy.";
        }
      });
      selectLink();
    </script>
  </body>
</html>`);
  popup.document.close();
  popup.focus();
  return true;
}

export default function ShareDialog({
  open,
  onOpenChange,
  title,
  url,
  heading,
  description,
  shareText: shareTextOverride,
}: ShareDialogProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [mobilePosition, setMobilePosition] = useState({ top: "1rem", left: "50%" });

  const shareText = shareTextOverride || `Check out this need at VFW Post 7570: ${title}`;
  const shareUrl = url?.trim() || "";
  const canShare = shareUrl.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savePointerPosition = (event: PointerEvent) => {
      lastPointerPosition = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("pointerdown", savePointerPosition, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", savePointerPosition, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !isMobile || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const rect = activeElement?.getBoundingClientRect();
    const anchorX = lastPointerPosition?.x ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const anchorY = lastPointerPosition?.y ?? rect?.top ?? 100;
    const dialogWidth = Math.min(window.innerWidth - 24, 352);
    const halfWidth = dialogWidth / 2;
    const left = Math.min(Math.max(anchorX, halfWidth + 12), window.innerWidth - halfWidth - 12);
    const top = Math.max(12, anchorY - 84);

    setMobilePosition({ top: `${top}px`, left: `${left}px` });
  }, [isMobile, open]);

  const copyToClipboard = async () => {
    const textToCopy = shareUrl;
    if (!textToCopy) {
      toast({
        title: "No link available",
        description: "There is no link to copy right now.",
        variant: "destructive",
      });
      return;
    }

    const copiedSuccessfully = await copyText(textToCopy);
    if (copiedSuccessfully) {
      setCopied(true);
      toast({
        title: "Link copied",
        description: "The share link has been copied to your clipboard.",
      });
      onOpenChange(false);
    } else if (isEmbedded() && openCopyHelper(textToCopy, title)) {
      toast({
        title: "Copy helper opened",
        description: "Your browser blocked iframe clipboard access, so the link opened in a copy window.",
      });
      onOpenChange(false);
    } else {
      toast({
        title: "Copy unavailable",
        description: "Select the link in the share menu and copy it manually.",
        variant: "destructive",
      });
    }
  };

  const panel = (
    <SharePanel
      title={title}
      url={shareUrl}
      shareText={shareText}
      copied={copied}
      onCopy={copyToClipboard}
      canShare={canShare}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isMobile
            ? "left-[var(--share-dialog-left)] top-[var(--share-dialog-top)] w-[calc(100vw-1.5rem)] max-w-[22rem] translate-y-0 rounded-2xl p-4"
            : "sm:max-w-md"
        }
        style={
          isMobile
            ? ({
                "--share-dialog-top": mobilePosition.top,
                "--share-dialog-left": mobilePosition.left,
              } as CSSProperties)
            : undefined
        }
      >
        <DialogHeader>
          <DialogTitle>{heading || "Share"}</DialogTitle>
          <DialogDescription>{description || `Share \"${title}\" using your device or a simple link.`}</DialogDescription>
        </DialogHeader>
        {panel}
      </DialogContent>
    </Dialog>
  );
}
