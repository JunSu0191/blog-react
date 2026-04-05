import { api, apiWithMeta, API_BASE_URL } from "@/shared/lib/api";
import type {
  AdjacentPost,
  DraftDetail,
  DraftSummary,
  DraftWriteRequest,
  JsonValue,
  PagedResponse,
  PostDetail,
  PostDraftRequest,
  PostCategoryOption,
  PostListItem,
  PostListQuery,
  PostPublishRequest,
  PostSummary,
  PostTag,
  PostUpdateRequest,
  PostWriteRequest,
  UploadImageResponse,
} from "./types/api";
import { uploadImageWithTus, type TusUploadOptions } from "./tusUpload";
import {
  estimateReadTimeMinutes,
  extractTocFromHtml,
  injectHeadingIds,
  stripHtml,
} from "./utils/postContent";

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function ensureApiRoot(baseUrl: string) {
  const trimmed = trimTrailingSlashes(baseUrl.trim());
  if (/\/api$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
}

const API_ROOT = ensureApiRoot(API_BASE_URL);
const POSTS_ENDPOINT = `${API_ROOT}/posts`;
const DRAFTS_ENDPOINT = `${API_ROOT}/posts/drafts`;
const MYPAGE_POSTS_ENDPOINT = `${API_ROOT}/mypage/posts`;
const RELATED_ENDPOINT_SUFFIX = "related";
const CATEGORIES_ENDPOINTS = [`${API_ROOT}/categories`] as const;

export type PostLikeStatus = {
  liked: boolean;
  likeCount?: number;
};

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

function pickFirstText(
  record: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!record) return undefined;

  for (const key of keys) {
    const text = toText(record[key]);
    if (text) return text;
  }
  return undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toMaybeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toSlugText(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return normalized
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createFallbackSlug(title: string) {
  const base = toSlugText(title);
  if (base.length > 0) return base;

  const timestamp = Date.now().toString(36);
  return `post-${timestamp}`;
}

function toPositiveNumber(value: unknown): number | undefined {
  const parsed = toMaybeNumber(value);
  if (typeof parsed !== "number" || parsed <= 0) return undefined;
  return parsed;
}

function extractPostIdFromLocation(locationHeader?: string): number | undefined {
  const location = toText(locationHeader);
  if (!location) return undefined;

  const matched = location.match(/\/posts\/(\d+)(?:[/?#]|$)/i);
  if (!matched) return undefined;

  return toPositiveNumber(matched[1]);
}

function getErrorStatus(error: unknown): number | undefined {
  const record = toRecord(error);
  if (!record) return undefined;
  return toMaybeNumber(record.status);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return toText(record.name) || toText(record.label) || undefined;
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item));
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => toMaybeNumber(item))
    .filter((item): item is number => typeof item === "number");
}

function extractImageUrlsFromHtml(rawHtml: string): string[] {
  if (!rawHtml) return [];

  const imageUrls: string[] = [];
  const seen = new Set<string>();
  const pattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let matched: RegExpExecArray | null;

  while ((matched = pattern.exec(rawHtml)) !== null) {
    const source = toText(matched[1]);
    if (!source) continue;
    if (seen.has(source)) continue;
    seen.add(source);
    imageUrls.push(source);
  }

  return imageUrls;
}

function normalizeImageUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const urls: string[] = [];
  const seen = new Set<string>();

  value.forEach((item) => {
    let candidate: string | undefined;

    if (typeof item === "string") {
      candidate = toText(item);
    } else {
      const record = toRecord(item);
      candidate =
        pickFirstText(record ?? undefined, [
          "url",
          "src",
          "imageUrl",
          "thumbnailUrl",
          "fileUrl",
        ]) ?? undefined;
    }

    if (!candidate || seen.has(candidate)) return;
    seen.add(candidate);
    urls.push(candidate);
  });

  return urls;
}

function appendUniqueImageUrl(target: string[], value: string | undefined) {
  const cleaned = toText(value);
  if (!cleaned) return;
  if (target.includes(cleaned)) return;
  target.push(cleaned);
}

function normalizeTagTexts(value: unknown): string[] {
  const uniqueTags: string[] = [];
  const seen = new Set<string>();

  toStringArray(value).forEach((tag) => {
    const cleaned = tag.replace(/^#+/, "").trim();
    if (!cleaned) return;

    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    uniqueTags.push(cleaned);
  });

  return uniqueTags;
}

function toTagIdArrayFromLegacyTags(tags: unknown): number[] {
  if (!Array.isArray(tags)) return [];

  return tags
    .map((item) => {
      if (typeof item === "number") return Number.isFinite(item) ? item : undefined;
      if (typeof item === "string") {
        const parsed = Number(item.trim());
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return toMaybeNumber(record.id) ?? toMaybeNumber(record.tagId);
      }
      return undefined;
    })
    .filter((item): item is number => typeof item === "number");
}

function toPostWritePayload(request: PostPublishRequest): PostWriteRequest {
  const source = request as unknown as Record<string, unknown>;
  const categoryId =
    toMaybeNumber(source.categoryId) ?? toMaybeNumber(request.category);
  const fromSpec = toNumberArray(source.tagIds);
  const fromLegacy = toTagIdArrayFromLegacyTags(request.tags);
  const tagIds = [...new Set([...fromSpec, ...fromLegacy])];
  const tags = normalizeTagTexts(request.tags);
  const slug = toText(source.slug) || createFallbackSlug(request.title);

  return {
    title: request.title,
    slug,
    subtitle: request.subtitle,
    categoryId,
    category: request.category,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    tags: tags.length > 0 ? tags : undefined,
    thumbnailUrl: request.thumbnailUrl,
    contentJson: (request.contentJson ?? {}) as JsonValue,
    contentHtml: request.contentHtml,
    publishNow: request.publishNow,
    draftId: toMaybeNumber(source.draftId) ?? request.draftId,
  };
}

function toDraftWritePayload(request: PostDraftRequest): DraftWriteRequest {
  const source = request as unknown as Record<string, unknown>;
  const categoryId =
    toMaybeNumber(source.categoryId) ?? toMaybeNumber(request.category);
  const fromSpec = toNumberArray(source.tagIds);
  const fromLegacy = toTagIdArrayFromLegacyTags(request.tags);
  const tagIds = [...new Set([...fromSpec, ...fromLegacy])];
  const tags = normalizeTagTexts(request.tags);

  return {
    title: request.title,
    subtitle: request.subtitle,
    categoryId,
    category: request.category,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    tags: tags.length > 0 ? tags : undefined,
    thumbnailUrl: request.thumbnailUrl,
    contentJson: (request.contentJson ?? {}) as JsonValue,
    contentHtml: request.contentHtml,
  };
}

function normalizePostLikeStatus(raw: unknown): PostLikeStatus {
  if (typeof raw === "boolean") return { liked: raw };

  const record = toRecord(raw) || {};
  const liked =
    Boolean(record.liked) ||
    Boolean(record.isLiked) ||
    Boolean(record.myLike) ||
    record.status === "LIKED";

  return {
    liked,
    likeCount: toMaybeNumber(record.likeCount),
  };
}

function normalizeTags(value: unknown): PostTag[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        const name = item.trim();
        if (!name) return null;
        return { name };
      }

      const record = toRecord(item);
      if (!record) return null;

      const nestedTag =
        toRecord(record.tag) ??
        toRecord(record.tagInfo) ??
        toRecord(record.tagDto) ??
        toRecord(record.tagResponse) ??
        toRecord(record.hashtag);
      const source = nestedTag ?? record;
      const name =
        toText(source.name) ||
        toText(source.label) ||
        toText(source.tagName) ||
        toText(source.value);
      if (!name) return null;

      return {
        id: toMaybeNumber(source.id) ?? toMaybeNumber(record.id),
        name,
        slug: toText(source.slug) || toText(source.tagSlug) || toText(record.slug),
      };
    })
    .filter((item): item is PostTag => Boolean(item));
}

