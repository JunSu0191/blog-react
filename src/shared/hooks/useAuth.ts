import { useState, useCallback, useEffect } from "react";
import * as userApi from "../../features/user/api";
import {
  clearAuthStorage,
  getToken,
  setUserId,
} from "../lib/auth";
import type { User } from "../context/auth.types";
import { disconnect } from "../socket/stompClient";

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const me = await userApi.getMe();
        if (cancelled) return;
        setUser(me);
        setUserId(me.id);
      } catch (error) {
        if (cancelled) return;
        console.warn("내 정보 동기화 실패:", error);
        if (!getToken()) {
          setTokenState(null);
          setUser(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    // 계정 전환 시 기존 소켓 세션을 끊어 이전 사용자 인증 컨텍스트를 제거한다.
    disconnect();
    const res = await userApi.login({ username, password });
    setTokenState(res.token ?? null);
    if (res.user) {
      setUser(res.user);
      setUserId(res.user.id);
    } else {
      setUser(null);
    }
    return res;
  }, []);

  const register = useCallback(
    async (username: string, name: string, password: string) => {
      disconnect();
      const res = await userApi.register({ username, name, password });
      setTokenState(res.token ?? null);
      if (res.user) {
        setUser(res.user);
        setUserId(res.user.id);
      } else {
        setUser(null);
      }
      return res;
    },
    []
  );

  const logout = useCallback(() => {
    disconnect();
    clearAuthStorage();
    setTokenState(null);
    setUser(null);
  }, []);

  return { token, user, login, register, logout };
}
