import type { Request, Response as ExpressResponse } from "express";

const DEFAULT_CALENDAR_BASE_URL = "https://clh-calendar.vercel.app";
const DEFAULT_TIMEOUT_MS = 20_000;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseTimeoutMs(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

function getCalendarBaseUrl(): string {
  return trimTrailingSlash(
    process.env.CALENDAR_COMPAT_BASE_URL ||
      process.env.CALENDAR_SOURCE_BASE_URL ||
      DEFAULT_CALENDAR_BASE_URL,
  );
}

function getCalendarTimeoutMs(): number {
  return parseTimeoutMs(process.env.CALENDAR_COMPAT_TIMEOUT_MS || process.env.CALENDAR_SOURCE_TIMEOUT_MS);
}

async function fetchWithTimeout(
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldIncludeRequestBody(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

function buildForwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    accept: String(req.headers.accept || "application/json, text/plain, */*"),
  };

  const passthroughHeaderNames = [
    "content-type",
    "idempotency-key",
    "if-none-match",
    "if-modified-since",
    "user-agent",
  ];

  for (const headerName of passthroughHeaderNames) {
    const value = req.headers[headerName];
    if (typeof value === "string" && value.trim().length > 0) {
      headers[headerName] = value;
    }
  }

  if (req.user) {
    headers["x-serving-network-subject-id"] = String(req.user.id ?? "");
    headers["x-serving-network-email"] = String(req.user.username ?? "");
    headers["x-serving-network-org-id"] = "clh";
    headers["x-serving-network-roles"] = req.user.isAdmin ? "admin" : "user";
  }

  return headers;
}

function buildProxyBody(req: Request): string | undefined {
  if (!shouldIncludeRequestBody(req.method)) return undefined;
  if (req.body === undefined || req.body === null) return undefined;
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body);
}

async function sendProxiedResponse(
  res: ExpressResponse,
  upstreamResponse: globalThis.Response,
): Promise<void> {
  res.status(upstreamResponse.status);

  const forwardResponseHeaders = [
    "content-type",
    "cache-control",
    "etag",
    "last-modified",
    "location",
    "content-disposition",
    "vary",
  ];

  for (const headerName of forwardResponseHeaders) {
    const headerValue = upstreamResponse.headers.get(headerName);
    if (headerValue) {
      res.setHeader(headerName, headerValue);
    }
  }

  const body = Buffer.from(await upstreamResponse.arrayBuffer());
  res.send(body);
}

export function getCalendarCompatibilityBaseUrl(): string {
  return getCalendarBaseUrl();
}

export async function proxyCalendarRequest(
  req: Request,
  res: ExpressResponse,
  options?: {
    upstreamPath?: string;
  },
): Promise<void> {
  const baseUrl = getCalendarBaseUrl();
  const timeoutMs = getCalendarTimeoutMs();
  const upstreamPath = options?.upstreamPath || req.originalUrl;
  const targetUrl = new URL(upstreamPath, `${baseUrl}/`).toString();

  const performRequest = async (): Promise<globalThis.Response> => {
    const headers = buildForwardHeaders(req);
    const body = buildProxyBody(req);
    if (body && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }

    return fetchWithTimeout(
      targetUrl,
      {
        method: req.method,
        headers,
        body,
        redirect: "manual",
      },
      timeoutMs,
    );
  };

  try {
    const upstreamResponse = await performRequest();
    await sendProxiedResponse(res, upstreamResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Calendar compatibility proxy request failed.";
    console.error("Calendar compatibility proxy failed:", message);
    res.status(502).json({
      success: false,
      error: "Calendar compatibility proxy failed",
      details: message,
    });
  }
}
