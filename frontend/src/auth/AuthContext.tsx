import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { clearToken, fetchMe, getToken, login as apiLogin, setToken, type Me } from "../api/client";

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      return;
    }
    try {
      setMe(await fetchMe());
    } catch {
      setMe(null);
    }
  }, []);

  // 최초 마운트 + 새로고침 시 항상 /me로 최신 인증·hasProfile 상태를 확인한다.
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // 어느 API든 401을 받으면(토큰 만료 등) 로그아웃 처리해 로그인 화면으로 유도한다.
  useEffect(() => {
    const onUnauthorized = () => setMe(null);
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<Me> => {
    const result = await apiLogin(email, password);
    setToken(result.token);
    const nextMe: Me = {
      userId: result.userId,
      email: result.email,
      hasProfile: result.hasProfile,
      role: result.role,
    };
    setMe(nextMe);
    return nextMe;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, login, logout, refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
