export type BlogPostSort = "latest" | "popular" | "views";

export type BlogThemePreset = "minimal" | "ocean" | "sunset" | "forest";
export type BlogProfileLayout = "default" | "compact" | "centered";
export type BlogFontScale = "sm" | "md" | "lg";

export type BlogThemeSettings = {
  themePreset: BlogThemePreset;
  accentColor: string;
  coverImageUrl?: string;
  profileLayout: BlogProfileLayout;
  fontScale: BlogFontScale;
  showStats: boolean;
};

export type BlogThemeSettingsRequest = {
  themePreset: BlogThemePreset;
  accentColor: string;
  coverImageUrl?: string | null;
  profileLayout: BlogProfileLayout;
  fontScale: BlogFontScale;
  showStats: boolean;
};

export type BlogProfileQuery = {
  q?: string;
  sort?: BlogPostSort;
  page?: number;
  size?: number;
};

export type BlogProfileUser = {
  userId: number;
  username: string;
  name?: string;
  nickname?: string;
  joinedAt?: string;
};

export type BlogProfileMeta = {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  websiteUrl?: string;
  location?: string;
};

export type BlogProfileStats = {
  publishedPostCount: number;
};

export type BlogProfilePostTag = {
  id?: number;
  name: string;
};

export type BlogProfilePostCategory = {
  id?: number;
  name: string;
};

export type BlogProfilePost = {
  id: number;
  title: string;
  subtitle?: string;
  excerpt?: string;
  thumbnailUrl?: string;
  category?: BlogProfilePostCategory | null;
  tags: BlogProfilePostTag[];
  viewCount: number;
  likeCount: number;
  readTimeMinutes: number;
  publishedAt?: string;
  createdAt?: string;
};

export type BlogProfilePostsPage = {
  content: BlogProfilePost[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  numberOfElements: number;
};

export type BlogProfileData = {
  blogPath?: string;
  blogUrl?: string;
  user: BlogProfileUser;
  profile: BlogProfileMeta;
  blogSettings: BlogThemeSettings;
  stats: BlogProfileStats;
  posts: BlogProfilePostsPage;
};
