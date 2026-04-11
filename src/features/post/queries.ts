import {
  useQueries,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ApiError } from "@/shared/lib/api";
import {
  createDraftBySpec,
  createPostBySpec,
  createPostDraft,
  createPostEntry,
  deletePostEntry,
  deletePostDraft,
  fetchPostCategories,
  fetchPostById,
  fetchPosts,
  fetchRelatedPosts,
  fetchSeriesById,
  fetchSeriesList,
  getMyPagePostList,
  getMyPostLikeStatus,
  getPostDraft,
  getPostDrafts,
  likePost,
  type PostLikeStatus,
  unlikePost,
  updateDraftBySpec,
  updatePostBySpec,
  updatePostDraft,
  updatePostEntry,
} from "./api";
import type {
  DraftDetail,
  DraftSummary,
  DraftWriteRequest,
  PagedResponse,
  PostCategoryOption,
  PostDetail,
  PostListItem,
  PostListQuery,
  PostPublishRequest,
  PostSummary,
  PostUpdateRequest,
  PostWriteRequest,
  SeriesDetail,
  SeriesSummary,
} from "./types/api";

type QueryOptions = {
  enabled?: boolean;
};

export function usePostFeed(params?: PostListQuery, options?: QueryOptions) {
  return useQuery<PagedResponse<PostSummary>, ApiError>({
    queryKey: ["posts", "feed", params],
    queryFn: () => fetchPosts(params),
    enabled: options?.enabled ?? true,
  });
}

type InfinitePostFeedParams = Omit<PostListQuery, "page" | "size"> & {
  size?: number;
};

export function useInfinitePostFeed(
  params?: InfinitePostFeedParams,
  options?: QueryOptions,
) {
  const pageSize = params?.size ?? 20;

  return useInfiniteQuery<PagedResponse<PostSummary>, ApiError>({
    queryKey: ["posts", "feed", "infinite", params],
    queryFn: ({ pageParam }) =>
      fetchPosts({
        ...params,
        page: typeof pageParam === "number" ? pageParam : 0,
        size: pageSize,
      }),
    enabled: options?.enabled ?? true,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.last ? undefined : lastPage.pageNumber + 1,
  });
}

export function usePostCategories(options?: QueryOptions) {
  return useQuery<PostCategoryOption[], ApiError>({
    queryKey: ["posts", "categories"],
    queryFn: () => fetchPostCategories(),
    enabled: options?.enabled ?? true,
  });
}

export function useSeriesList(options?: QueryOptions) {
  return useQuery<SeriesSummary[], ApiError>({
    queryKey: ["series", "list"],
    queryFn: () => fetchSeriesList(),
    enabled: options?.enabled ?? true,
  });
}

export function useSeriesDetail(seriesId: number, options?: QueryOptions) {
  return useQuery<SeriesDetail, ApiError>({
    queryKey: ["series", "detail", seriesId],
    queryFn: () => fetchSeriesById(seriesId),
    enabled:
      (options?.enabled ?? true) && Number.isFinite(seriesId) && seriesId > 0,
  });
}

export function usePostDetail(postId: number, options?: QueryOptions) {
  return useQuery<PostDetail, ApiError>({
    queryKey: ["posts", "detail", postId],
    queryFn: () => fetchPostById(postId),
    enabled: (options?.enabled ?? true) && Number.isFinite(postId) && postId > 0,
  });
}

export function useBookmarkedPosts(postIds: number[]) {
  const normalizedPostIds = [...new Set(postIds)].filter(
    (postId) => Number.isFinite(postId) && postId > 0,
  );

  const queries = useQueries({
    queries: normalizedPostIds.map((postId) => ({
      queryKey: ["posts", "detail", postId],
      queryFn: () => fetchPostById(postId),
      enabled: true,
    })),
  });

  return {
    items: queries
      .map((query) => query.data)
      .filter((item): item is PostDetail => Boolean(item)),
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
  };
}

export function useRelatedPosts(postId: number, limit = 5, options?: QueryOptions) {
  return useQuery<PostSummary[], ApiError>({
    queryKey: ["posts", "related", postId, limit],
    queryFn: () => fetchRelatedPosts(postId, limit),
    enabled: (options?.enabled ?? true) && Number.isFinite(postId) && postId > 0,
  });
}

export function usePostDrafts(options?: QueryOptions) {
  return useQuery<DraftSummary[], ApiError>({
    queryKey: ["posts", "drafts"],
    queryFn: () => getPostDrafts(),
    enabled: options?.enabled ?? true,
  });
}

