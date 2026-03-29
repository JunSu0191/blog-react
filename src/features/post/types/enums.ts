export const PostStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export const PostSort = {
  LATEST: "latest",
  POPULAR: "popular",
  VIEWS: "views",
} as const;

export type PostSort = (typeof PostSort)[keyof typeof PostSort];

export const PostListLayout = {
  GRID: "grid",
  LIST: "list",
} as const;

export type PostListLayout =
  (typeof PostListLayout)[keyof typeof PostListLayout];

export const ComposeMode = {
  WRITE: "write",
  PREVIEW: "preview",
} as const;

export type ComposeMode = (typeof ComposeMode)[keyof typeof ComposeMode];
