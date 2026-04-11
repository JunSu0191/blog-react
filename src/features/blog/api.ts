import { API_BASE_URL, api } from "@/shared/lib/api";
import type {
  BlogFontScale,
  BlogProfileLayout,
  BlogProfileData,
  BlogProfilePost,
  BlogProfilePostTag,
  BlogProfilePostsPage,
  BlogProfileQuery,
  BlogThemePreset,
  BlogThemeSettings,
  BlogThemeSettingsRequest,
} from "./types";

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function ensureApiRoot(baseUrl: string) {
  const trimmed = trimTrailingSlashes(baseUrl.trim());
  if (/\/api$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
}

const API_ROOT = ensureApiRoot(API_BASE_URL);
const BLOGS_ENDPOINT = `${API_ROOT}/blogs`;
const MY_BLOG_SETTINGS_ENDPOINT = `${API_ROOT}/me/blog/settings`;

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function unwrapApiData(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    const record = toRecord(current);
    if (!record) return current;

    const data = record.data;
    if (data && typeof data === "object") {
      current = data;
      continue;
    }

    return current;
  }

  return current;
}

function toText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toMaybeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  return toMaybeNumber(value) ?? fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "y") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "n") {
      return false;
    }
  }
  return fallback;
}

function normalizeThemePreset(value: unknown): BlogThemePreset {
  const text = toText(value)?.toLowerCase();
  if (
    text === "minimal" ||
    text === "ocean" ||
    text === "sunset" ||
    text === "forest"
  ) {
    return text;
  }
  return "minimal";
}

function normalizeProfileLayout(value: unknown): BlogProfileLayout {
  const text = toText(value)?.toLowerCase();
  if (text === "default" || text === "compact" || text === "centered") {
    return text;
  }
  return "default";
}

function normalizeFontScale(value: unknown): BlogFontScale {
  const text = toText(value)?.toLowerCase();
  if (text === "sm" || text === "md" || text === "lg") {
    return text;
  }
  return "md";
}

