import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/shared/lib/api";
import { showErrorToast } from "@/shared/lib/errorToast";
import {
  getMyCommentReactionStatus,
  updateCommentReaction,
} from "../api/modules/commentReactionApi";
import type {
  CommentReactionStatus,
  CommentReactionType,
} from "../types";

const commentReactionQueryKey = (commentId: number) =>
  ["comment-reaction", commentId] as const;

type UseCommentReactionOptions = {
  postId?: number;
  initialStatus?: Partial<CommentReactionStatus>;
};

type UpdateContext = {
  previousReaction: CommentReactionStatus;
  previousComments?: Array<Record<string, unknown>>;
};

function toReactionType(value: unknown): CommentReactionType {
  if (typeof value !== "string") return "NONE";
  const normalized = value.trim().toUpperCase();
  if (normalized === "LIKE") return "LIKE";
  if (normalized === "DISLIKE") return "DISLIKE";
  return "NONE";
}

function computeNextReaction(
  current: CommentReactionType,
  clicked: Exclude<CommentReactionType, "NONE">,
): CommentReactionType {
  if (clicked === "LIKE") return current === "LIKE" ? "NONE" : "LIKE";
  return current === "DISLIKE" ? "NONE" : "DISLIKE";
}

function applyReactionByNext(
  base: CommentReactionStatus,
  nextReaction: CommentReactionType,
): CommentReactionStatus {
  let likeCount = base.likeCount;
  let dislikeCount = base.dislikeCount;

  if (base.myReaction === "LIKE") likeCount = Math.max(0, likeCount - 1);
  if (base.myReaction === "DISLIKE") dislikeCount = Math.max(0, dislikeCount - 1);

  if (nextReaction === "LIKE") likeCount += 1;
  if (nextReaction === "DISLIKE") dislikeCount += 1;

  return {
    ...base,
    myReaction: nextReaction,
    likeCount,
    dislikeCount,
  };
}

function patchCommentReactionInList(
  list: Array<Record<string, unknown>> | undefined,
  reaction: CommentReactionStatus,
) {
  if (!Array.isArray(list)) return list;
  return list.map((comment) => {
    const rawId = comment.id;
    const commentId =
      typeof rawId === "number"
        ? rawId
        : typeof rawId === "string"
          ? Number(rawId)
          : NaN;
    if (!Number.isFinite(commentId) || commentId !== reaction.commentId) return comment;

    return {
      ...comment,
      likeCount: reaction.likeCount,
      dislikeCount: reaction.dislikeCount,
      myReaction: reaction.myReaction,
    };
  });
}

export function useCommentReaction(
  commentId: number,
  options?: UseCommentReactionOptions,
) {
  const queryClient = useQueryClient();
  const initialStatus: CommentReactionStatus = {
    commentId,
    myReaction: toReactionType(options?.initialStatus?.myReaction),
    likeCount: Math.max(0, Math.floor(options?.initialStatus?.likeCount ?? 0)),
    dislikeCount: Math.max(0, Math.floor(options?.initialStatus?.dislikeCount ?? 0)),
  };
  const shouldSyncFromServer = options?.initialStatus?.myReaction == null;

  const query = useQuery<CommentReactionStatus, ApiError>({
    queryKey: commentReactionQueryKey(commentId),
    queryFn: () => getMyCommentReactionStatus(commentId),
    enabled: Number.isFinite(commentId) && commentId > 0 && shouldSyncFromServer,
    initialData: initialStatus,
  });

  const mutation = useMutation<
    CommentReactionStatus,
    ApiError,
    CommentReactionType,
    UpdateContext
  >({
    mutationFn: (nextReaction) =>
      updateCommentReaction(commentId, nextReaction),
    onMutate: async (nextReaction) => {
      console.debug("[comment-reaction] mutation request", {
        commentId,
        postId: options?.postId,
        payload: { reactionType: nextReaction },
      });

      const key = commentReactionQueryKey(commentId);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previousReaction =
        queryClient.getQueryData<CommentReactionStatus>(key) ?? initialStatus;
      const base = previousReaction;
      const optimistic = applyReactionByNext(base, nextReaction);
      queryClient.setQueryData(key, optimistic);

      let previousComments: Array<Record<string, unknown>> | undefined;
      if (typeof options?.postId === "number") {
        const commentsKey = ["comments", options.postId] as const;
        previousComments = queryClient.getQueryData<Array<Record<string, unknown>>>(
          commentsKey,
        );
        queryClient.setQueryData<Array<Record<string, unknown>>>(
          commentsKey,
          (current) => patchCommentReactionInList(current, optimistic),
        );
      }

      return { previousReaction, previousComments };
    },
    onError: (error, _nextReaction, context) => {
      queryClient.setQueryData(
        commentReactionQueryKey(commentId),
        context?.previousReaction ?? initialStatus,
      );

      if (
        typeof options?.postId === "number" &&
        context?.previousComments
      ) {
        queryClient.setQueryData(
          ["comments", options.postId],
          context.previousComments,
        );
      }

      showErrorToast(
        error,
        "댓글 반응 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
    onSuccess: (data) => {
      console.debug("[comment-reaction] mutation success", {
        commentId,
        postId: options?.postId,
        data,
      });
      queryClient.setQueryData(commentReactionQueryKey(commentId), data);
      if (typeof options?.postId === "number") {
        queryClient.setQueryData<Array<Record<string, unknown>>>(
          ["comments", options.postId],
          (current) => patchCommentReactionInList(current, data),
        );
      }

      const finalStatus = queryClient.getQueryData<CommentReactionStatus>(
        commentReactionQueryKey(commentId),
      );
      console.debug("[comment-reaction] ui synced", {
        commentId,
        myReaction: finalStatus?.myReaction,
        likeCount: finalStatus?.likeCount,
        dislikeCount: finalStatus?.dislikeCount,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: commentReactionQueryKey(commentId),
        exact: true,
      });
      if (typeof options?.postId === "number") {
        void queryClient.invalidateQueries({
          queryKey: ["comments", options.postId],
          exact: true,
        });
      }
    },
  });

  const status = query.data ?? initialStatus;
  const reactToLike = () => {
    if (mutation.isPending) return;
    mutation.mutate(computeNextReaction(status.myReaction, "LIKE"));
  };
  const reactToDislike = () => {
    if (mutation.isPending) return;
    mutation.mutate(computeNextReaction(status.myReaction, "DISLIKE"));
  };

  return {
    status,
    reactToLike,
    reactToDislike,
    isLoading: query.isLoading,
    isSyncing: query.isFetching || mutation.isPending,
  };
}
