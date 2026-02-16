import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as userApi from "../../features/user/api";
import {
  clearAuthStorage,
  getToken,
  setUserId,
} from "../lib/auth";
import type { User } from "../context/auth.types";
import { disconnect } from "../socket/stompClient";

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoadingUser(false);
      queryClient.removeQueries({ queryKey: userApi.AUTH_ME_QUERY_KEY });
      return;
    }

    let cancelled = false;
    setIsLoadingUser(true);

    void (async () => {
      try {
        const me = await userApi.getMe();
        if (cancelled) return;
        setUser(me);
        setUserId(me.id);
        queryClient.setQueryData(userApi.AUTH_ME_QUERY_KEY, me);
      } catch (error) {
        if (cancelled) return;
        console.warn("내 정보 동기화 실패:", error);
        setUser(null);
      } finally {
        if (cancelled) return;
        setIsLoadingUser(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient, token]);

  const login = useCallback(async (username: string, password: string) => {
    // 계정 전환 시 기존 소켓 세션을 끊어 이전 사용자 인증 컨텍스트를 제거한다.
    disconnect();
    const res = await userApi.login({ username, password });
    setTokenState(res.token ?? null);
    if (res.user) {
      setUser(res.user);
      setUserId(res.user.id);
      queryClient.setQueryData(userApi.AUTH_ME_QUERY_KEY, res.user);
    } else {
      setUser(null);
      queryClient.removeQueries({ queryKey: userApi.AUTH_ME_QUERY_KEY });
    }
    return res;
  }, [queryClient]);

  const register = useCallback(
    async (username: string, name: string, password: string) => {
      disconnect();
      const res = await userApi.register({ username, name, password });
      setTokenState(res.token ?? null);
      if (res.user) {
        setUser(res.user);
        setUserId(res.user.id);
        queryClient.setQueryData(userApi.AUTH_ME_QUERY_KEY, res.user);
      } else {
        setUser(null);
        queryClient.removeQueries({ queryKey: userApi.AUTH_ME_QUERY_KEY });
      }
      return res;
    },
    [queryClient]
  );

  const logout = useCallback(() => {
    disconnect();
    clearAuthStorage();
    setTokenState(null);
    setUser(null);
    setIsLoadingUser(false);
    queryClient.removeQueries({ queryKey: userApi.AUTH_ME_QUERY_KEY });
  }, [queryClient]);

  return { token, user, isLoadingUser, login, register, logout };
}
