import axios, { AxiosHeaders } from "axios";
import type { AxiosRequestConfig } from "axios";
import {
  clearAuthStorage,
  getRefreshToken,
  getToken,
  getUserId,
  getUserIdFromToken,
  isTokenExpired,
  setRefreshToken,
  setToken,
  setUserId,
} from "./auth";
import { normalizeApiBaseUrl } from "./networkRuntime";

// API 기본 URL
export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);

// 백엔드 API 응답 형식
export type ApiResponseTemplate<T = unknown> = {
  status: string | number;
  success: boolean;
  message?: string;
  data: T | null;
};

// 하위 호환 별칭
export type ApiResponse<T = unknown> = ApiResponseTemplate<T>;

export type ApiError = {
  status?: number | string;
  message: string;
  data?: unknown;
};

export function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  return status === 401 || status === "401" || status === "UNAUTHORIZED";
}

export type ApiRequestConfig = AxiosRequestConfig & {
  suppressForbiddenRedirect?: boolean;
};

export type ApiResponseMeta<T = unknown> = {
  data: T;
  status: number;
  headers: Record<string, string>;
};

type TokenRefreshResponse = {
  token: string;
  refreshToken?: string;
  userId?: number;
};

let refreshPromise: Promise<string | null> | null = null;
const apiClient = axios.create();

function shouldBypassRefresh(url: string) {
  return /\/auth\/(login|register|refresh)(\/|$)/.test(url);
}

function isAuthEndpoint(url: string) {
  return /\/auth(\/|$)/.test(url);
}

function normalizeRefreshPayload(raw: unknown): TokenRefreshResponse | null {
  if (!raw || typeof raw !== "object") return null;

  const wrapped = raw as ApiResponseTemplate<TokenRefreshResponse>;
  if ("success" in wrapped && "data" in wrapped) {
    if (!wrapped.success || !wrapped.data) return null;
    return wrapped.data;
  }

  const direct = raw as TokenRefreshResponse;
  if (typeof direct.token !== "string" || !direct.token) return null;
  return direct;
}

function redirectTo(path: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  window.location.replace(path);
}

function handleForbiddenRedirect() {
  redirectTo("/403");
}

function clearAuthOnUnauthorized() {
  clearAuthStorage();
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object") return {};

  if (headers instanceof AxiosHeaders) {
    const normalized = headers.toJSON();
    return Object.entries(normalized).reduce<Record<string, string>>(
      (accumulator, [key, value]) => {
        if (typeof value === "string") {
          accumulator[key.toLowerCase()] = value;
        } else if (Array.isArray(value)) {
          accumulator[key.toLowerCase()] = value.join(", ");
        } else if (typeof value === "number") {
          accumulator[key.toLowerCase()] = String(value);
        }
        return accumulator;
      },
      {},
    );
  }

  return Object.entries(headers as Record<string, unknown>).reduce<Record<string, string>>(
    (accumulator, [key, value]) => {
      if (typeof value === "string") {
        accumulator[key.toLowerCase()] = value;
      } else if (Array.isArray(value)) {
        accumulator[key.toLowerCase()] = value.join(", ");
      } else if (typeof value === "number") {
        accumulator[key.toLowerCase()] = String(value);
      }
      return accumulator;
    },
    {},
  );
}