function pickRawTags(record: Record<string, unknown> | undefined): unknown {
  if (!record) return undefined;

  const tagCandidates = [
    record.tags,
    record.tagList,
    record.tagNames,
    record.postTags,
    record.tagDtos,
    record.tagResponses,
    record.hashtags,
    record.hashTags,
  ];

  for (const candidate of tagCandidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  return tagCandidates.find((candidate) => Array.isArray(candidate));
}

function normalizeCategoryOptions(value: unknown): PostCategoryOption[] {
  const record = toRecord(value);
  const list = Array.isArray(record?.content)
    ? record.content
    : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(value)
        ? value
        : [];

  return list.reduce<PostCategoryOption[]>((accumulator, item) => {
    const row = toRecord(item);
    if (!row) return accumulator;

    const id = toMaybeNumber(row.id);
    const name = toText(row.name) || toText(row.label);
    if (typeof id !== "number" || !name) {
      return accumulator;
    }

    accumulator.push({
      id,
      name,
    });

    return accumulator;
  }, []);
}

function normalizeAdjacentPost(value: unknown): AdjacentPost | null {
  const record = toRecord(value);
  if (!record) return null;

  const id =
    toPositiveNumber(record.id) ??
    toPositiveNumber(record.postId) ??
    toPositiveNumber(record.slug);
  const title = toText(record.title);

  if (typeof id !== "number" || !title) return null;

  return {
    id,
    title,
  };
}

function normalizeSummary(raw: unknown): PostSummary {
  const source = unwrapApiData(raw);
  const record = toRecord(source) || {};
  const contentField = record.content;
  const contentAsHtml =
    typeof contentField === "string" ? contentField : undefined;
  const id = toPositiveNumber(record.id) ?? toPositiveNumber(record.postId) ?? 0;
  const contentHtml =
    pickFirstText(record, [
      "contentHtml",
      "html",
      "body",
      "description",
    ]) ||
    contentAsHtml ||
    "";

  const readTimeMinutes =
    toMaybeNumber(record.readTimeMinutes) || estimateReadTimeMinutes(contentHtml);

  const rawCategory = toRecord(record.category);
  const categoryName =
    toText(rawCategory?.name) ||
    toText(record.categoryName) ||
    toText(record.category);
  const contentRecord = toRecord(record.content) ?? undefined;
  const tags = normalizeTags(
    pickRawTags(record) ??
      pickRawTags(contentRecord) ??
      pickRawTags(toRecord(record.post) ?? undefined) ??
      pickRawTags(toRecord(record.payload) ?? undefined),
  );

  const authorRecord = toRecord(record.author);
  const authorId =
    toMaybeNumber(authorRecord?.id) ??
    toMaybeNumber(record.authorId) ??
    toMaybeNumber(record.userId);
  const thumbnailUrl =
    toText(record.thumbnailUrl) ??
    toText(record.thumbnail) ??
    undefined;

  const imageUrls: string[] = [];
  appendUniqueImageUrl(imageUrls, thumbnailUrl);
  normalizeImageUrlList(record.imageUrls).forEach((url) =>
    appendUniqueImageUrl(imageUrls, url),
  );
  normalizeImageUrlList(record.images).forEach((url) =>
    appendUniqueImageUrl(imageUrls, url),
  );
  normalizeImageUrlList(record.photos).forEach((url) =>
    appendUniqueImageUrl(imageUrls, url),
  );
  normalizeImageUrlList(record.attachments).forEach((url) =>
    appendUniqueImageUrl(imageUrls, url),
  );
  normalizeImageUrlList(record.media).forEach((url) =>
    appendUniqueImageUrl(imageUrls, url),
  );
  extractImageUrlsFromHtml(contentHtml).forEach((url) =>
    appendUniqueImageUrl(imageUrls, url),
  );

  return {
    id,
    title: toText(record.title) || "제목 없음",
    subtitle: toText(record.subtitle),
    excerpt: toText(record.excerpt) || stripHtml(contentHtml).slice(0, 160),
    thumbnailUrl,
    imageUrls: imageUrls.slice(0, 10),
    category: categoryName
      ? {
          id: toMaybeNumber(rawCategory?.id),
          name: categoryName,
        }
      : null,
    tags,
    author:
      typeof authorId === "number"
        ? {
            id: authorId,
            username:
              toText(authorRecord?.username) || toText(record.authorUsername),
            name: toText(authorRecord?.name) || toText(record.authorName),
            nickname:
              toText(authorRecord?.nickname) || toText(record.authorNickname),
            profileImageUrl: toText(authorRecord?.profileImageUrl),
          }
        : null,
    readTimeMinutes,
    viewCount: toNumber(record.viewCount),
    likeCount: toNumber(record.likeCount),
    publishedAt: toText(record.publishedAt),
    createdAt: toText(record.createdAt),
    updatedAt: toText(record.updatedAt),
    status: toText(record.status) as PostSummary["status"],
  };
}

function normalizeDetail(raw: unknown): PostDetail {
  const source = unwrapApiData(raw);
  const sourceRecord = toRecord(source) || {};
  const nestedRecord =
    toRecord(sourceRecord.post) ??
    toRecord(sourceRecord.item) ??
    toRecord(sourceRecord.payload) ??
    toRecord(sourceRecord.result);
  const record = nestedRecord ?? sourceRecord;
  const summary = normalizeSummary(record);
  const contentField = record.content;
  const contentRecord =
    contentField && typeof contentField === "object"
      ? (contentField as Record<string, unknown>)
      : undefined;
  const detailTags = normalizeTags(
    pickRawTags(record) ??
      pickRawTags(contentRecord) ??
      pickRawTags(sourceRecord) ??
      pickRawTags(nestedRecord ?? undefined),
  );
  const contentAsHtml =
    typeof contentField === "string"
      ? toText(contentField)
      : pickFirstText(contentRecord, [
          "contentHtml",
          "html",
          "content",
          "body",
          "value",
          "text",
        ]);
  const contentAsJson = contentRecord as JsonValue | undefined;

  const rawHtml =
    pickFirstText(record, [
      "contentHtml",
      "html",
      "body",
      "description",
      "value",
      "text",
    ]) ||
    contentAsHtml ||
    "";
  const contentHtml = injectHeadingIds(rawHtml);
  const rawToc = Array.isArray(record.toc)
    ? record.toc
    : extractTocFromHtml(contentHtml);
  const contentJson =
    (record.contentJson as JsonValue | undefined) ??
    (contentRecord?.contentJson as JsonValue | undefined) ??
    (contentRecord?.json as JsonValue | undefined) ??
    (contentRecord?.doc as JsonValue | undefined) ??
    (contentRecord?.data as JsonValue | undefined) ??
    (record.json as JsonValue | undefined) ??
    (record.doc as JsonValue | undefined) ??
    (record.data as JsonValue | undefined) ??
    contentAsJson ??
    ({} as JsonValue);

  return {
    ...summary,
    tags: detailTags.length > 0 ? detailTags : summary.tags,
    contentHtml,
    contentJson,
    toc: Array.isArray(rawToc)
      ? rawToc
          .map((item) => {
            const heading = toRecord(item);
            if (!heading) return null;
            const id = toText(heading.id);
            const text = toText(heading.text);
            const level = toNumber(heading.level, 2);
            if (!id || !text || level < 1 || level > 3) return null;
            return {
              id,
              text,
              level: level as 1 | 2 | 3,
            };
          })
          .filter((item): item is PostDetail["toc"][number] => Boolean(item))
      : [],
    previousPost:
      normalizeAdjacentPost(record.previousPost) ||
      normalizeAdjacentPost(record.previous),
    nextPost:
      normalizeAdjacentPost(record.nextPost) || normalizeAdjacentPost(record.next),
  };
}

function normalizePagedResponse(
  raw: unknown,
  page: number,
  size: number,
): PagedResponse<PostSummary> {
  if (Array.isArray(raw)) {
    const content = raw.map((item) => normalizeSummary(item));
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

  const record = toRecord(raw);
  if (!record) {
    return {
      content: [],
      pageNumber: page,
      pageSize: size,
      totalElements: 0,
      totalPages: 1,
      first: true,
      last: true,
      empty: true,
      numberOfElements: 0,
    };
  }

  const contentRaw = Array.isArray(record.content)
    ? record.content
    : Array.isArray(record.items)
      ? record.items
      : [];

  const content = contentRaw.map((item) => normalizeSummary(item));
  const totalElements = toNumber(record.totalElements, content.length);
  const totalPages = toNumber(
    record.totalPages,
    Math.max(1, Math.ceil(totalElements / Math.max(1, size))),
  );
  const pageNumber = toNumber(record.pageNumber, page);
  const pageSize = toNumber(record.pageSize, size);

  return {
    content,
    pageNumber,
    pageSize,
    totalElements,
    totalPages,
    first: Boolean(record.first ?? pageNumber <= 0),
    last: Boolean(record.last ?? pageNumber + 1 >= totalPages),
    empty: Boolean(record.empty ?? content.length === 0),
    numberOfElements: toNumber(record.numberOfElements, content.length),
  };
}

function normalizeDraftDetail(raw: unknown, fallbackId?: number): DraftDetail {
  const record = toRecord(raw);
  if (!record) {
    throw new Error("draft 응답 형식이 올바르지 않습니다.");
  }

  const tagTexts = toStringArray(record.tags);
  const tagIds = toNumberArray(record.tagIds);

  return {
    id: toNumber(record.id, fallbackId ?? 0),
    title: toText(record.title) || "",
    subtitle: toText(record.subtitle),
    category:
      toText(record.category) ??
      (typeof toMaybeNumber(record.categoryId) === "number"
        ? String(toMaybeNumber(record.categoryId))
        : undefined),
    tags: tagTexts.length > 0 ? tagTexts : tagIds.map((id) => String(id)),
    thumbnailUrl: toText(record.thumbnailUrl),
    contentHtml: toText(record.contentHtml) || "",
    contentJson: (record.contentJson ?? {}) as JsonValue,
    autosavedAt: toText(record.autosavedAt),
    updatedAt: toText(record.updatedAt) || new Date().toISOString(),
  };
}

function toQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    const stringified = String(value).trim();
    if (!stringified) return;
    query.set(key, stringified);
  });

  const text = query.toString();
  return text.length > 0 ? `?${text}` : "";
}

