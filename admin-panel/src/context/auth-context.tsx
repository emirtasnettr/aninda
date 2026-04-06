"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { loginRequest } from "@/lib/api/auth";
import {
  clearAuthSession,
  getStoredUser,
  getToken,
  setAuthSession,
  subscribeAuth,
  type StoredUser,
} from "@/lib/auth-storage";

type AuthContextValue = {
  user: StoredUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** SSR + hidrasyon: getServerSnapshot her çağrıda aynı referansı döndürmeli */
const SERVER_AUTH_SNAPSHOT: { token: null; user: null } = {
  token: null,
  user: null,
};

type AuthSnapshot = { token: string | null; user: StoredUser | null };

function usersEqual(
  a: StoredUser | null,
  b: StoredUser | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.email === b.email && a.role === b.role;
}

/** getSnapshot her çağrıda yeni obje dönmemeli (sonsuz döngü); içerik aynıysa önbellek */
let clientSnapshotCache: AuthSnapshot | null = null;

function readAuthSnapshot(): AuthSnapshot {
  const token = getToken();
  const user = getStoredUser();
  const prev = clientSnapshotCache;
  if (prev && prev.token === token && usersEqual(prev.user, user)) {
    return prev;
  }
  clientSnapshotCache = { token, user };
  return clientSnapshotCache;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeAuth,
    readAuthSnapshot,
    () => SERVER_AUTH_SNAPSHOT,
  );

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email.trim(), password);
    setAuthSession(data.accessToken, data.user);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
  }, []);

  const value = useMemo(
    () => ({
      user: snapshot.user,
      token: snapshot.token,
      login,
      logout,
    }),
    [snapshot.token, snapshot.user, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
