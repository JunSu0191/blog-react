import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getComments,
  getCommentReplies,
  createComment,
  updateComment,
  deleteComment,
  type CommentResponse,
  type CommentCreateRequest,
  type CommentUpdateRequest,
} from "./api";

type UpdateCommentVariables = {
  id: number;
  postId: number;
  req: CommentUpdateRequest;
  parentId?: number | null;
};

type DeleteCommentVariables = {
  id: number;
  postId: number;
  parentId?: number | null;
};

const rootCommentsQueryKey = (postId: number) => ["comments", postId, "roots"] as const;
const commentRepliesQueryKey = (commentId: number) =>
  ["comments", "replies", commentId] as const;

type UseCommentsOptions = {
  enabled?: boolean;
};

export function useComments(postId: number, options?: UseCommentsOptions) {
  return useQuery({
    queryKey: rootCommentsQueryKey(postId),
    queryFn: () => getComments(postId),
    enabled:
      Number.isFinite(postId) &&
      postId > 0 &&
      (options?.enabled ?? true),
  });
}

export function useCommentReplies(commentId: number, options?: UseCommentsOptions) {
  return useQuery({
    queryKey: commentRepliesQueryKey(commentId),
    queryFn: () => getCommentReplies(commentId),
    enabled:
      Number.isFinite(commentId) &&
      commentId > 0 &&
      (options?.enabled ?? true),
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: CommentCreateRequest) => createComment(req),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({
        queryKey: rootCommentsQueryKey(variables.postId),
        exact: true,
      });
      if (typeof variables.parentId === "number") {
        queryClient.invalidateQueries({
          queryKey: commentRepliesQueryKey(variables.parentId),
          exact: true,
        });
      }
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, req }: UpdateCommentVariables) => updateComment(id, req),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({
        queryKey: rootCommentsQueryKey(variables.postId),
        exact: true,
      });
      if (typeof variables.parentId === "number") {
        queryClient.invalidateQueries({
          queryKey: commentRepliesQueryKey(variables.parentId),
          exact: true,
        });
      }
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: DeleteCommentVariables) => deleteComment(id),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({
        queryKey: rootCommentsQueryKey(variables.postId),
        exact: true,
      });
      if (typeof variables.parentId === "number") {
        queryClient.invalidateQueries({
          queryKey: commentRepliesQueryKey(variables.parentId),
          exact: true,
        });
      }
    },
  });
}

export { rootCommentsQueryKey, commentRepliesQueryKey };
export type { CommentResponse };