export async function uploadPostImage(
  file: File,
  options: TusUploadOptions = {},
): Promise<UploadImageResponse> {
  const url = await uploadImageWithTus(file, options);

  return {
    url,
  };
}

export async function fetchPostCategories(): Promise<PostCategoryOption[]> {
  for (const endpoint of CATEGORIES_ENDPOINTS) {
    try {
      const response = await api<unknown>(endpoint, {
        suppressForbiddenRedirect: true,
      });
      return normalizeCategoryOptions(response);
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 404) continue;
      throw error;
    }
  }

  return [];
}

export async function fetchPosts(
  params: PostListQuery = {},
): Promise<PagedResponse<PostSummary>> {
  const page = params.page ?? 0;
  const size = params.size ?? 9;
  const legacyCategoryId = toMaybeNumber(params.category);
  const categoryId =
    typeof params.categoryId === "number" ? params.categoryId : legacyCategoryId;

  const query = toQueryString({
    q: params.q,
    categoryId,
    tag: params.tag,
    sort: params.sort,
    page,
    size,
  });

  const response = await api<unknown>(`${POSTS_ENDPOINT}${query}`);
  return normalizePagedResponse(response, page, size);
}

export async function fetchPostById(postId: number): Promise<PostDetail> {
  const response = await api<unknown>(`${POSTS_ENDPOINT}/${postId}`);
  return normalizeDetail(response);
}

