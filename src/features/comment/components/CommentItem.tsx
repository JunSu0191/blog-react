import { useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  CornerDownRight,
  EllipsisVertical,
  Lock,
  LogIn,
  Trash2,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { ActionDialog, Button, UserAvatar } from "@/shared/ui";
import useActionDialog from "@/shared/hooks/useActionDialog";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { isUnauthorizedError } from "@/shared/lib/api";
import { resolveDisplayName } from "@/shared/lib/displayName";
import { CommentReactionButtons } from "@/features/social";
import { useCommentReplies, useDeleteComment, useUpdateComment } from "../queries";
import type { CommentResponse } from "../api";
import CommentForm from "./CommentForm";

interface CommentItemProps {
  comment: CommentResponse;
  currentUserId?: number;
  depth?: number;
  presentation?: "default" | "sheet";
  onMobileReply?: (comment: CommentResponse) => void;
  onMobileEdit?: (comment: CommentResponse) => void;
}

const formatDateTime = (raw: string) =>
  new Date(raw).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function RepliesSkeleton() {
  return (
    <div className="mt-3 space-y-2 border-l border-slate-200 pl-3 dark:border-slate-700">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/70"
        >
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

export default function CommentItem({
  comment,
  currentUserId,
  depth = 0,
  presentation = "default",
  onMobileReply,
  onMobileEdit,
}: CommentItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const isAuthenticated = Boolean(user);
  const isSheetPresentation = presentation === "sheet";
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isRepliesOpen, setIsRepliesOpen] = useState(false);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const noticeDialog = useActionDialog({ defaultTitle: "안내" });
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();
  const repliesQuery = useCommentReplies(comment.id, { enabled: isRepliesOpen });
  const currentPathWithSearchHash = `${location.pathname}${location.search}${location.hash}`;
  const isOwner =
    typeof currentUserId === "number" && currentUserId === comment.userId;
  const isReply = depth > 0;
  const authorName = resolveDisplayName(comment, "익명");
  const authorUsername = comment.username?.trim() || "";
  const authorBlogPath = authorUsername
    ? `/${encodeURIComponent(authorUsername)}`
    : null;
  const loadedReplies = repliesQuery.data || [];
  const isMobileViewport =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 1023px)").matches;

  const handleUpdate = async () => {
    if (!editContent.trim()) {
      noticeDialog.show("댓글 내용을 입력해주세요.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: comment.id,
        postId: comment.postId,
        parentId: comment.parentId,
        req: { content: editContent },
      });
      setIsEditing(false);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setIsLoginDialogOpen(true);
        return;
      }
      noticeDialog.show("댓글 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteMutation.mutateAsync({
        id: comment.id,
        postId: comment.postId,
        parentId: comment.parentId,
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setIsLoginDialogOpen(true);
        return;
      }
      noticeDialog.show("댓글 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const triggerReply = () => {
    if (!isAuthenticated) {
      setIsLoginDialogOpen(true);
      return;
    }

    if (isSheetPresentation && onMobileReply) {
      onMobileReply(comment);
      return;
    }

    setIsReplying((prev) => !prev);
  };

  const triggerEdit = () => {
    if (isSheetPresentation && onMobileEdit) {
      onMobileEdit(comment);
      return;
    }

    setEditContent(comment.content);
    setIsEditing(true);
  };

  const actionMenu = isOwner && !isEditing ? (
    isMobileViewport ? (
      <>
        <button
          type="button"
          onClick={() => setIsActionSheetOpen(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="댓글 메뉴"
        >
          <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        {typeof document !== "undefined"
          ? createPortal(
              <div
                className={[
                  "fixed inset-0 z-[220]",
                  isActionSheetOpen ? "pointer-events-auto" : "pointer-events-none",
                ].join(" ")}
                aria-hidden={!isActionSheetOpen}
              >
                <button
                  type="button"
                  className={[
                    "absolute inset-0 bg-slate-950/45 transition-opacity duration-200",
                    isActionSheetOpen ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                  onClick={() => setIsActionSheetOpen(false)}
                  aria-label="댓글 메뉴 닫기"
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="댓글 메뉴"
                  className={[
                    "absolute inset-x-0 bottom-0 rounded-t-3xl border border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900",
                    isActionSheetOpen ? "translate-y-0" : "translate-y-full",
                  ].join(" ")}
                >
                  <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionSheetOpen(false);
                        triggerEdit();
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionSheetOpen(false);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300 dark:hover:bg-rose-950/55"
                    >
                      삭제
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActionSheetOpen(false)}
                    className="mt-3 flex w-full items-center justify-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    닫기
                  </button>
                </div>
              </div>,
              document.body,
            )
          : null}
      </>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="댓글 메뉴"
          >
            <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-32">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              triggerEdit();
            }}
          >
            수정
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
            onSelect={(event) => {
              event.preventDefault();
              setIsDeleteDialogOpen(true);
            }}
          >
            삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  ) : null;

  return (
    <div className={["py-3 sm:py-4", isReply ? "pl-1" : ""].join(" ")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2.5 sm:gap-3">
          <UserAvatar
            name={authorName}
            imageUrl={comment.avatarUrl}
            alt={`${authorName} 아바타`}
            className={isReply ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"}
            fallbackClassName="text-inherit font-bold"
          />
          <div className="min-w-0">
            {authorBlogPath ? (
              <Link
                to={authorBlogPath}
                className="truncate text-sm font-bold text-slate-900 hover:underline dark:text-slate-100"
              >
                {authorName}
              </Link>
            ) : (
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {authorName}
              </p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatDateTime(comment.createdAt)}</span>
              {isReply ? (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  답글
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 pt-0.5">{actionMenu}</div>
      </div>

      {isEditing ? (
        <div className="mt-3 space-y-2.5">
          <textarea
            value={editContent}
            onChange={(event) => setEditContent(event.target.value)}
            rows={3}
            disabled={updateMutation.isPending}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-3"
          />
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <Button
              type="button"
              size="sm"
              isLoading={updateMutation.isPending}
              onClick={handleUpdate}
              className="h-8 rounded-lg bg-blue-600 px-2.5 text-xs text-white hover:bg-blue-700 sm:h-9 sm:px-3 sm:text-sm"
            >
              수정 완료
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setIsEditing(false);
                setEditContent(comment.content);
              }}
              disabled={updateMutation.isPending}
              className="h-8 rounded-lg px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
          {comment.content}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <CommentReactionButtons
          commentId={comment.id}
          postId={comment.postId}
          initialLikeCount={comment.likeCount}
          initialDislikeCount={comment.dislikeCount}
          initialMyReaction={comment.myReaction}
        />
        {depth < 1 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onTouchStart={(event) => {
              event.stopPropagation();
            }}
            onClick={triggerReply}
            className="touch-manipulation gap-1 rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
            답글
          </Button>
        ) : null}
        {depth < 1 && comment.replyCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsRepliesOpen((prev) => !prev)}
            className="gap-1 rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronDown
              className={[
                "h-3.5 w-3.5 transition-transform",
                isRepliesOpen ? "rotate-180" : "",
              ].join(" ")}
            />
            {isRepliesOpen
              ? "답글 숨기기"
              : `답글 ${comment.replyCount.toLocaleString()}개 보기`}
          </Button>
        ) : null}
      </div>

      {isReplying && depth < 1 && !isSheetPresentation ? (
        <div className="mt-3">
          <CommentForm
            postId={comment.postId}
            parentId={comment.id}
            compact
            onSubmitted={() => setIsReplying(false)}
            onCancel={() => setIsReplying(false)}
          />
        </div>
      ) : null}

      {depth < 1 && isRepliesOpen ? (
        repliesQuery.isLoading ? (
          <RepliesSkeleton />
        ) : (
          <div className="mt-3 divide-y divide-slate-200 border-l border-slate-200 pl-2.5 dark:divide-slate-800 dark:border-slate-700 sm:mt-4 sm:pl-4">
            {loadedReplies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                depth={depth + 1}
                presentation={presentation}
                onMobileReply={onMobileReply}
                onMobileEdit={onMobileEdit}
              />
            ))}
          </div>
        )
      ) : null}

      <ActionDialog
        open={isDeleteDialogOpen}
        icon={<Trash2 className="h-5 w-5" aria-hidden="true" />}
        title="댓글 삭제"
        content="댓글을 삭제하면 복구할 수 없습니다."
        cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
        confirmIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
        iconWrapperClassName="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
        cancelText="취소"
        confirmText={deleteMutation.isPending ? "삭제 중..." : "삭제"}
        confirmDisabled={deleteMutation.isPending}
        cancelDisabled={deleteMutation.isPending}
        preventAutoCloseOnConfirm
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
        onOpenChange={(open) => {
          if (deleteMutation.isPending) return;
          setIsDeleteDialogOpen(open);
        }}
        confirmClassName="bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200"
        cancelClassName="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        footerClassName="gap-2 sm:space-x-0"
      />

      <ActionDialog {...noticeDialog.dialogProps} />

      <ActionDialog
        open={isLoginDialogOpen}
        onOpenChange={setIsLoginDialogOpen}
        icon={<Lock className="h-5 w-5" aria-hidden="true" />}
        title="로그인이 필요합니다"
        description="로그인 페이지로 이동하시겠습니까?"
        cancelIcon={<X className="h-4 w-4" aria-hidden="true" />}
        confirmIcon={<LogIn className="h-4 w-4" aria-hidden="true" />}
        cancelText="나중에 로그인하기"
        confirmText="로그인 페이지 이동"
        onConfirm={() => {
          navigate("/login", { state: currentPathWithSearchHash });
        }}
      />
    </div>
  );
}
