import type { PostTocItem } from "../types/api";

const SCRIPT_LIKE_TAG_PATTERN =
  /<(script|style|iframe|object|embed|meta|link)[^>]*>[\s\S]*?<\/\1>/gi;
const SELF_CLOSING_DANGEROUS_PATTERN = /<(script|style|iframe|object|embed|meta|link)[^>]*\/?\s*>/gi;
const INLINE_EVENT_PATTERN = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi;
const JS_PROTOCOL_PATTERN = /\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi;

type DomPurifyLike = {
  sanitize: (html: string) => string;
};

declare global {
  interface Window {
    DOMPurify?: DomPurifyLike;
  }
}

export function stripHtml(rawHtml: string) {
  return rawHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function estimateReadTimeMinutes(rawHtml: string) {
  const plain = stripHtml(rawHtml);
  const charsPerMinute = 450;
  return Math.max(1, Math.ceil(plain.length / charsPerMinute));
}

export function sanitizeHtml(rawHtml: string) {
  const domPurify =
    typeof window !== "undefined" ? window.DOMPurify : undefined;

  if (domPurify?.sanitize) {
    return domPurify.sanitize(rawHtml);
  }

  return rawHtml
    .replace(SCRIPT_LIKE_TAG_PATTERN, "")
    .replace(SELF_CLOSING_DANGEROUS_PATTERN, "")
    .replace(INLINE_EVENT_PATTERN, "")
    .replace(JS_PROTOCOL_PATTERN, ' $1="#"');
}

function slugifyHeading(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^a-z0-9가-힣\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "section";
}

export function injectHeadingIds(rawHtml: string) {
  const usedIds = new Set<string>();

  return rawHtml.replace(
    /<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (fullMatch, levelText: string, attrs: string, innerHtml: string) => {
      const currentIdMatch = attrs.match(/\sid=("|')([^"']+)("|')/i);
      const plainText = stripHtml(innerHtml);
      const baseId = slugifyHeading(plainText);

      let resolvedId = currentIdMatch?.[2] || baseId;
      let suffix = 1;
      while (usedIds.has(resolvedId)) {
        suffix += 1;
        resolvedId = `${baseId}-${suffix}`;
      }
      usedIds.add(resolvedId);

      if (currentIdMatch) {
        return fullMatch;
      }

      const level = Number(levelText);
      return `<h${level}${attrs} id="${resolvedId}">${innerHtml}</h${level}>`;
    },
  );
}

export function extractTocFromHtml(rawHtml: string): PostTocItem[] {
  const toc: PostTocItem[] = [];

  const headingRegex = /<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(rawHtml)) !== null) {
    const level = Number(match[1]);
    if (level < 1 || level > 3) continue;

    const attrs = match[2] || "";
    const innerHtml = match[3] || "";
    const idMatch = attrs.match(/\sid=("|')([^"']+)("|')/i);
    const text = stripHtml(innerHtml);
    if (!text) continue;

    const id = idMatch?.[2] || slugifyHeading(text);

    toc.push({
      id,
      text,
      level: level as 1 | 2 | 3,
    });
  }

  return toc;
}

export function parseTagText(tagsText: string) {
  const normalized = tagsText.trim();
  if (!normalized) return [];

  const tokens =
    normalized
      .replace(/,/g, " ")
      .match(/#[^\s#]+|[^\s#]+/g)
      ?.map((token) => token.trim())
      .filter((token) => token.length > 0) ?? [];

  const uniqueTags: string[] = [];
  const seen = new Set<string>();

  tokens.forEach((token) => {
    const cleaned = token
      .replace(/^#+/, "")
      .replace(/[#,]+$/g, "")
      .trim();

    if (!cleaned) return;

    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    uniqueTags.push(cleaned);
  });

  return uniqueTags;
}

export function stringifyTags(tags: string[]) {
  return tags
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter((tag) => tag.length > 0)
    .map((tag) => `#${tag}`)
    .join(" ");
}

export function resolvePostPath(postId?: number) {
  if (typeof postId === "number" && Number.isFinite(postId) && postId > 0) {
    return `/posts/${postId}`;
  }
  return "/posts";
}