export async function fetchRelatedPosts(
  postId: number,
  limit = 5,
): Promise<PostSummary[]> {
  const response = await api<unknown>(
    `${POSTS_ENDPOINT}/${postId}/${RELATED_ENDPOINT_SUFFIX}${toQueryString({ limit })}`,
  );

  const record = toRecord(response);
  if (record && Array.isArray(record.content)) {
    return record.content.map((item) => normalizeSummary(item));
  }

  if (Array.isArray(response)) {
    return response.map((item) => normalizeSummary(item));
  }

  return [];
}

async function resolveCreatedPostDetail(
  responseData: unknown,
  locationHeader?: string,
): Promise<PostDetail> {
  const postIdFromLocation = extractPostIdFromLocation(locationHeader);
  const normalizedFromBody =
    responseData !== undefined && responseData !== null
      ? normalizeDetail(responseData)
      : null;

  if (normalizedFromBody && normalizedFromBody.id > 0) {
    return normalizedFromBody;
  }

  if (typeof postIdFromLocation === "number") {
    try {
      return await fetchPostById(postIdFromLocation);
    } catch (error) {
      if (normalizedFromBody) {
        return { ...normalizedFromBody, id: postIdFromLocation };
      }
      throw error;
    }
  }

  if (normalizedFromBody) {
    return normalizedFromBody;
  }

  throw new Error("게시글 생성 응답에서 postId를 확인할 수 없습니다.");
}

