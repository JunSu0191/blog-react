import { api, API_BASE_URL } from "../../shared/lib/api";
import {
  setRefreshToken,
  setToken,
  setUserId,
} from "../../shared/lib/auth";
import type { UserRole, UserStatus } from "@/shared/context/auth.types";

const BASE = API_BASE_URL;
export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

export type LoginRequest = {
  username: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
  name: string;
};

export type AuthUser = {
  id: number;
  username: string;
  name: string;
  role?: UserRole;
  status?: UserStatus;
  mustChangePassword?: boolean;
};

export type AuthResponse = {
  token: string;
  refreshToken?: string;
  user?: AuthUser;
  userId?: number;
};

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "y", "yes"].includes(normalized)) return true;
    if (["false", "0", "n", "no"].includes(normalized)) return false;
  }
  return undefined;
}

function normalizeRole(value: unknown): UserRole | undefined {
  const normalized = toText(value)?.toUpperCase();
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "USER") return "USER";
  return undefined;
}

function normalizeStatus(value: unknown): UserStatus | undefined {
  const normalized = toText(value)?.toUpperCase();
  if (normalized === "ACTIVE") return "ACTIVE";
  if (normalized === "SUSPENDED") return "SUSPENDED";
  return undefined;
}

function normalizeAuthUser(raw: unknown): AuthUser | undefined {
  const obj = toObject(raw);
  if (!obj) return undefined;

  const id = toFiniteNumber(obj.id) ?? toFiniteNumber(obj.userId);
  if (typeof id !== "number") return undefined;

  const username = toText(obj.username) || `user-${id}`;
  const name = toText(obj.name) || toText(obj.displayName) || username;
  const mustChangePassword =
    toBoolean(obj.mustChangePassword) ??
    toBoolean(obj.must_change_password) ??
    toBoolean(obj.passwordChangeRequired) ??
    toBoolean(obj.password_change_required);

  return {
    id,
    username,
    name,
    role: normalizeRole(obj.role),
    status: normalizeStatus(obj.status),
    mustChangePassword,
  };
}

function normalizeAuthResponse(raw: unknown): AuthResponse {
  const obj = toObject(raw) ?? {};
  const nestedUser =
    toObject(obj.user) ??
    toObject(obj.member) ??
    toObject(obj.account) ??
    toObject(obj.profile);
  const user = normalizeAuthUser(nestedUser) ?? normalizeAuthUser(obj);

  return {
    token: toText(obj.token) || "",
    refreshToken: toText(obj.refreshToken) || toText(obj.refresh_token),
    user,
    userId: toFiniteNumber(obj.userId) ?? toFiniteNumber(obj.user_id) ?? user?.id,
  };
}

function resolveUserId(data: AuthResponse): number | undefined {
  if (typeof data.user?.id === "number") return data.user.id;
  if (typeof data.userId === "number") return data.userId;
  return undefined;
}

export async function login(req: LoginRequest): Promise<AuthResponse> {
  const raw = await api<unknown>(`${BASE}/auth/login`, {
    method: "POST",
    data: req,
  });
  const data = normalizeAuthResponse(raw);

  if (data?.token) setToken(data.token);
  if (data?.refreshToken) setRefreshToken(data.refreshToken);
  const userId = resolveUserId(data);
  if (typeof userId === "number") setUserId(userId);
  return data;
}

export async function register(req: RegisterRequest): Promise<AuthResponse> {
  const raw = await api<unknown>(`${BASE}/auth/register`, {
    method: "POST",
    data: req,
  });
  const data = normalizeAuthResponse(raw);

  if (data?.token) setToken(data.token);
  if (data?.refreshToken) setRefreshToken(data.refreshToken);
  const userId = resolveUserId(data);
  if (typeof userId === "number") setUserId(userId);
  return data;
}

export async function getMe(): Promise<AuthUser | null> {
  const raw = await api<unknown>(`${BASE}/auth/me`, {
    method: "GET",
  });
  if (raw === null || typeof raw === "undefined") {
    return null;
  }
  const data = normalizeAuthUser(raw);
  if (!data) {
    throw new Error("내 정보 조회 응답 형식이 올바르지 않습니다.");
  }
  if (typeof data?.id === "number") {
    setUserId(data.id);
  }
  return data;
}
