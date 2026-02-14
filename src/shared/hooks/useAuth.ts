import { useState, useCallback, useMemo } from "react";
import * as userApi from "../../features/user/api";
import {
  clearAuthStorage,
  clearUserId,
  getToken,
  getUserId,
  getUserIdFromToken,
  setUserId,
} from "../lib/auth";
import type { User } from "../context/auth.types";
import { disconnect } from "../socket/stompClient";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + padding);
}

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [authUserId, setAuthUserId] = useState<number | null>(() => getUserId());

  // 토큰에서 사용자 정보 추출 (간단한 구현)
  const user = useMemo<User | null>(() => {
    if (!token) return null;
    try {
      // JWT 토큰에서 payload 추출 (실제로는 서버에서 받은 정보 사용)
      const parts = token.split(".");
      if (parts.length !== 3) {
        return authUserId ? { id: authUserId, username: "" } : null;
      }
      const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
      const userIdFromToken = getUserIdFromToken(token);
      const userId = userIdFromToken ?? authUserId ?? undefined;
      if (!userId) return null;

      return {
        id: userId,
        username:
          (typeof payload.username === "string" && payload.username) ||
          (typeof payload.sub === "string" && payload.sub) ||
          "",
        name: typeof payload.name === "string" ? payload.name : undefined,
      };
    } catch (error) {
      console.warn("토큰 파싱 실패:", error);
      return authUserId ? { id: authUserId, username: "" } : null;
    }
  }, [authUserId, token]);

  const login = useCallback(async (username: string, password: string) => {
    // 계정 전환 시 기존 소켓 세션을 끊어 이전 사용자 인증 컨텍스트를 제거한다.
    disconnect();
    const res = await userApi.login({ username, password });
    setTokenState(res.token ?? null);
    const userId = typeof res.userId === "number" ? res.userId : getUserIdFromToken(res.token);
    setAuthUserId(userId);
    if (userId !== null) setUserId(userId);
    else clearUserId();
    return res;
  }, []);

  const register = useCallback(
    async (username: string, name: string, password: string) => {
      disconnect();
      const res = await userApi.register({ username, name, password });
      setTokenState(res.token ?? null);
      const userId = typeof res.userId === "number" ? res.userId : getUserIdFromToken(res.token);
      setAuthUserId(userId);
      if (userId !== null) setUserId(userId);
      else clearUserId();
      return res;
    },
    []
  );

  const logout = useCallback(() => {
    disconnect();
    clearAuthStorage();
    setTokenState(null);
    setAuthUserId(null);
  }, []);

  return { token, user, login, register, logout };
}