export async function createPostEntry(
  request: PostPublishRequest,
): Promise<PostDetail> {
  const response = await apiWithMeta<unknown>(POSTS_ENDPOINT, {
    method: "POST",
    data: toPostWritePayload(request),
  });
  return resolveCreatedPostDetail(response.data, response.headers.location);
}

export async function updatePostEntry(
  postId: number,
  request: PostUpdateRequest,
): Promise<PostDetail> {
  const response = await api<unknown>(`${POSTS_ENDPOINT}/${postId}`, {
    method: "PUT",
    data: toPostWritePayload(request),
  });

  return normalizeDetail(response);
}

export async function createPostDraft(
  request: PostDraftRequest,
): Promise<DraftDetail> {
  const response = await api<unknown>(DRAFTS_ENDPOINT, {
    method: "POST",
    data: toDraftWritePayload(request),
  });
  return normalizeDraftDetail(response);
}

export async function updatePostDraft(
  draftId: number,
  request: PostDraftRequest,
): Promise<DraftDetail> {
  const response = await api<unknown>(`${DRAFTS_ENDPOINT}/${draftId}`, {
    method: "PUT",
    data: toDraftWritePayload(request),
  });

  return normalizeDraftDetail(response, draftId);
}

export async function getPostDraft(draftId: number): Promise<DraftDetail> {
  const response = await api<unknown>(`${DRAFTS_ENDPOINT}/${draftId}`);
  return normalizeDraftDetail(response, draftId);
}

