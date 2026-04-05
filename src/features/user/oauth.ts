import { API_BASE_URL } from "@/shared/lib/api";

const POST_LOGIN_REDIRECT_KEY = "auth.post_login_redirect";
const DEFAULT_REDIRECT_PATH = "/posts";
const BLOCKED_REDIRECT_PATHS = new Set([
  "/login",
  "/register",
  "/register/social",
  "/auth/callback",
  "/onboarding/nickname",
]);

export type OAuthProvider = "google" | "kakao" | "naver";

export type OAuthCallbackResult = {
  token?: string;
  signupToken?: string;
  needsProfileSetup?: boolean;
  errorCode?: string;
  errorMessage?: string;
};

function resolveOAuthOrigin() {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    if (typeof window !== "undefined") return window.location.origin;
    return "http://localhost:8080";
  }
}

const OAUTH_ORIGIN = resolveOAuthOrigin();

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSafeRedirectPath(value: unknown) {
  const normalized = toNonEmptyString(value);
  if (!normalized) return null;
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return null;

  const [pathname] = normalized.split(/[?#]/, 1);
  if (!pathname || BLOCKED_REDIRECT_PATHS.has(pathname)) return null;
  return normalized;
}

function decodeMaybeEncodedText(value: string) {
  let decoded = value;
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function getOAuthAuthorizationUrl(provider: OAuthProvider) {
  return `${OAUTH_ORIGIN}/oauth2/authorization/${provider}`;
}

export function resolveRedirectPathFromState(state: unknown) {
  const direct = toSafeRedirectPath(state);
  if (direct) return direct;

  if (!state || typeof state !== "object") {
    return DEFAULT_REDIRECT_PATH;
  }

  const from = (state as { from?: unknown }).from;
  const fromDirect = toSafeRedirectPath(from);
  if (fromDirect) return fromDirect;

  if (!from || typeof from !== "object") {
    return DEFAULT_REDIRECT_PATH;
  }

  const pathname = toNonEmptyString((from as { pathname?: unknown }).pathname);
  if (!pathname) return DEFAULT_REDIRECT_PATH;
  const search = toNonEmptyString((from as { search?: unknown }).search) || "";
  const hash = toNonEmptyString((from as { hash?: unknown }).hash) || "";
  return toSafeRedirectPath(`${pathname}${search}${hash}`) || DEFAULT_REDIRECT_PATH;
}

export function persistPostLoginRedirectPath(path: string) {
  if (typeof window === "undefined") return;
  try {
    const safePath = toSafeRedirectPath(path);
    if (!safePath) {
      window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      return;
    }
    window.sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, safePath);
  } catch {
    // noop
  }
}

export function consumePostLoginRedirectPath() {
  if (typeof window === "undefined") return DEFAULT_REDIRECT_PATH;
  try {
    const raw = window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return toSafeRedirectPath(raw) || DEFAULT_REDIRECT_PATH;
  } catch {
    return DEFAULT_REDIRECT_PATH;
  }
}

export function clearPostLoginRedirectPath() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    // noop
  }
}

export function parseOAuthCallbackResult(
  search: string,
  hash: string,
): OAuthCallbackResult {
  const hashParams = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash,
  );
  const queryParams = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );

  const tokenFromHash = toNonEmptyString(hashParams.get("token"));
  const tokenFromQuery = toNonEmptyString(queryParams.get("token"));
  const token = tokenFromHash || tokenFromQuery;
  const signupToken = toNonEmptyString(queryParams.get("signupToken")) || undefined;
  const needsProfileSetup =
    queryParams.get("needsProfileSetup")?.trim().toLowerCase() === "true";

  const errorCode = toNonEmptyString(queryParams.get("error")) || undefined;
  const rawMessage = toNonEmptyString(queryParams.get("message"));
  const errorMessage = rawMessage
    ? decodeMaybeEncodedText(rawMessage)
    : undefined;

  return {
    token: token?.replace(/^Bearer\s+/i, ""),
    signupToken,
    needsProfileSetup,
    errorCode,
    errorMessage,
  };
}