apiClient.interceptors.request.use((config) => {
  const url = typeof config.url === "string" ? config.url : "";
  const bypassRefresh = shouldBypassRefresh(url);
  const authEndpoint = isAuthEndpoint(url);
  const headers = {
    ...((config.headers as Record<string, string> | undefined) ?? {}),
  };
  const token = getToken();

  if (token && !headers.Authorization && !bypassRefresh) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!authEndpoint && !headers["X-User-Id"] && !headers["x-user-id"]) {
    const resolvedUserId = getUserIdFromToken(token) ?? getUserId();
    if (typeof resolvedUserId === "number") {
      headers["X-User-Id"] = String(resolvedUserId);
    }
  }

  config.headers = AxiosHeaders.from(headers);
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const url = import.meta.env.VITE_AUTH_REFRESH_URL ?? `${API_BASE_URL}/auth/refresh`;
      const res = await axios.post(url, { refreshToken }, {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
          "X-Authorization": `Bearer ${refreshToken}`,
        },
      });
      const payload = normalizeRefreshPayload(res.data);
      if (!payload?.token) return null;

      setToken(payload.token);
      if (payload.refreshToken) setRefreshToken(payload.refreshToken);
      if (typeof payload.userId === "number") setUserId(payload.userId);
      return payload.token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function requestApi<T = unknown>(
  input: string,
  init?: ApiRequestConfig,
  retried = false,
): Promise<ApiResponseMeta<T>> {
  const bypassRefresh = shouldBypassRefresh(input);
  const suppressForbiddenRedirect = Boolean(init?.suppressForbiddenRedirect);
  const requestConfig = { ...(init ?? {}) } as ApiRequestConfig;
  delete requestConfig.suppressForbiddenRedirect;
  try {
    let token = getToken();
    if (!bypassRefresh && token && isTokenExpired(token)) {
      token = await refreshAccessToken();
      if (!token) {
        clearAuthStorage();
      }
    }

    const res = await apiClient.request<unknown>({
      ...requestConfig,
      url: input,
      headers: {
        ...((requestConfig.headers as Record<string, string> | undefined) ?? {}),
      },
    });

    const headers = normalizeHeaders(res.headers);

    if (res.status === 204 || typeof res.data === "undefined" || res.data === null) {
      return {
        data: undefined as T,
        status: res.status,
        headers,
      };
    }

    // 백엔드 응답 래퍼 형식(success/data) 지원
    if (
      typeof res.data === "object" &&
      res.data !== null &&
      "success" in res.data &&
      "data" in res.data
    ) {
      const apiRes = res.data as ApiResponseTemplate<T>;

      if (!apiRes.success) {
        const message = apiRes.message || "요청에 실패했습니다";
        throw { status: apiRes.status, message, data: apiRes.data } as ApiError;
      }

      return {
        data: apiRes.data as T,
        status: res.status,
        headers,
      };
    }

    // 일부 엔드포인트는 래퍼 없이 원시 데이터를 반환한다.
    return {
      data: res.data as T,
      status: res.status,
      headers,
    };
  } catch (err) {
    if (err && typeof err === "object" && "status" in err && "message" in err) {
      // 인증 에러 처리 (상태코드가 UNAUTHORIZED 문자열일 수도 있음)
      const status = (err as ApiError).status;
      if (
        status === 401 ||
        status === "UNAUTHORIZED"
      ) {
        if (!bypassRefresh && !retried) {
          const refreshed = await refreshAccessToken();
          if (refreshed) return requestApi<T>(input, init, true);
        }
        if (!bypassRefresh) {
          clearAuthOnUnauthorized();
        }
      }
      if (
        status === 403 &&
        !bypassRefresh &&
        !suppressForbiddenRedirect
      ) {
        handleForbiddenRedirect();
      }
      throw err;
    }

    // axios 에러 처리
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const responseData = err.response?.data as ApiResponseTemplate | undefined;

      // 서버 응답에서 메시지 추출 (responseData.message 우선, 그 다음 axios 기본 메시지)
      let message = err.message;

      if (
        responseData &&
        typeof responseData === "object" &&
        "message" in responseData
      ) {
        message = responseData.message || message;
      }

      const apiError = { status, message, data: responseData } as ApiError;

      if (status === 401) {
        if (!bypassRefresh && !retried) {
          const refreshed = await refreshAccessToken();
          if (refreshed) return requestApi<T>(input, init, true);
        }
        if (!bypassRefresh) {
          clearAuthOnUnauthorized();
        }
      }

      if (
        status === 403 &&
        !bypassRefresh &&
        !suppressForbiddenRedirect
      ) {
        handleForbiddenRedirect();
      }

      throw apiError;
    }

    // 기타 에러
    throw { message: String(err) } as ApiError;
  }
}

export async function api<T = unknown>(
  input: string,
  init?: ApiRequestConfig
): Promise<T> {
  const response = await requestApi<T>(input, init, false);
  return response.data;
}

export async function apiWithMeta<T = unknown>(
  input: string,
  init?: ApiRequestConfig
): Promise<ApiResponseMeta<T>> {
  return requestApi<T>(input, init, false);
}