export function usePostDraft(draftId?: number, options?: QueryOptions) {
  return useQuery<DraftDetail, ApiError>({
    queryKey: ["posts", "drafts", draftId],
    queryFn: () => getPostDraft(draftId as number),
    enabled: (options?.enabled ?? true) && typeof draftId === "number",
  });
}

export function useSavePostDraft() {
  const queryClient = useQueryClient();

  return useMutation<
    DraftDetail,
    ApiError,
    { draftId?: number; request: PostPublishRequest }
  >({
    mutationFn: ({ draftId, request }) => {
      const payload = {
        title: request.title,
        subtitle: request.subtitle,
        category: request.category,
        seriesId: request.seriesId,
        seriesTitle: request.seriesTitle,
        seriesOrder: request.seriesOrder,
        tags: request.tags,
        thumbnailUrl: request.thumbnailUrl,
        contentJson: request.contentJson,
        contentHtml: request.contentHtml,
      };

      if (typeof draftId === "number") {
        return updatePostDraft(draftId, payload);
      }
      return createPostDraft(payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["posts", "drafts"] });
      queryClient.setQueryData(["posts", "drafts", data.id], data);
    },
  });
}

export function useDeletePostDraft() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (draftId) => deletePostDraft(draftId),
    onSuccess: (_data, draftId) => {
      queryClient.invalidateQueries({ queryKey: ["posts", "drafts"] });
      queryClient.removeQueries({ queryKey: ["posts", "drafts", draftId] });
    },
  });
}

export function usePublishPost() {
  const queryClient = useQueryClient();

  return useMutation<PostDetail, ApiError, PostPublishRequest>({
    mutationFn: (request) => createPostEntry(request),
    onSuccess: (createdPost) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.setQueryData(["posts", "detail", createdPost.id], createdPost);
    },
  });
}

export function usePatchPost() {
  const queryClient = useQueryClient();

  return useMutation<
    PostDetail,
    ApiError,
    { postId: number; request: PostUpdateRequest }
  >({
    mutationFn: ({ postId, request }) => updatePostEntry(postId, request),
    onSuccess: (updatedPost) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.setQueryData(["posts", "detail", updatedPost.id], updatedPost);
    },
  });
}

export function usePublishPostBySpec() {
  const queryClient = useQueryClient();

  return useMutation<PostDetail, ApiError, PostWriteRequest>({
    mutationFn: (request) => createPostBySpec(request),
    onSuccess: (createdPost) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.setQueryData(["posts", "detail", createdPost.id], createdPost);
    },
  });
}

export function usePatchPostBySpec() {
  const queryClient = useQueryClient();

  return useMutation<
    PostDetail,
    ApiError,
    { postId: number; request: PostWriteRequest }
  >({
    mutationFn: ({ postId, request }) => updatePostBySpec(postId, request),
    onSuccess: (updatedPost) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.setQueryData(["posts", "detail", updatedPost.id], updatedPost);
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (postId) => deletePostEntry(postId),
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.removeQueries({ queryKey: ["posts", "detail", postId] });
      queryClient.removeQueries({ queryKey: ["posts", "related", postId] });
    },
  });
}

export function useSavePostDraftBySpec() {
  const queryClient = useQueryClient();

  return useMutation<
    DraftDetail,
    ApiError,
    { draftId?: number; request: DraftWriteRequest }
  >({
    mutationFn: ({ draftId, request }) => {
      if (typeof draftId === "number") {
        return updateDraftBySpec(draftId, request);
      }
      return createDraftBySpec(request);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["posts", "drafts"] });
      queryClient.setQueryData(["posts", "drafts", data.id], data);
    },
  });
}

export function useMyPagePostList(options?: QueryOptions) {
  return useQuery<PostListItem[], ApiError>({
    queryKey: ["posts", "mypage"],
    queryFn: () => getMyPagePostList(),
    enabled: options?.enabled ?? true,
  });
}

export function useMyPostLikeStatus(postId?: number, options?: QueryOptions) {
  return useQuery<PostLikeStatus, ApiError>({
    queryKey: ["posts", "likes", "me", postId],
    queryFn: () => getMyPostLikeStatus(postId as number),
    enabled: (options?.enabled ?? true) && typeof postId === "number",
  });
}

export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (postId) => likePost(postId),
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts", "likes", "me", postId] });
    },
  });
}

export function useUnlikePost() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (postId) => unlikePost(postId),
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts", "likes", "me", postId] });
    },
  });
}
