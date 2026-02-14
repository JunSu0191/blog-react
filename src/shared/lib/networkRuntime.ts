const DEFAULT_LOCAL_API_PORT = 8080;
const DEFAULT_API_PATH = "/api";

function isBrowser() {
  return typeof window !== "undefined";
}

export function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function normalizePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return DEFAULT_API_PATH;
  return ensureLeadingSlash(trimTrailingSlash(trimmed));
}

function normalizeProtocol(protocol?: string) {
  if (protocol === "http:" || protocol === "https:") return protocol;
  if (protocol === "ws:") return "http:";
  if (protocol === "wss:") return "https:";
  return "http:";
}

function toWsProtocol(httpProtocol: string) {
  return httpProtocol === "https:" ? "wss:" : "ws:";
}

function buildDefaultAbsoluteApiBaseUrl(
  path: string = DEFAULT_API_PATH,
  localPort: number = DEFAULT_LOCAL_API_PORT,
) {
  const normalizedPath = normalizePath(path);
  if (!isBrowser()) {
    return `http://localhost:${localPort}${normalizedPath}`;
  }

  const { protocol, hostname, origin } = window.location;
  if (isLoopbackHost(hostname)) {
    return `${protocol}//${hostname}:${localPort}${normalizedPath}`;
  }

  return `${origin}${normalizedPath}`;
}

function rewriteLoopbackHostIfNeeded(url: URL) {
  if (!isBrowser()) return url;
  const currentHost = window.location.hostname;
  if (isLoopbackHost(url.hostname) && !isLoopbackHost(currentHost)) {
    url.hostname = currentHost;
  }
  return url;
}

function resolveApiBaseUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return rewriteLoopbackHostIfNeeded(new URL(trimmed));
    } catch {
      return null;
    }
  }

  if (!isBrowser()) return null;

  try {
    return new URL(trimmed, window.location.origin);
  } catch {
    return null;
  }
}

export function normalizeApiBaseUrl(raw?: string) {
  const fallback = buildDefaultAbsoluteApiBaseUrl();
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;

  const resolved = resolveApiBaseUrl(trimmed);
  if (!resolved) return fallback;
  return trimTrailingSlash(resolved.toString());
}

type WebSocketCandidateOptions = {
  explicit?: string;
  apiBaseUrl: string;
};

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function parseExplicitWsEntries(explicit?: string) {
  if (!explicit) return [];
  return explicit
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveWsEntryToAbsolute(entry: string) {
  const lower = entry.toLowerCase();
  if (lower.startsWith("ws://") || lower.startsWith("wss://")) {
    return entry;
  }

  if (/^https?:\/\//i.test(entry)) {
    try {
      const parsed = new URL(entry);
      parsed.protocol = toWsProtocol(parsed.protocol);
      return parsed.toString();
    } catch {
      return null;
    }
  }

  if (!isBrowser()) return null;
  try {
    const resolved = new URL(entry, window.location.origin);
    resolved.protocol = toWsProtocol(window.location.protocol);
    return resolved.toString();
  } catch {
    return null;
  }
}

function baseOriginsForWs(apiBaseUrl: string) {
  const origins: string[] = [];

  try {
    origins.push(new URL(apiBaseUrl).origin);
  } catch {
    // noop
  }

  if (isBrowser()) {
    origins.push(window.location.origin);
  }

  return uniqueValues(origins);
}

function buildDefaultWsCandidates(apiBaseUrl: string) {
  const paths = [
    "/ws",
    "/ws-sockjs/websocket",
    "/ws/websocket",
    "/stomp",
    "/stomp/websocket",
    "/ws-stomp",
    "/ws-stomp/websocket",
  ];

  const candidates: string[] = [];
  const origins = baseOriginsForWs(apiBaseUrl);
  origins.forEach((origin) => {
    try {
      const parsed = new URL(origin);
      const wsProtocol = toWsProtocol(normalizeProtocol(parsed.protocol));
      paths.forEach((path) => {
        candidates.push(`${wsProtocol}//${parsed.host}${path}`);
      });
    } catch {
      // noop
    }
  });

  return candidates;
}

function dropInsecureCandidatesOnHttpsPage(candidates: string[]) {
  if (!isBrowser()) return candidates;
  if (window.location.protocol !== "https:") return candidates;
  return candidates.filter((candidate) => !candidate.startsWith("ws://"));
}

export function buildWebSocketCandidates(options: WebSocketCandidateOptions) {
  const explicitEntries = parseExplicitWsEntries(options.explicit)
    .map((entry) => resolveWsEntryToAbsolute(entry))
    .filter((value): value is string => Boolean(value));

  if (explicitEntries.length > 0) {
    const safeExplicit = uniqueValues(dropInsecureCandidatesOnHttpsPage(explicitEntries));
    if (safeExplicit.length > 0) {
      return safeExplicit;
    }
  }

  const defaults = buildDefaultWsCandidates(options.apiBaseUrl);
  return uniqueValues(dropInsecureCandidatesOnHttpsPage(defaults));
}

export function toApiAbsoluteUrl(rawUrl: string, apiBaseUrl: string) {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  const normalized = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  try {
    const origin = new URL(apiBaseUrl).origin;
    return `${origin}${normalized}`;
  } catch {
    if (isBrowser()) return `${window.location.origin}${normalized}`;
    return normalized;
  }
}
