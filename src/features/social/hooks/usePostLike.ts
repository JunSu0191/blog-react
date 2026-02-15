import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/shared/lib/api";
import { showErrorToast } from "@/shared/lib/errorToast";
import {
  getMyPostLikeStatus,
  likePost,
  unlikePost,
} from "../api/modules/postLikeApi";
import type { PostLikeStatus } from "../types";

const postLikeQueryKey = (postId: number) => ["post-like", postId] as const;

type UsePostLikeOptions = {
  initialLikeCount?: number;
};

type ToggleContext = {
  previousStatus: PostLikeStatus;
};

export function usePostLike(postId: number, options?: UsePostLikeOptions) {
  const queryClient = useQueryClient();
  const fallbackStatus: PostLikeStatus = {
    postId,
    liked: false,
    likeCount: Math.max(0, Math.floor(options?.initialLikeCount ?? 0)),
  };

  const query = useQuery<PostLikeStatus, ApiError>({
    queryKey: postLikeQueryKey(postId),
    queryFn: () => getMyPostLikeStatus(postId),
    enabled: Number.isFinite(postId) && postId > 0,
    initialData: fallbackStatus,
  });

  const mutation = useMutation<PostLikeStatus, ApiError, boolean, ToggleContext>({
    mutationFn: (nextLiked) => (nextLiked ? likePost(postId) : unlikePost(postId)),
    onMutate: async (nextLiked) => {
      console.debug("[post-like] mutation request", {
        postId,
        nextLiked,
      });

      const key = postLikeQueryKey(postId);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previousStatus =
        queryClient.getQueryData<PostLikeStatus>(key) ?? fallbackStatus;
      const nextStatus: PostLikeStatus = {
        postId,
        liked: nextLiked,
        likeCount: Math.max(
          0,
          previousStatus.likeCount + (nextLiked ? 1 : -1),
        ),
      };

      queryClient.setQueryData<PostLikeStatus>(key, nextStatus);

      return { previousStatus };
    },
    onError: (error, _nextLiked, context) => {
      queryClient.setQueryData(
        postLikeQueryKey(postId),
        context?.previousStatus ?? fallbackStatus,
      );
      showErrorToast(error, "좋아요 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
    },
    onSuccess: (data) => {
      console.debug("[post-like] mutation success", {
        postId,
        data,
      });
      queryClient.setQueryData(postLikeQueryKey(postId), data);

      const finalStatus = queryClient.getQueryData<PostLikeStatus>(
        postLikeQueryKey(postId),
      );
      console.debug("[post-like] ui synced", {
        postId,
        liked: finalStatus?.liked,
        likeCount: finalStatus?.likeCount,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: postLikeQueryKey(postId),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: ["post", postId],
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: ["posts", postId],
        exact: true,
      });
    },
  });

  const status = query.data ?? fallbackStatus;
  const toggleLike = () => {
    if (mutation.isPending) return;
    mutation.mutate(!status.liked);
  };

  return {
    status,
    toggleLike,
    isLoading: query.isLoading,
    isSyncing: query.isFetching || mutation.isPending,
  };
}
