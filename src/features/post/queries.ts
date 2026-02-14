import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import type { ApiError } from "../../shared/lib/api";
import {
  getPosts,
  getPostsByCursor,
  getPost,
  createPost,
  updatePost,
  deletePost,
  getPostsByUser,
  type Post,
  type CreatePostRequest,
  type UpdatePostRequest,
  type CursorPostsPage,
  type PageResponse,
  type PostsCursorRequest,
  type PostsPageRequest,
} from "./api";

type QueryOptions = {
  enabled?: boolean;
};

/**
 * 모든 게시글 목록을 가져오는 쿼리 훅 (페이지네이션 지원)
 * - TanStack Query의 useQuery를 사용하여 서버 데이터를 캐싱하고 관리
 * - 자동으로 로딩 상태, 에러 상태, 데이터 리패칭 등을 처리
 * - queryKey: ["posts", params] - 파라미터별로 캐시를 분리
 * - queryFn: getPosts - 데이터를 가져오는 함수
 * @param params 페이지네이션 및 검색 파라미터
 * @returns { data: PageResponse<Post>, isLoading: boolean, error: ApiError | null, ... }
 */
export function usePosts(params?: PostsPageRequest, options?: QueryOptions) {
  return useQuery<PageResponse<Post>, ApiError>({
    queryKey: ["posts", params],
    queryFn: () => getPosts(params),
    enabled: options?.enabled ?? true,
  });
}

export function useInfinitePosts(
  params?: Omit<PostsCursorRequest, "cursorId">,
  options?: QueryOptions,
) {
  return useInfiniteQuery<CursorPostsPage, ApiError>({
    queryKey: ["posts", "infinite", params],
    queryFn: ({ pageParam }) =>
      getPostsByCursor({
        ...params,
        cursorId: typeof pageParam === "number" ? pageParam : undefined,
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const nextCursorId = lastPage.nextCursorId;
      if (typeof nextCursorId !== "number") return undefined;

      const duplicatedCursor = allPages
        .slice(0, -1)
        .some((page) => page.nextCursorId === nextCursorId);
      if (duplicatedCursor) return undefined;

      return nextCursorId;
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * 특정 ID의 게시글을 가져오는 쿼리 훅
 * - ID가 제공될 때만 쿼리를 실행 (enabled: !!id)
 * - queryKey: ["posts", id] - ID별로 캐시를 분리
 * @param id 게시글 ID
 * @returns { data: Post | undefined, isLoading: boolean, error: ApiError | null, ... }
 */
export function usePost(id: number) {
  return useQuery<Post, ApiError>({
    queryKey: ["posts", id],
    queryFn: () => getPost(id),
    enabled: !!id, // id가 존재할 때만 쿼리 실행
  });
}

/**
 * 특정 사용자의 게시글 목록을 가져오는 쿼리 훅
 * - userId가 제공될 때만 쿼리를 실행
 * - queryKey: ["posts", "user", userId] - 사용자별 캐시 분리
 * @param userId 사용자 ID
 * @returns { data: Post[], isLoading: boolean, error: ApiError | null, ... }
 */
export function usePostsByUser(userId: number) {
  return useQuery<Post[], ApiError>({
    queryKey: ["posts", "user", userId],
    queryFn: () => getPostsByUser(userId),
    enabled: !!userId,
  });
}

/**
 * 새 게시글을 생성하는 뮤테이션 훅
 * - TanStack Query의 useMutation을 사용하여 서버 데이터 변경 작업 처리
 * - 성공 시 모든 게시글 쿼리를 무효화하여 최신 데이터로 업데이트
 * - mutationFn: createPost - 데이터를 변경하는 함수
 * - onSuccess: 성공 콜백에서 캐시 무효화
 * @returns { mutate: (req: CreatePostRequest) => void, isPending: boolean, error: ApiError | null, ... }
 */
export function useCreatePost() {
  const queryClient = useQueryClient(); // 쿼리 클라이언트로 캐시 관리
  return useMutation<Post, ApiError, CreatePostRequest>({
    mutationFn: createPost,
    onSuccess: () => {
      // 성공 시 게시글 목록 캐시 무효화 (자동 리패칭)
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

/**
 * 게시글을 수정하는 뮤테이션 훅
 * - 성공 시 관련 쿼리들을 무효화하여 캐시 업데이트
 * - invalidateQueries로 전체 목록과 특정 게시글 캐시를 무효화
 * @returns { mutate: ({ id, req }: { id: number; req: UpdatePostRequest }) => void, isPending: boolean, error: ApiError | null, ... }
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation<Post, ApiError, { id: number; req: UpdatePostRequest }>({
    mutationFn: ({ id, req }) => updatePost(id, req),
    onSuccess: (data) => {
      // 성공 시 목록과 수정된 게시글 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts", data.id] });
    },
  });
}

/**
 * 게시글을 삭제하는 뮤테이션 훅
 * - 성공 시 게시글 목록 캐시 무효화
 * @returns { mutate: (id: number) => void, isPending: boolean, error: ApiError | null, ... }
 */
export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
