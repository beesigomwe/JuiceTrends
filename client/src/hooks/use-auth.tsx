import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar: string | null;
};

export type AuthValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: { email: string; password: string }) => Promise<AuthUser>;
  signup: (data: { name: string; email: string; password: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  loginError: Error | null;
  signupError: Error | null;
  isLoggingIn: boolean;
  isSigningUp: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
  } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn<AuthUser | null>({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return (await res.json()) as AuthUser;
    },
    onSuccess: async () => {
      // Invalidate and refetch /api/auth/me so the browser sends the newly
      // committed session cookie before the redirect fires. Using setQueryData
      // alone races against the browser persisting the Set-Cookie header.
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/signup", data);
      return (await res.json()) as AuthUser;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
    },
  });

  const value: AuthValue = {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    signup: signupMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginError: loginMutation.error as Error | null,
    signupError: signupMutation.error as Error | null,
    isLoggingIn: loginMutation.isPending,
    isSigningUp: signupMutation.isPending,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
