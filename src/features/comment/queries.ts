import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getComments,
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
};

type DeleteCommentVariables = {
  id: number;
  postId: number;
};

const commentsQueryKey = (postId: number) => ["comments", postId] as const;

// 댓글 목록 조회
export function useComments(postId: number) {
  return useQuery({
    queryKey: commentsQueryKey(postId),
    queryFn: () => getComments(postId),
  });
}

// 댓글 생성
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: CommentCreateRequest) => createComment(req),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentsQueryKey(variables.postId),
        exact: true,
      });
    },
  });
}

// 댓글 수정
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, req }: UpdateCommentVariables) =>
      updateComment(id, req),
    onMutate: async (variables) => {
      const key = commentsQueryKey(variables.postId);
      await queryClient.cancelQueries({ queryKey: key });
      const previousComments = queryClient.getQueryData<CommentResponse[]>(key);

      queryClient.setQueryData<CommentResponse[]>(key, (current = []) =>
        current.map((comment) =>
          comment.id === variables.id
            ? {
                ...comment,
                content: variables.req.content,
                updatedAt: new Date().toISOString(),
              }
            : comment
        )
      );

      return { previousComments, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(context.key, context.previousComments);
      }
    },
    onSuccess: (response, variables) => {
      if (response) {
        queryClient.setQueryData<CommentResponse[]>(
          commentsQueryKey(variables.postId),
          (current = []) =>
            current.map((comment) =>
              comment.id === variables.id ? { ...comment, ...response } : comment
            )
        );
      }
    },
    onSettled: (_response, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentsQueryKey(variables.postId),
        exact: true,
      });
    },
  });
}

// 댓글 삭제
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: DeleteCommentVariables) => deleteComment(id),
    onMutate: async (variables) => {
      const key = commentsQueryKey(variables.postId);
      await queryClient.cancelQueries({ queryKey: key });
      const previousComments = queryClient.getQueryData<CommentResponse[]>(key);

      queryClient.setQueryData<CommentResponse[]>(key, (current = []) =>
        current.filter((comment) => comment.id !== variables.id)
      );

      return { previousComments, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(context.key, context.previousComments);
      }
    },
    onSettled: (_response, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentsQueryKey(variables.postId),
        exact: true,
      });
    },
  });
}