function normalizeAccentColor(value: unknown) {
  const raw = toText(value) || "#2563eb";
  const normalized = raw.startsWith("#") ? raw : `#${raw}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return "#2563eb";
  return normalized;
}

function normalizeBlogThemeSettings(raw: unknown): BlogThemeSettings {
  const row = toRecord(unwrapApiData(raw)) || {};
  const settingsRow =
    toRecord(row.blogSettings) ??
    toRecord(row.settings) ??
    toRecord(row.theme) ??
    row;

  return {
    themePreset: normalizeThemePreset(settingsRow.themePreset),
    accentColor: normalizeAccentColor(settingsRow.accentColor),
    coverImageUrl:
      toText(settingsRow.coverImageUrl) || toText(settingsRow.coverUrl),
    profileLayout: normalizeProfileLayout(settingsRow.profileLayout),
    fontScale: normalizeFontScale(settingsRow.fontScale),
    showStats: toBoolean(settingsRow.showStats, true),
  };
}

function normalizePostTags(value: unknown): BlogProfilePostTag[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<BlogProfilePostTag[]>((accumulator, item) => {
    if (typeof item === "string") {
      const name = toText(item);
      if (!name) return accumulator;
      accumulator.push({ name });
      return accumulator;
    }

    const row = toRecord(item);
    if (!row) return accumulator;

    const name = toText(row.name) || toText(row.label);
    if (!name) return accumulator;

    accumulator.push({
      id: toMaybeNumber(row.id),
      name,
    });

    return accumulator;
  }, []);
}

function normalizePostSummary(raw: unknown): BlogProfilePost {
  const source = unwrapApiData(raw);
  const row = toRecord(source) || {};
  const categoryRow = toRecord(row.category);
  const seriesRow = toRecord(row.series);
  const categoryName =
    toText(categoryRow?.name) || toText(row.categoryName) || toText(row.category);
  const seriesTitle =
    toText(seriesRow?.title) || toText(row.seriesTitle) || toText(seriesRow?.name);

  return {
    id: toNumber(row.id),
    title: toText(row.title) || "제목 없음",
    subtitle: toText(row.subtitle),
    excerpt: toText(row.excerpt),
    thumbnailUrl: toText(row.thumbnailUrl) || toText(row.thumbnail),
    category: categoryName
      ? {
          id: toMaybeNumber(categoryRow?.id),
          name: categoryName,
        }
      : null,
    series: seriesTitle
      ? {
          id: toMaybeNumber(seriesRow?.id) ?? toMaybeNumber(row.seriesId),
          title: seriesTitle,
          order: toMaybeNumber(seriesRow?.order) ?? toMaybeNumber(row.seriesOrder),
          postCount:
            toMaybeNumber(seriesRow?.postCount) ?? toMaybeNumber(seriesRow?.count),
        }
      : null,
    tags: normalizePostTags(row.tags),
    viewCount: toNumber(row.viewCount),
    likeCount: toNumber(row.likeCount),
    readTimeMinutes: toNumber(row.readTimeMinutes, 1),
    publishedAt: toText(row.publishedAt),
    createdAt: toText(row.createdAt),
  };
}

function normalizePostsPage(
  raw: unknown,
  page: number,
  size: number,
): BlogProfilePostsPage {
  if (Array.isArray(raw)) {
    const content = raw.map((item) => normalizePostSummary(item));
    return {
      content,
      pageNumber: page,
      pageSize: size,
      totalElements: content.length,
      totalPages: Math.max(1, Math.ceil(content.length / Math.max(1, size))),
      first: page <= 0,
      last: true,
      empty: content.length === 0,
      numberOfElements: content.length,
    };
  }

  const row = toRecord(raw) || {};
  const contentRaw = Array.isArray(row.content)
    ? row.content
    : Array.isArray(row.items)
      ? row.items
      : [];
  const content = contentRaw.map((item) => normalizePostSummary(item));

  const totalElements = toNumber(row.totalElements, content.length);
  const totalPages = toNumber(
    row.totalPages,
    Math.max(1, Math.ceil(totalElements / Math.max(1, size))),
  );
  const pageNumber = toNumber(row.pageNumber, page);
  const pageSize = toNumber(row.pageSize, size);

  return {
    content,
    pageNumber,
    pageSize,
    totalElements,
    totalPages,
    first: Boolean(row.first ?? pageNumber <= 0),
    last: Boolean(row.last ?? pageNumber + 1 >= totalPages),
    empty: Boolean(row.empty ?? content.length === 0),
    numberOfElements: toNumber(row.numberOfElements, content.length),
  };
}

function toQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    query.set(key, normalized);
  });

  const text = query.toString();
  return text.length > 0 ? `?${text}` : "";
}

function normalizeBlogProfile(
  raw: unknown,
  fallbackUsername: string,
  fallbackPage: number,
  fallbackSize: number,
): BlogProfileData {
  const source = unwrapApiData(raw);
  const row = toRecord(source) || {};
  const userRow = toRecord(row.user) || {};
  const profileRow = toRecord(row.profile) || {};
  const statsRow = toRecord(row.stats) || {};
  const settingsRow =
    toRecord(row.blogSettings) ??
    toRecord(row.settings) ??
    toRecord(row.theme) ??
    null;

  return {
    blogPath: toText(row.blogPath),
    blogUrl: toText(row.blogUrl),
    user: {
      userId: toNumber(userRow.userId ?? userRow.id),
      username: toText(userRow.username) || fallbackUsername,
      name: toText(userRow.name),
      nickname: toText(userRow.nickname),
      joinedAt: toText(userRow.joinedAt),
    },
    profile: {
      displayName: toText(profileRow.displayName),
      bio: toText(profileRow.bio),
      avatarUrl: toText(profileRow.avatarUrl),
      websiteUrl: toText(profileRow.websiteUrl),
      location: toText(profileRow.location),
    },
    blogSettings: normalizeBlogThemeSettings(settingsRow ?? {}),
    stats: {
      publishedPostCount: toNumber(statsRow.publishedPostCount),
    },
    posts: normalizePostsPage(row.posts, fallbackPage, fallbackSize),
  };
}

export async function fetchBlogProfile(
  username: string,
  params: BlogProfileQuery = {},
): Promise<BlogProfileData> {
  const page = params.page ?? 0;
  const size = params.size ?? 10;
  const query = toQueryString({
    q: params.q,
    sort: params.sort,
    page,
    size,
  });

  const response = await api<unknown>(
    `${BLOGS_ENDPOINT}/${encodeURIComponent(username)}${query}`,
    {
      suppressForbiddenRedirect: true,
    },
  );

  return normalizeBlogProfile(response, username, page, size);
}

function toBlogSettingsWritePayload(
  request: BlogThemeSettingsRequest,
): Record<string, unknown> {
  return {
    themePreset: request.themePreset,
    accentColor: normalizeAccentColor(request.accentColor),
    coverImageUrl: toText(request.coverImageUrl) || null,
    profileLayout: request.profileLayout,
    fontScale: request.fontScale,
    showStats: Boolean(request.showStats),
  };
}

export async function fetchMyBlogSettings(): Promise<BlogThemeSettings> {
  const response = await api<unknown>(MY_BLOG_SETTINGS_ENDPOINT);
  return normalizeBlogThemeSettings(response);
}

export async function updateMyBlogSettings(
  request: BlogThemeSettingsRequest,
): Promise<BlogThemeSettings> {
  const response = await api<unknown>(MY_BLOG_SETTINGS_ENDPOINT, {
    method: "PUT",
    data: toBlogSettingsWritePayload(request),
  });

  return normalizeBlogThemeSettings(response);
}
