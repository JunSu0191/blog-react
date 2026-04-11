import type { PostSort, PostStatus } from "./enums";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
  [key: string]: JsonValue;
};

export type PostCategory = {
  id?: number;
  name: string;
};

export type PostCategoryOption = {
  id: number;
  name: string;
};

export type PostTag = {
  id?: number;
  name: string;
  slug?: string;
};

export type PostAuthor = {
  id: number;
  username?: string;
  name?: string;
  nickname?: string;
  profileImageUrl?: string;
};

export type PostSeries = {
  id?: number;
  title: string;
  slug?: string;
  description?: string;
  coverImageUrl?: string;
  order?: number;
  postCount?: number;
  authorId?: number;
};

export type PostTocItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

export type PostSummary = {
  id: number;
  title: string;
  subtitle?: string;
  excerpt?: string;
  thumbnailUrl?: string;
  imageUrls: string[];
  category?: PostCategory | null;
  tags: PostTag[];
  author?: PostAuthor | null;
  series?: PostSeries | null;
  readTimeMinutes: number;
  viewCount: number;
  likeCount: number;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: PostStatus;
};

export type AdjacentPost = {
  id: number;
  title: string;
};

export type PostDetail = PostSummary & {
  contentHtml: string;
  contentJson?: JsonValue;
  toc: PostTocItem[];
  previousPost?: AdjacentPost | null;
  nextPost?: AdjacentPost | null;
};

export type DraftSummary = {
  id: number;
  title: string;
  subtitle?: string;
  updatedAt: string;
  autosavedAt?: string;
};

export type DraftDetail = {
  id: number;
  title: string;
  subtitle?: string;
  category?: string;
  seriesId?: number;
  seriesTitle?: string;
  seriesOrder?: number;
  tags: string[];
  thumbnailUrl?: string;
  contentHtml: string;
  contentJson?: JsonValue;
  autosavedAt?: string;
  updatedAt: string;
};

export type SeriesSummary = {
  id: number;
  title: string;
  slug?: string;
  description?: string;
  coverImageUrl?: string;
  postCount: number;
  authorId?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SeriesDetail = SeriesSummary & {
  posts: PostSummary[];
};

export type PostListQuery = {
  q?: string;
  categoryId?: number;
  category?: string;
  tag?: string;
  sort?: PostSort;
  page?: number;
  size?: number;
};

export type PageInfo = {
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  numberOfElements: number;
};

export type PagedResponse<T> = PageInfo & {
  content: T[];
};

export type PageResponse<T> = PagedResponse<T>;
export type PostListItem = PostSummary;

export type PostWriteRequest = {
  title: string;
  slug?: string;
  subtitle?: string;
  categoryId?: number;
  category?: string;
  seriesId?: number;
  seriesTitle?: string;
  seriesOrder?: number;
  tagIds?: number[];
  tags?: string[];
  thumbnailUrl?: string;
  contentJson?: JsonValue;
  contentHtml?: string;
  publishNow?: boolean;
  draftId?: number;
};

export type DraftWriteRequest = {
  title: string;
  subtitle?: string;
  categoryId?: number;
  category?: string;
  seriesId?: number;
  seriesTitle?: string;
  seriesOrder?: number;
  tagIds?: number[];
  tags?: string[];
  thumbnailUrl?: string;
  contentJson?: JsonValue;
  contentHtml?: string;
  publishNow?: boolean;
};

export type PostPublishRequest = {
  title: string;
  subtitle?: string;
  category?: string;
  seriesId?: number;
  seriesTitle?: string;
  seriesOrder?: number;
  tags: string[];
  thumbnailUrl?: string;
  contentJson?: JsonValue;
  contentHtml: string;
  publishNow?: boolean;
  draftId?: number;
};

export type PostUpdateRequest = PostPublishRequest;

export type PostDraftRequest = {
  title: string;
  subtitle?: string;
  category?: string;
  seriesId?: number;
  seriesTitle?: string;
  seriesOrder?: number;
  tags: string[];
  thumbnailUrl?: string;
  contentJson?: JsonValue;
  contentHtml: string;
};

export type UploadImageResponse = {
  url: string;
  width?: number;
  height?: number;
  size?: number;
};
