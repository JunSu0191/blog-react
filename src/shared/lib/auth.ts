const TOKEN_KEY = "auth.token";
const REFRESH_TOKEN_KEY = "auth.refreshToken";
const USER_ID_KEY = "auth.userId";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string) {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {}
}

export function getUserId(): number | null {
  try {
    const raw = localStorage.getItem(USER_ID_KEY);
    if (!raw) return null;
    const userId = Number(raw);
    return Number.isFinite(userId) ? userId : null;
  } catch {
    return null;
  }
}

export function setUserId(userId: number) {
  try {
    localStorage.setItem(USER_ID_KEY, String(userId));
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function clearRefreshToken() {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
}

export function clearUserId() {
  try {
    localStorage.removeItem(USER_ID_KEY);
  } catch {}
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + padding);
}

function getTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function getUserIdFromToken(token?: string | null): number | null {
  const target = token ?? getToken();
  if (!target) return null;
  const payload = getTokenPayload(target);
  if (!payload) return null;

  const directCandidates = [
    payload.userId,
    payload.user_id,
    payload.id,
    payload.uid,
    payload.sub,
    payload.memberId,
    payload.member_id,
    payload.accountId,
    payload.account_id,
    payload.userNo,
    payload.user_no,
    payload.no,
  ];

  for (const candidate of directCandidates) {
    const parsed = toFiniteNumber(candidate);
    if (parsed !== null) return parsed;
  }

  const nestedCandidates = [payload.user, payload.member, payload.account];
  for (const nested of nestedCandidates) {
    if (!nested || typeof nested !== "object") continue;
    const obj = nested as Record<string, unknown>;
    const parsed =
      toFiniteNumber(obj.userId) ??
      toFiniteNumber(obj.user_id) ??
      toFiniteNumber(obj.id) ??
      toFiniteNumber(obj.uid) ??
      toFiniteNumber(obj.memberId) ??
      toFiniteNumber(obj.member_id) ??
      toFiniteNumber(obj.accountId) ??
      toFiniteNumber(obj.account_id) ??
      toFiniteNumber(obj.userNo) ??
      toFiniteNumber(obj.user_no) ??
      toFiniteNumber(obj.no);
    if (parsed !== null) return parsed;
  }

  return null;
}

export function getTokenExpiryMs(token?: string | null): number | null {
  const target = token ?? getToken();
  if (!target) return null;

  const payload = getTokenPayload(target);
  if (!payload) return null;
  const exp = payload.exp;
  if (typeof exp !== "number") return null;
  return exp * 1000;
}

export function isTokenExpired(token?: string | null, leewaySeconds = 30): boolean {
  const expiryMs = getTokenExpiryMs(token);
  if (!expiryMs) return false;
  return Date.now() >= expiryMs - leewaySeconds * 1000;
}

export function clearAuthStorage() {
  clearToken();
  clearRefreshToken();
  clearUserId();
}

export default {
  getToken,
  setToken,
  clearToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  getUserId,
  setUserId,
  clearUserId,
  getTokenExpiryMs,
  isTokenExpired,
  getUserIdFromToken,
  clearAuthStorage,
};