export async function getPostDrafts(page = 0, size = 10): Promise<DraftSummary[]> {
  const response = await api<unknown>(
    `${DRAFTS_ENDPOINT}${toQueryString({
      page,
      size,
    })}`,
  );

  const record = toRecord(response);
  const list = Array.isArray(record?.content)
    ? record.content
    : Array.isArray(response)
      ? response
      : [];

  return list.reduce<DraftSummary[]>((accumulator, item) => {
    const row = toRecord(item);
    if (!row) return accumulator;

    accumulator.push({
      id: toNumber(row.id),
      title: toText(row.title) || "제목 없음",
      subtitle: toText(row.subtitle),
      updatedAt: toText(row.updatedAt) || new Date().toISOString(),
      autosavedAt: toText(row.autosavedAt),
    });

    return accumulator;
  }, []);
}

export async function deletePostDraft(draftId: number): Promise<void> {
  await api<void>(`${DRAFTS_ENDPOINT}/${draftId}`, {
    method: "DELETE",
  });
}

export async function createPostBySpec(
  request: PostWriteRequest,
): Promise<PostDetail> {
  const response = await apiWithMeta<unknown>(POSTS_ENDPOINT, {
    method: "POST",
    data: request,
  });
  return resolveCreatedPostDetail(response.data, response.headers.location);
}

export async function updatePostBySpec(
  postId: number,
  request: PostWriteRequest,
): Promise<PostDetail> {
  const response = await api<unknown>(`${POSTS_ENDPOINT}/${postId}`, {
    method: "PUT",
    data: request,
  });
  return normalizeDetail(response);
}

export async function deletePostEntry(postId: number): Promise<void> {
  await api<void>(`${POSTS_ENDPOINT}/${postId}`, {
    method: "DELETE",
  });
}

export async function createDraftBySpec(
  request: DraftWriteRequest,
): Promise<DraftDetail> {
  const response = await api<unknown>(DRAFTS_ENDPOINT, {
    method: "POST",
    data: request,
  });
  return normalizeDraftDetail(response);
}

export async function updateDraftBySpec(
  draftId: number,
  request: DraftWriteRequest,
): Promise<DraftDetail> {
  const response = await api<unknown>(`${DRAFTS_ENDPOINT}/${draftId}`, {
    method: "PUT",
    data: request,
  });
  return normalizeDraftDetail(response, draftId);
}

export async function likePost(postId: number): Promise<void> {
  await api<void>(`${POSTS_ENDPOINT}/${postId}/likes`, {
    method: "POST",
  });
}

export async function unlikePost(postId: number): Promise<void> {
  await api<void>(`${POSTS_ENDPOINT}/${postId}/likes`, {
    method: "DELETE",
  });
}

export async function getMyPostLikeStatus(postId: number): Promise<PostLikeStatus> {
  const response = await api<unknown>(`${POSTS_ENDPOINT}/${postId}/likes/me`);
  return normalizePostLikeStatus(response);
}

export async function getMyPagePostList(): Promise<PostListItem[]> {
  const response = await api<unknown>(MYPAGE_POSTS_ENDPOINT);
  const record = toRecord(response);
  const list = Array.isArray(record?.content)
    ? record.content
    : Array.isArray(response)
      ? response
      : [];

  return list.map((item) => normalizeSummary(item));
}
