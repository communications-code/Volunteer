const CANONICAL_PUBLIC_ORIGIN = "https://vfwharrisonoh.org";
const FALLBACK_SERVE_URL = "https://vfwharrisonoh.org/volunteer/";

export type SortParam = "priority" | "neededBy" | "neededMonth";

function getCurrentAppUrl(): URL | null {
  if (typeof window === "undefined") return null;

  try {
    return new URL(window.location.href);
  } catch {
    return null;
  }
}

export function getCanonicalServeUrl(configuredUrl?: string): string {
  const raw = configuredUrl?.trim();
  if (!raw) return FALLBACK_SERVE_URL;

  let normalized = raw;
  if (raw.startsWith("/")) {
    normalized = new URL(raw, CANONICAL_PUBLIC_ORIGIN).toString();
  } else if (!/^https?:\/\//i.test(raw)) {
    normalized = `https://${raw}`;
  }

  try {
    const url = new URL(normalized);
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/volunteer/";
    }
    return url.toString();
  } catch {
    return FALLBACK_SERVE_URL;
  }
}

export function buildNeedShareUrl(needId: number | string, configuredUrl?: string): string {
  const url = new URL(getCanonicalServeUrl(configuredUrl));
  url.searchParams.set("need", String(needId));
  return url.toString();
}

export function buildNeedsTabShareUrl(params: {
  tabValues: string[];
  sortMode: SortParam;
  configuredUrl?: string;
}): string {
  const { tabValues, sortMode, configuredUrl } = params;
  const url = getCurrentAppUrl() ?? new URL(getCanonicalServeUrl(configuredUrl));

  if (tabValues.length === 0) {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", tabValues.join(","));
  }

  if (sortMode === "priority") {
    url.searchParams.delete("sort");
  } else if (sortMode === "neededBy") {
    url.searchParams.set("sort", "needed_by");
  } else {
    url.searchParams.set("sort", "month_needed");
  }

  url.searchParams.delete("status");
  url.searchParams.delete("need");
  url.hash = "";
  return url.toString();
}
