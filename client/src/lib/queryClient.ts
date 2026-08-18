import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { clearAuthToken, getAuthToken } from "@/lib/auth-token";

/** Custom error class so retry logic can identify challenge blocks */
class VercelChallengeError extends Error {
  constructor() {
    super(
      "Request was temporarily blocked by a security check. Please refresh the page and try again."
    );
    this.name = "VercelChallengeError";
  }
}

/** Retry-worthy upstream/server failures (e.g. 5xx, 429) */
class RetryableRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableRequestError";
  }
}

const QUERY_FETCH_TIMEOUT_MS = 20000;
const MUTATION_FETCH_TIMEOUT_MS = 30000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    const isAbort =
      error instanceof DOMException
        ? error.name === "AbortError"
        : error instanceof Error && error.name === "AbortError";
    if (isAbort) {
      throw new RetryableRequestError("408: Request timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const mitigatedHeader = (res.headers.get("x-vercel-mitigated") || "").toLowerCase();
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const raw = (await res.text()) || res.statusText;
    const isChallengeBlocked =
      mitigatedHeader === "challenge" ||
      (res.status === 403 &&
        contentType.includes("text/html") &&
        /vercel|checkpoint|challenge/i.test(raw));

    if (isChallengeBlocked) {
      throw new VercelChallengeError();
    }

    if (res.status === 429 || res.status >= 500) {
      const retryText = raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
      throw new RetryableRequestError(`${res.status}: ${retryText}`);
    }

    // Avoid surfacing full HTML challenge/error pages in UI toasts.
    if (contentType.includes("text/html")) {
      throw new Error(
        `${res.status}: Unexpected HTML response from server. Please refresh and try again.`
      );
    }

    const text = raw.length > 400 ? `${raw.slice(0, 400)}...` : raw;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Challenge blocks happen before app code executes, so retrying once or twice
  // is safe and helps with Vercel Security Checkpoint flakiness.
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let res: Response;
    try {
      const authToken = getAuthToken();
      const headers: Record<string, string> = {};
      if (data) headers["Content-Type"] = "application/json";
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      res = await fetchWithTimeout(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      }, MUTATION_FETCH_TIMEOUT_MS);
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new RetryableRequestError("Network request failed");
      if (attempt >= maxAttempts) {
        throw lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
      continue;
    }

    try {
      await throwIfResNotOk(res);
      return res;
    } catch (error) {
      lastError = error;
      const shouldRetry =
        (error instanceof VercelChallengeError || error instanceof RetryableRequestError) &&
        attempt < maxAttempts;

      if (!shouldRetry) {
        throw error;
      }

      // Small exponential backoff for transient challenge blocks
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authToken = getAuthToken();
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetchWithTimeout(queryKey[0] as string, {
      headers,
      credentials: "include",
    }, QUERY_FETCH_TIMEOUT_MS);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      if (authToken) clearAuthToken();
      return null;
    }

    await throwIfResNotOk(res);

    // Guard against non-JSON responses (e.g. Vercel challenge HTML page)
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Unexpected response format. Please refresh the page.");
    }

    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Don't retry auth errors
        if (error instanceof Error && error.message.startsWith("401")) return false;

        // Vercel challenge blocks are transient — retry more aggressively (up to 3 times)
        if (error instanceof VercelChallengeError) return failureCount < 3;

        // Retry upstream/server failures a few times
        if (error instanceof RetryableRequestError) return failureCount < 3;

        // Don't retry other 403s (genuine permission errors)
        if (error instanceof Error && error.message.startsWith("403")) return false;

        // Retry other transient failures (cold starts, network blips) up to 2 times
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      retry: false,
    },
  },
});
