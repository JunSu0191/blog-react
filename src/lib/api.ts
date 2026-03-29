import axios, { AxiosHeaders } from "axios";
import { clearAuthStorage, getToken } from "@/shared/lib/auth";
import { parseApiError } from "./apiError";

const DEFAULT_LOCAL_API_PORT = 8080;
const DEFAULT_WEB_PORT = 5173;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function ensureAbsoluteUrl(raw: string, fallbackOrigin: string) {
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return new URL(raw, fallbackOrigin).toString();
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getBrowserOrigin() {
  if (typeof window === "undefined") return null;
  return window.location.origin;
}

function normalizeApiBaseUrl(raw?: string) {
  const browserOrigin = getBrowserOrigin();
  const trimmed = raw?.trim();

  if (trimmed) {
    const absolute = ensureAbsoluteUrl(trimmed, browserOrigin ?? "http://localhost");
    return trimTrailingSlash(absolute).replace(/\/api$/i, "");
  }

  if (!browserOrigin) {
    return `http://localhost:${DEFAULT_LOCAL_API_PORT}`;
  }

  const parsed = new URL(browserOrigin);
  if (isLoopbackHost(parsed.hostname)) {
    return `${parsed.protocol}//${parsed.hostname}:${DEFAULT_LOCAL_API_PORT}`;
  }

  return browserOrigin;
}

function normalizeWebBaseUrl(raw?: string) {
  const browserOrigin = getBrowserOrigin();
  const trimmed = raw?.trim();

  if (trimmed) {
    const absolute = ensureAbsoluteUrl(trimmed, browserOrigin ?? "http://localhost");
    return trimTrailingSlash(absolute);
  }

  if (browserOrigin) {
    return trimTrailingSlash(browserOrigin);
  }

  return `http://localhost:${DEFAULT_WEB_PORT}`;
}

function handleUnauthorized() {
  clearAuthStorage();
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);
export const WEB_BASE_URL = normalizeWebBaseUrl(import.meta.env.VITE_WEB_BASE_URL as string | undefined);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (!token) return config;

  const headers = AxiosHeaders.from(config.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  config.headers = headers;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const parsed = parseApiError(error);

    if (parsed.status === 401) {
      handleUnauthorized();
    }

    return Promise.reject(parsed);
  },
);
