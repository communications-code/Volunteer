import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clearAuthToken, setAuthToken } from "@/lib/auth-token";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  requestMagicLinkMutation: UseMutationResult<MagicLinkResponse, Error, MagicLinkRequestData>;
  verifyMagicLinkMutation: UseMutationResult<SelectUser, Error, MagicLinkVerifyData>;
  logoutMutation: UseMutationResult<void, Error, void>;
};

type LoginData = Pick<InsertUser, "username" | "password">;
type LoginApiResponse = SelectUser & { authToken?: string };
type MagicLinkRequestData = {
  username: string;
};
type MagicLinkVerifyData = {
  token: string;
};
type MagicLinkResponse = {
  message: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

type StorageAccessDocument = Document & {
  requestStorageAccess?: () => Promise<void>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function tryEnableEmbeddedLoginAccess(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.self === window.top) return;

  const storageDoc = document as StorageAccessDocument;
  if (typeof storageDoc.requestStorageAccess !== "function") return;

  // Must run from a user-initiated action (the login submit click path).
  await storageDoc.requestStorageAccess();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    // Retry transient failures (cold starts/challenges), but don't retry
    // genuine auth failures.
    retry: (failureCount, queryError) => {
      if (
        queryError.message.startsWith("401") ||
        queryError.message.startsWith("403")
      ) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(700 * 2 ** attempt, 3000),
    // Allow stale data to be shown while refetching in background
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        // Best-effort only: do not let this block login forever.
        await Promise.race([tryEnableEmbeddedLoginAccess(), sleep(1200)]);
      } catch {
        // Continue and let server-side verification return a clearer message.
      }

      const res = await withTimeout(
        apiRequest("POST", "/api/login", credentials),
        25000,
        "Login request timed out. Please try again."
      );
      const response = (await res.json()) as LoginApiResponse;
      if (response.authToken) setAuthToken(response.authToken);
      const { authToken: _authToken, ...loginUser } = response;

      // Unblock UI immediately on successful login response, then revalidate
      // the session in the background.
      queryClient.setQueryData(["/api/user"], loginUser);
      void queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      return loginUser;
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login successful",
        description: `Welcome back${user.isAdmin ? ", admin" : ""}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const requestMagicLinkMutation = useMutation({
    mutationFn: async (payload: MagicLinkRequestData) => {
      const res = await withTimeout(
        apiRequest("POST", "/api/admin/auth/magic-link/request", payload),
        20000,
        "Magic link request timed out. Please try again."
      );
      return (await res.json()) as MagicLinkResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Check your email",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't send sign-in link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyMagicLinkMutation = useMutation({
    mutationFn: async (payload: MagicLinkVerifyData) => {
      const res = await withTimeout(
        apiRequest("POST", "/api/admin/auth/magic-link/verify", payload),
        25000,
        "Magic link sign-in timed out. Please try again."
      );
      const response = (await res.json()) as LoginApiResponse;
      if (response.authToken) setAuthToken(response.authToken);
      const { authToken: _authToken, ...loginUser } = response;
      queryClient.setQueryData(["/api/user"], loginUser);
      void queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      return loginUser;
    },
    onSuccess: (signedInUser) => {
      queryClient.setQueryData(["/api/user"], signedInUser);
      toast({
        title: "Signed in",
        description: "Magic link verified. You're now signed in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Magic link sign-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      clearAuthToken();
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logout successful",
        description: "You have been logged out.",
      });
    },
    onError: (error: Error) => {
      clearAuthToken();
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        requestMagicLinkMutation,
        verifyMagicLinkMutation,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
