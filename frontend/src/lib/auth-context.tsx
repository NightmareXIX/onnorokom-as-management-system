"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  api,
  getStoredAuth,
  setStoredAuth,
  setUnauthorizedHandler,
  type StoredAuth,
} from "./api";
import { UserRole, type LoginResponse } from "./types";

interface AuthContextValue {
  token: string | null;
  role: UserRole | null;
  fullName: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function roleHomePath(role: UserRole): string {
  switch (role) {
    case UserRole.Teacher:
      return "/teacher";
    case UserRole.Student:
      return "/student";
    case UserRole.Admin:
      return "/admin";
    default:
      return "/login";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Reading localStorage during render (even via a lazy useState initializer) would
    // return different values on the server vs. the client and trigger a hydration
    // mismatch, so this one-time sync of persisted auth has to happen in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuth(getStoredAuth());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // The api client clears storage on a 401 from any non-login call; mirror that
    // into React state and send the user back to /login.
    setUnauthorizedHandler(() => {
      setAuth(null);
      router.replace("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.post<LoginResponse>("/auth/login", { email, password });
      const nextAuth: StoredAuth = {
        token: response.data.token,
        role: response.data.role,
        fullName: response.data.fullName,
      };
      setStoredAuth(nextAuth);
      setAuth(nextAuth);
      router.push(roleHomePath(nextAuth.role));
    },
    [router]
  );

  const logout = useCallback(() => {
    setStoredAuth(null);
    setAuth(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        token: auth?.token ?? null,
        role: auth?.role ?? null,
        fullName: auth?.fullName ?? null,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
