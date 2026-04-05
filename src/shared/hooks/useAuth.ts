import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as userApi from "../../features/user/api";
import {
  clearAuthStorage,
  getToken,
  setToken,
  setUserId,
} from "../lib/auth";
import type { User } from "../context/auth.types";
import { disconnect } from "../socket/stompClient";

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(() => Boolean(getToken()));

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
        if (me) {
          setUser(me);
          setUserId(me.id);
          queryClient.setQueryData(userApi.AUTH_ME_QUERY_KEY, me);
          return;
        }

        setUser(null);
        queryClient.setQueryData(userApi.AUTH_ME_QUERY_KEY, null);
        if (token) {
          clearAuthStorage();
          setTokenState(null);
        }
      } catch {
        if (cancelled) return;
        setUser(null);
        queryClient.removeQueries({ queryKey: userApi.AUTH_ME_QUERY_KEY });
        if (token) {
          clearAuthStorage();
          setTokenState(null);
        }
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

  const loginWithToken = useCallback(
    async (rawToken: string) => {
      const normalizedToken = rawToken.replace(/^Bearer\s+/i, "").trim();
      if (!normalizedToken) {
        throw new Error("유효한 인증 토큰이 없습니다.");
      }

      disconnect();
      clearAuthStorage();
      setToken(normalizedToken);
      setTokenState(normalizedToken);
      setUser(null);
      queryClient.removeQueries({ queryKey: userApi.AUTH_ME_QUERY_KEY });
      setIsLoadingUser(true);

      try {
        const me = await userApi.getMe();
        if (!me) {
          throw new Error("로그인 사용자 정보를 확인할 수 없습니다.");
        }
        setUser(me);
        setUserId(me.id);
        queryClient.setQueryData(userApi.AUTH_ME_QUERY_KEY, me);
        return me;
      } catch (error) {
        clearAuthStorage();
        setTokenState(null);
        setUser(null);
        queryClient.removeQueries({ queryKey: userApi.AUTH_ME_QUERY_KEY });
        throw error;
      } finally {
        setIsLoadingUser(false);
      }
    },
    [queryClient],
  );

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setIsLoadingUser(false);
      queryClient.removeQueries({ queryKey: userApi.AUTH_ME_QUERY_KEY });
      return null;
    }

    setIsLoadingUser(true);
    try {
      const me = await userApi.getMe();
      if (!me) {
        setUser(null);
        queryClient.setQueryData(userApi.AUTH_ME_QUERY_KEY, null);
        clearAuthStorage();
        setTokenState(null);
        return null;
      }

      setUser(me);
      setUserId(me.id);
      queryClient.setQueryData(userApi.AUTH_ME_QUERY_KEY, me);
      return me;
    } catch (error) {
      setUser(null);
      queryClient.removeQueries({ queryKey: userApi.AUTH_ME_QUERY_KEY });
      clearAuthStorage();
      setTokenState(null);
      throw error;
    } finally {
      setIsLoadingUser(false);
    }
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

  return {
    token,
    user,
    isLoadingUser,
    login,
    loginWithToken,
    refreshUser,
    register,
    logout,
  };
}
