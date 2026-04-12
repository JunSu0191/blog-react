import { stripHtml } from "./postContent";

type SharePreviewInput = {
  title?: string;
  subtitle?: string;
  excerpt?: string;
  contentHtml?: string;
  thumbnailUrl?: string;
  categoryName?: string;
  seriesTitle?: string;
  readTimeMinutes?: number;
  postPath?: string;
};

export type SharePreview = {
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
  categoryLabel: string;
  seriesLabel?: string;
  readTimeLabel: string;
};

const DEFAULT_SHARE_TITLE = "제목을 입력해 주세요.";
const DEFAULT_SHARE_DESCRIPTION =
  "요약 문구나 본문 첫 문단이 링크 공유 미리보기에 반영됩니다.";
const DEFAULT_CATEGORY_LABEL = "미분류";
const DEFAULT_READ_TIME_LABEL = "1분 읽기";
const DEFAULT_OG_IMAGE_PATH = "/default-post.png";

function normalizeText(value?: string) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function resolveWebBaseUrl() {
  const configured = normalizeText(import.meta.env.VITE_WEB_BASE_URL as string | undefined);
  if (configured) return trimTrailingSlash(configured);

  if (typeof window !== "undefined" && window.location.origin) {
    return trimTrailingSlash(window.location.origin);
  }

  return "";
}

export function toAbsoluteUrl(value?: string) {
  const raw = normalizeText(value);
  if (!raw) return "";

  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).toString();
    }

    const baseUrl = resolveWebBaseUrl();
    if (!baseUrl) return raw;
    return new URL(raw, `${baseUrl}/`).toString();
  } catch {
    return raw;
  }
}

function summarizeDescription(input: SharePreviewInput) {
  const candidates = [
    normalizeText(input.subtitle),
    normalizeText(input.excerpt),
    normalizeText(input.contentHtml) ? stripHtml(input.contentHtml ?? "") : "",
  ];
  const resolved = candidates.find((candidate) => candidate.length > 0);
  if (!resolved) return DEFAULT_SHARE_DESCRIPTION;

  return resolved.length > 160 ? `${resolved.slice(0, 160).trim()}...` : resolved;
}

export function createSharePreview(input: SharePreviewInput): SharePreview {
  const title = normalizeText(input.title) || DEFAULT_SHARE_TITLE;
  const description = summarizeDescription(input);
  const categoryLabel = normalizeText(input.categoryName) || DEFAULT_CATEGORY_LABEL;
  const seriesLabel = normalizeText(input.seriesTitle) || undefined;
  const readTimeLabel =
    typeof input.readTimeMinutes === "number" && Number.isFinite(input.readTimeMinutes) && input.readTimeMinutes > 0
      ? `${input.readTimeMinutes}분 읽기`
      : DEFAULT_READ_TIME_LABEL;
  const imageUrl =
    toAbsoluteUrl(input.thumbnailUrl) || toAbsoluteUrl(DEFAULT_OG_IMAGE_PATH);
  const canonicalUrl =
    toAbsoluteUrl(input.postPath) || resolveWebBaseUrl() || "/";

  return {
    title,
    description,
    imageUrl,
    canonicalUrl,
    categoryLabel,
    seriesLabel,
    readTimeLabel,
  };
}

function upsertMetaTag(selector: string, attributes: Record<string, string>, content: string) {
  if (typeof document === "undefined") return;

  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => {
      element?.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertLinkTag(selector: string, rel: string, href: string) {
  if (typeof document === "undefined") return;

  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

export function applyDocumentSharePreview(preview: SharePreview) {
  if (typeof document === "undefined") return;

  document.title = `${preview.title} | blog-pause`;
  upsertMetaTag('meta[name="description"]', { name: "description" }, preview.description);
  upsertMetaTag('meta[property="og:type"]', { property: "og:type" }, "article");
  upsertMetaTag('meta[property="og:site_name"]', { property: "og:site_name" }, "blog-pause");
  upsertMetaTag('meta[property="og:title"]', { property: "og:title" }, preview.title);
  upsertMetaTag(
    'meta[property="og:description"]',
    { property: "og:description" },
    preview.description,
  );
  upsertMetaTag('meta[property="og:url"]', { property: "og:url" }, preview.canonicalUrl);
  upsertMetaTag('meta[property="og:image"]', { property: "og:image" }, preview.imageUrl);
  upsertMetaTag(
    'meta[name="twitter:card"]',
    { name: "twitter:card" },
    preview.imageUrl ? "summary_large_image" : "summary",
  );
  upsertMetaTag('meta[name="twitter:title"]', { name: "twitter:title" }, preview.title);
  upsertMetaTag(
    'meta[name="twitter:description"]',
    { name: "twitter:description" },
    preview.description,
  );
  upsertMetaTag('meta[name="twitter:image"]', { name: "twitter:image" }, preview.imageUrl);
  upsertLinkTag('link[rel="canonical"]', "canonical", preview.canonicalUrl);
}
