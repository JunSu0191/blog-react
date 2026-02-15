import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/shared/lib/api";
import { showErrorToast } from "@/shared/lib/errorToast";
import {
  getMyPageComments,
  getMyPagePosts,
  getMyPageSummary,
  updateMyPageProfile,
} from "../api/modules/myPageApi";
import type {
  MyPageCommentItem,
  MyPagePostItem,
  MyPageProfileUpdateRequest,
  MyPageSummary,
} from "../types";

const myPageSummaryQueryKey = ["mypage-summary"] as const;
const myPagePostsQueryKey = ["mypage-posts"] as const;
const myPageCommentsQueryKey = ["mypage-comments"] as const;

type UpdateContext = {
  previousSummary?: MyPageSummary;
};

function patchSummaryWithProfile(
  summary: MyPageSummary,
  payload: MyPageProfileUpdateRequest,
): MyPageSummary {
  return {
    ...summary,
    name: payload.name,
    profile: {
      ...summary.profile,
      displayName: payload.displayName,
      bio: payload.bio,
      avatarUrl: payload.avatarUrl,
      websiteUrl: payload.websiteUrl,
      location: payload.location,
    },
  };
}

export function useMyPage() {
  const queryClient = useQueryClient();
  const [summaryQuery, postsQuery, commentsQuery] = useQueries({
    queries: [
      {
        queryKey: myPageSummaryQueryKey,
        queryFn: getMyPageSummary,
      },
      {
        queryKey: myPagePostsQueryKey,
        queryFn: getMyPagePosts,
      },
      {
        queryKey: myPageCommentsQueryKey,
        queryFn: getMyPageComments,
      },
    ],
  });

  const updateProfileMutation = useMutation<
    MyPageSummary | null,
    ApiError,
    MyPageProfileUpdateRequest,
    UpdateContext
  >({
    mutationFn: updateMyPageProfile,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: myPageSummaryQueryKey });
      const previousSummary = queryClient.getQueryData<MyPageSummary>(
        myPageSummaryQueryKey,
      );

      if (previousSummary) {
        queryClient.setQueryData(
          myPageSummaryQueryKey,
          patchSummaryWithProfile(previousSummary, payload),
        );
      }

      return { previousSummary };
    },
    onError: (error, _payload, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(myPageSummaryQueryKey, context.previousSummary);
      }
      showErrorToast(
        error,
        "프로필 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
    onSuccess: (updatedSummary, payload) => {
      if (updatedSummary) {
        queryClient.setQueryData(myPageSummaryQueryKey, updatedSummary);
        return;
      }

      queryClient.setQueryData<MyPageSummary>(
        myPageSummaryQueryKey,
        (current) => (current ? patchSummaryWithProfile(current, payload) : current),
      );
    },
  });

  return {
    summary: (summaryQuery.data ?? null) as MyPageSummary | null,
    posts: (postsQuery.data ?? []) as MyPagePostItem[],
    comments: (commentsQuery.data ?? []) as MyPageCommentItem[],
    isLoading:
      summaryQuery.isLoading || postsQuery.isLoading || commentsQuery.isLoading,
    isFetching:
      summaryQuery.isFetching || postsQuery.isFetching || commentsQuery.isFetching,
    isError: Boolean(summaryQuery.error || postsQuery.error || commentsQuery.error),
    errors: {
      summary: summaryQuery.error as ApiError | null,
      posts: postsQuery.error as ApiError | null,
      comments: commentsQuery.error as ApiError | null,
    },
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
  };
}
