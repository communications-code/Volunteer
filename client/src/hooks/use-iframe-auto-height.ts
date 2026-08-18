import { useEffect } from "react";

const IFRAME_HEIGHT_MESSAGE_TYPE = "SN_IFRAME_HEIGHT";

function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function resolveTargetOrigin(): string {
  const paramsOrigin = toOrigin(new URLSearchParams(window.location.search).get("parentOrigin"));
  if (paramsOrigin) return paramsOrigin;

  const referrerOrigin = toOrigin(document.referrer);
  if (referrerOrigin) return referrerOrigin;

  return "*";
}

function getDocumentHeight(): number {
  const html = document.documentElement;
  const body = document.body;

  return Math.max(
    html.scrollHeight,
    html.offsetHeight,
    html.clientHeight,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    body?.clientHeight ?? 0,
  );
}

export function useIframeAutoHeight() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.self === window.top) return;

    const targetOrigin = resolveTargetOrigin();
    let rafId: number | null = null;
    let lastHeight = 0;

    const postHeight = () => {
      rafId = null;

      const nextHeight = Math.ceil(getDocumentHeight());
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
      if (nextHeight === lastHeight) return;

      lastHeight = nextHeight;
      window.parent.postMessage(
        {
          type: IFRAME_HEIGHT_MESSAGE_TYPE,
          height: nextHeight,
        },
        targetOrigin,
      );
    };

    const schedulePost = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(postHeight);
    };

    schedulePost();

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(schedulePost) : null;
    resizeObserver?.observe(document.documentElement);
    if (document.body) resizeObserver?.observe(document.body);

    const mutationObserver = new MutationObserver(schedulePost);
    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    const pollId = window.setInterval(schedulePost, 1000);
    window.addEventListener("load", schedulePost);
    window.addEventListener("resize", schedulePost);
    window.addEventListener("orientationchange", schedulePost);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.clearInterval(pollId);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("load", schedulePost);
      window.removeEventListener("resize", schedulePost);
      window.removeEventListener("orientationchange", schedulePost);
    };
  }, []);
}

