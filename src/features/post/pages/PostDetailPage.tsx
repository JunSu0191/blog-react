import { Link, useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, ChevronDown, Link2, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { ActionDialog, Button, TagChip } from '@/shared/ui';
import { useAuthContext } from '@/shared/context/useAuthContext';
import { useThemeContext } from '@/shared/context/ThemeProvider';
import { cn } from '@/shared/lib/cn';
import { parseErrorMessage } from '@/shared/lib/errorParser';
import {
  bottomSheetHeaderClassName,
  bottomSheetOverlayClassName,
  bottomSheetPanelClassName,
} from '@/shared/ui/bottomSheetStyles';
import { useToast } from '@/shared/ui/ToastProvider';
import { CommentList } from '@/features/comment';
import type { CommentResponse } from '@/features/comment/api';
import { useComments } from '@/features/comment/queries';
import { PostLikeButton } from '@/features/social';
import { useDeletePost, usePostDetail, useRelatedPosts } from '../queries';
import { readBookmarkedPostIds, writeBookmarkedPostIds } from '../utils/bookmarkStorage';
import {
  estimateReadTimeMinutes,
  extractTocFromHtml,
  injectHeadingIds,
  resolvePostPath,
  sanitizeHtml,
} from '../utils/postContent';

function formatDate(value?: string) {
  if (!value) return '날짜 정보 없음';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '날짜 정보 없음';

  return parsed.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function countTotalComments(comments: CommentResponse[]) {
  let total = 0;

  const visit = (node: CommentResponse) => {
    total += 1;
    (node.replies || []).forEach(visit);
  };

  comments.forEach(visit);
  return total;
}

function summarizePost(contentHtml: string, subtitle?: string) {
  const preferred = subtitle?.trim();
  if (preferred) return preferred;

  return contentHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

export default function PostDetailPage() {
  const navigate = useNavigate();
  const {user} = useAuthContext();
  const {theme} = useThemeContext();
  const {success, error} = useToast();
  const params = useParams<{ postId?: string }>();
  const rawPostId = Number(params.postId);
  const postId =
    Number.isFinite(rawPostId) && rawPostId > 0 ? rawPostId : undefined;

  const postDetailQuery = usePostDetail(postId ?? 0, {
    enabled: typeof postId === 'number',
  });
  const relatedPostsQuery = useRelatedPosts(postId ?? 0, 4, {
    enabled: typeof postId === 'number',
  });
  const commentsQuery = useComments(postId ?? 0, {
    enabled: typeof postId === 'number',
  });
  const deletePostMutation = useDeletePost();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDesktopCommentOpen, setIsDesktopCommentOpen] = useState(true);
  const [isMobileCommentSheetMounted, setIsMobileCommentSheetMounted] = useState(false);
  const [isMobileCommentSheetActive, setIsMobileCommentSheetActive] = useState(false);
  const [isMobileSheetDragging, setIsMobileSheetDragging] = useState(false);
  const [mobileSheetDragY, setMobileSheetDragY] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const closeSheetTimerRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);

  const post = postDetailQuery.data;
  const commentCount = useMemo(
    () => countTotalComments(commentsQuery.data || []),
    [commentsQuery.data],
  );
  const commentSheetTransitionMs = 280;
  const postSummary = useMemo(
    () => summarizePost(post?.contentHtml || '', post?.subtitle),
    [post?.contentHtml, post?.subtitle],
  );

  const contentHtmlWithHeadingIds = useMemo(() => {
    if (!post) return '';
    return injectHeadingIds(post.contentHtml);
  }, [post]);

  const safeHtml = useMemo(() => {
    if (!contentHtmlWithHeadingIds) return '';
    return sanitizeHtml(contentHtmlWithHeadingIds);
  }, [contentHtmlWithHeadingIds]);

  const toc = useMemo(() => {
    if (!contentHtmlWithHeadingIds) return [];
    return extractTocFromHtml(contentHtmlWithHeadingIds);
  }, [contentHtmlWithHeadingIds]);

  const readTimeMinutes = useMemo(() => {
    if (!post) return 1;
    return post.readTimeMinutes || estimateReadTimeMinutes(post.contentHtml);
  }, [post]);

  const previousPost = post?.previousPost || null;
  const nextPost = post?.nextPost || null;
  const authorName =
    post?.author?.nickname ||
    post?.author?.name ||
    post?.author?.username ||
    '익명';
  const authorUsername = post?.author?.username?.trim() || '';
  const authorBlogPath = authorUsername
    ? `/${encodeURIComponent(authorUsername)}`
    : null;
  const authorId = post?.author?.id;
  const hasAuthorId =
    typeof authorId === 'number' && Number.isFinite(authorId);
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const isAuthor =
    typeof user?.id === 'number' &&
    hasAuthorId &&
    user.id === authorId;
  const canManagePost = Boolean(user) && (isAdmin || isAuthor);

  const openMobileCommentSheet = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (closeSheetTimerRef.current !== null) {
      window.clearTimeout(closeSheetTimerRef.current);
      closeSheetTimerRef.current = null;
    }
    setIsMobileCommentSheetMounted(true);
    setIsMobileCommentSheetActive(false);
    setIsMobileSheetDragging(false);
    setMobileSheetDragY(0);
    window.requestAnimationFrame(() => {
      setIsMobileCommentSheetActive(true);
    });
  }, []);

  const closeMobileCommentSheet = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!isMobileCommentSheetMounted) return;

    setIsMobileCommentSheetActive(false);
    setIsMobileSheetDragging(false);
    setMobileSheetDragY(0);
    dragStartYRef.current = null;
    dragDistanceRef.current = 0;

    if (closeSheetTimerRef.current !== null) {
      window.clearTimeout(closeSheetTimerRef.current);
    }
    closeSheetTimerRef.current = window.setTimeout(() => {
      setIsMobileCommentSheetMounted(false);
      closeSheetTimerRef.current = null;
    }, commentSheetTransitionMs);
  }, [commentSheetTransitionMs, isMobileCommentSheetMounted]);

  useEffect(() => {
    return () => {
      if (closeSheetTimerRef.current !== null) {
        window.clearTimeout(closeSheetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof postId !== 'number') return;
    setIsBookmarked(new Set(readBookmarkedPostIds()).has(postId));
  }, [postId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isMobileCommentSheetMounted) return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [isMobileCommentSheetMounted]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isMobileCommentSheetMounted) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileCommentSheet();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMobileCommentSheet, isMobileCommentSheetMounted]);

  if (typeof postId !== 'number') {
    return (
      <div
        className='route-enter rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/30'>
        <h2 className='text-xl font-black text-rose-700 dark:text-rose-200'>
          유효하지 않은 접근입니다.
        </h2>
        <p className='mt-2 text-sm text-rose-600 dark:text-rose-300'>
          게시글 주소를 다시 확인해 주세요.
        </p>
      </div>
    );
  }

  if (postDetailQuery.isLoading) {
    return (
      <div className='route-enter flex min-h-[60vh] items-center justify-center'>
        <div className='h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600'/>
      </div>
    );
  }

  if (postDetailQuery.error || !post) {
    return (
      <div
        className='route-enter rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/30'>
        <h2 className='text-xl font-black text-rose-700 dark:text-rose-200'>
          게시글을 찾을 수 없습니다.
        </h2>
        <p className='mt-2 text-sm text-rose-600 dark:text-rose-300'>
          {postDetailQuery.error?.message || '이미 삭제되었거나 존재하지 않는 글입니다.'}
        </p>
        <Link to='/posts' className='mt-4 inline-flex'>
          <Button>목록으로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  const handleDeletePost = async () => {
    try {
      await deletePostMutation.mutateAsync(post.id);
      success('게시글을 삭제했습니다.');
      navigate('/posts', {replace: true});
    } catch (deleteError) {
      error(parseErrorMessage(deleteError, '게시글 삭제에 실패했습니다.'));
    }
  };

  const handleBookmarkToggle = () => {
    if (typeof postId !== 'number') return;

    const bookmarkedPosts = new Set(readBookmarkedPostIds());
    const next = new Set(bookmarkedPosts);

    if (next.has(postId)) {
      next.delete(postId);
      setIsBookmarked(false);
      success('저장한 글에서 제거했습니다.');
    } else {
      next.add(postId);
      setIsBookmarked(true);
      success('저장한 글에 추가했습니다.');
    }

    writeBookmarkedPostIds([...next]);
  };

  const handleSharePost = async () => {
    if (typeof window === 'undefined') return;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: post.title,
          text: postSummary,
          url: window.location.href,
        });
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      success('게시글 링크를 복사했습니다.');
    } catch {
      error('공유에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const mobileCommentSheet =
    isMobileCommentSheetMounted && typeof document !== 'undefined'
        ? createPortal(
          <div className={cn('fixed inset-0 z-[170] bg-transparent lg:hidden', theme === 'dark' && 'dark')}>
            <button
              type='button'
              aria-label='댓글 모달 닫기'
              className={[
                `absolute inset-0 appearance-none transition-opacity duration-300 ${bottomSheetOverlayClassName}`,
                isMobileCommentSheetActive ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              onClick={closeMobileCommentSheet}
            />
            <div className='absolute inset-x-0 bottom-0'>
              <div
                className={cn(
                  'relative max-h-[80dvh] w-full overflow-hidden',
                  bottomSheetPanelClassName,
                  theme === 'dark'
                    ? 'border-slate-700/80 bg-slate-950/94'
                    : 'border-slate-200/80 bg-white/95',
                  isMobileSheetDragging
                    ? ''
                    : 'transition-transform ease-out',
                )}
                style={{
                  transform: `translateY(${isMobileCommentSheetActive ? mobileSheetDragY : 640}px)`,
                  transitionDuration: isMobileSheetDragging
                    ? '0ms'
                    : `${commentSheetTransitionMs}ms`,
                }}
              >
                <div
                  className={cn(
                    'touch-none rounded-t-[28px] px-4 pt-2',
                    bottomSheetHeaderClassName,
                    theme === 'dark'
                      ? 'border-slate-700/80 bg-slate-950/90'
                      : 'border-slate-200/80 bg-white/92',
                  )}
                  onTouchStart={(event) => {
                    if (event.touches.length !== 1) return;
                    dragStartYRef.current = event.touches[0].clientY;
                    dragDistanceRef.current = 0;
                    setIsMobileSheetDragging(true);
                  }}
                  onTouchMove={(event) => {
                    if (dragStartYRef.current === null) return;
                    const delta = event.touches[0].clientY - dragStartYRef.current;
                    const next = Math.max(0, delta);
                    dragDistanceRef.current = next;
                    setMobileSheetDragY(next);
                  }}
                  onTouchEnd={() => {
                    if (dragStartYRef.current === null) return;
                    const shouldClose = dragDistanceRef.current > 96;
                    dragStartYRef.current = null;
                    dragDistanceRef.current = 0;
                    setIsMobileSheetDragging(false);
                    if (shouldClose) {
                      closeMobileCommentSheet();
                      return;
                    }
                    setMobileSheetDragY(0);
                  }}
                  onTouchCancel={() => {
                    dragStartYRef.current = null;
                    dragDistanceRef.current = 0;
                    setIsMobileSheetDragging(false);
                    setMobileSheetDragY(0);
                  }}
                >
                  <div className='mx-auto h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600' />
                </div>
                <header
                  className={cn(
                    'sticky top-0 z-10 flex items-center justify-between px-4 py-3',
                    bottomSheetHeaderClassName,
                    'border-0',
                    theme === 'dark' ? 'bg-slate-950/90' : 'bg-white/92',
                  )}>
                  <h2 className='text-sm font-black text-slate-900 dark:text-slate-100'>
                    댓글
                  </h2>
                  <button
                    type='button'
                    className='rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                    onClick={closeMobileCommentSheet}
                  >
                    닫기
                  </button>
                </header>
                <div
                  className={cn(
                    'h-[calc(85dvh-3.4rem)] overflow-y-auto overscroll-contain p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]',
                    theme === 'dark' ? 'bg-slate-950' : 'bg-white',
                  )}>
                  <CommentList postId={post.id}/>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className='route-enter relative space-y-6'>
      <header
        className='overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl'>
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            className='h-48 w-full object-cover sm:h-72'
          />
        ) : (
          <div
            className='flex h-48 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-semibold text-slate-500 dark:from-slate-900 dark:to-slate-800 dark:text-slate-400 sm:h-72'>
            COVER IMAGE
          </div>
        )}

        <div className='p-4 sm:p-8'>
          <div className='mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400'>
            <Link to='/posts' className='hover:text-blue-700 dark:hover:text-blue-300'>
              Blog Pause
            </Link>
            <span>/</span>
            <span>{post.category?.name || '미분류'}</span>
          </div>

          <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400'>
            <span>{post.category?.name || '미분류'}</span>
            <span>·</span>
            <span>{formatDate(post.publishedAt || post.createdAt)}</span>
            <span>·</span>
            <span>{readTimeMinutes}분 읽기</span>
          </div>

          <h1 className='mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl'>
            {post.title}
          </h1>

          {post.subtitle ? (
            <p className='mt-3 text-base text-slate-600 dark:text-slate-300 sm:text-lg'>
              {post.subtitle}
            </p>
          ) : null}

          <div
            className='mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40 sm:flex-row sm:items-center sm:justify-between sm:py-2.5'>
            <div className='flex min-w-0 items-center gap-2'>
              <span
                className='flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200'>
                {authorName.slice(0, 1)}
              </span>
              <div className='min-w-0'>
                <p className='truncate text-xs text-slate-500 dark:text-slate-400'>
                  작성자
                </p>
                {authorBlogPath ? (
                  <Link
                    to={authorBlogPath}
                    className='truncate text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100'
                  >
                    {authorName}
                  </Link>
                ) : (
                  <p className='truncate text-sm font-semibold text-slate-800 dark:text-slate-100'>
                    {authorName}
                  </p>
                )}
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300'>
              <span
                className='rounded-full border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900'>
                조회 {post.viewCount.toLocaleString()}
              </span>
              <span
                className='rounded-full border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900'>
                좋아요 {post.likeCount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className='mt-5 space-y-2 sm:space-y-0'>
            <div className='lg:hidden'>
              <PostLikeButton postId={post.id} initialLikeCount={post.likeCount}/>
            </div>
            <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center'>
              <Button type='button' variant='outline' className='w-full justify-center sm:w-auto' onClick={handleBookmarkToggle}>
                {isBookmarked ? <BookmarkCheck className='h-4 w-4'/> : <Bookmark className='h-4 w-4'/>}
                {isBookmarked ? '저장됨' : '저장'}
              </Button>
              <Button type='button' variant='outline' className='w-full justify-center sm:w-auto' onClick={() => void handleSharePost()}>
                <Send className='h-4 w-4'/>
                공유
              </Button>
              {canManagePost ? (
                <Link to={`${resolvePostPath(post.id)}/edit`} className='w-full sm:w-auto'>
                  <Button type='button' variant='outline' className='w-full justify-center sm:w-auto'>
                    수정
                  </Button>
                </Link>
              ) : null}
              {canManagePost ? (
                <Button
                  type='button'
                  variant='outline'
                  className='w-full justify-center sm:w-auto'
                  disabled={deletePostMutation.isPending}
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  삭제
                </Button>
              ) : null}
              <Button
                type='button'
                variant='outline'
                className='w-full justify-center sm:w-auto'
                onClick={() => {
                  void navigator.clipboard.writeText(window.location.href).then(() => {
                    success('게시글 링크를 복사했습니다.');
                  }).catch(() => {
                    error('링크 복사에 실패했습니다.');
                  });
                }}
              >
                <Link2 className='h-4 w-4'/>
                링크 복사
              </Button>
              <Link to='/posts' className='w-full sm:w-auto'>
                <Button type='button' variant='ghost' className='w-full justify-center sm:w-auto'>
                  목록
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className='grid gap-6 lg:items-start lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]'>
        <article
          className='min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8'>
          <div className='mx-auto w-full max-w-3xl'>
            <div
              className='toss-editor-content prose prose-slate max-w-none [&_h1]:scroll-mt-24 [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24 dark:prose-invert'>
              <div dangerouslySetInnerHTML={{__html: safeHtml}}/>
            </div>

            <section className='mt-10 space-y-4 border-t border-slate-200 pt-6 dark:border-slate-700'>
              {post.tags.length > 0 ? (
                <div className='flex flex-wrap gap-2'>
                  {post.tags.map((tag) => (
                    <Link
                      key={`${post.id}-${tag.id ?? tag.name}`}
                      to={`/tags/${encodeURIComponent(tag.name)}`}
                    >
                      <TagChip
                        label={tag.name}
                        className='text-xs'
                      />
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className='space-y-4'>
                <div className='flex flex-wrap items-center gap-2'>
                  <PostLikeButton postId={post.id} initialLikeCount={post.likeCount}/>

                  <button
                    type='button'
                    onClick={() => setIsDesktopCommentOpen((prev) => !prev)}
                    className='hidden lg:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                  >
                    <MessageCircle className='h-4 w-4'/>
                    <span>댓글</span>
                    <span className='tabular-nums text-slate-500 dark:text-slate-300'>
                      {commentCount.toLocaleString()}
                    </span>
                    <span className='inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700'>
                      <ChevronDown
                        className={[
                          'h-3.5 w-3.5 transition-transform duration-200',
                          isDesktopCommentOpen ? 'rotate-180' : '',
                        ].join(' ')}
                      />
                    </span>
                  </button>

                  <button
                    type='button'
                    onClick={() => {
                      if (isMobileCommentSheetMounted) {
                        closeMobileCommentSheet();
                        return;
                      }
                      openMobileCommentSheet();
                    }}
                    className='inline-flex lg:hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                  >
                    <MessageCircle className='h-4 w-4'/>
                    <span>댓글</span>
                    <span className='tabular-nums text-slate-500 dark:text-slate-300'>
                      {commentCount.toLocaleString()}
                    </span>
                    <span className='inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700'>
                      <ChevronDown
                        className={[
                          'h-3.5 w-3.5 transition-transform duration-200',
                          isMobileCommentSheetMounted && isMobileCommentSheetActive
                            ? 'rotate-180'
                            : '',
                        ].join(' ')}
                      />
                    </span>
                  </button>
                </div>

                {isDesktopCommentOpen ? (
                  <section id='comments-section' className='hidden lg:block'>
                    <h2 className='text-xl font-black text-slate-900 dark:text-slate-100'>댓글</h2>
                    <div className='mt-4'>
                      <CommentList postId={post.id}/>
                    </div>
                  </section>
	                ) : null}
	              </div>
	            </section>

	            {(previousPost || nextPost) && (
	              <section className='mt-10 grid gap-3 border-t border-slate-200 pt-6 dark:border-slate-700 sm:grid-cols-2'>
	                <div>
	                  <p className='text-xs font-semibold text-slate-500 dark:text-slate-400'>
	                    이전 글
	                  </p>
	                  {previousPost ? (
	                    <Link
	                      to={resolvePostPath(previousPost.id)}
	                      className='mt-1 inline-block text-sm font-semibold text-slate-800 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300'
	                    >
	                      {previousPost.title}
	                    </Link>
	                  ) : (
	                    <p className='mt-1 text-sm text-slate-400'>이전 글이 없습니다.</p>
	                  )}
	                </div>
	                <div className='sm:text-right'>
	                  <p className='text-xs font-semibold text-slate-500 dark:text-slate-400'>
	                    다음 글
	                  </p>
	                  {nextPost ? (
	                    <Link
	                      to={resolvePostPath(nextPost.id)}
	                      className='mt-1 inline-block text-sm font-semibold text-slate-800 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300'
	                    >
	                      {nextPost.title}
	                    </Link>
	                  ) : (
	                    <p className='mt-1 text-sm text-slate-400'>다음 글이 없습니다.</p>
	                  )}
	                </div>
	              </section>
	            )}

              <section className='mt-10 border-t border-slate-200 pt-6 dark:border-slate-700'>
                <h2 className='text-xl font-black text-slate-900 dark:text-slate-100'>
                  관련 글
                </h2>

                {relatedPostsQuery.isLoading ? (
                  <p className='mt-3 text-sm text-slate-500 dark:text-slate-400'>불러오는 중...</p>
                ) : (relatedPostsQuery.data || []).length === 0 ? (
                  <p className='mt-3 text-sm text-slate-500 dark:text-slate-400'>
                    관련 글이 없습니다.
                  </p>
                ) : (
                  <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                    {(relatedPostsQuery.data || []).map((relatedPost) => (
                      <Link
                        key={relatedPost.id}
                        to={resolvePostPath(relatedPost.id)}
                        className='block rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/20'
                      >
                        <p className='line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100'>
                          {relatedPost.title}
                        </p>
                        {relatedPost.subtitle ? (
                          <p className='mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400'>
                            {relatedPost.subtitle}
                          </p>
                        ) : null}
                        <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>
                          {relatedPost.category?.name || '미분류'} · {relatedPost.readTimeMinutes}분 읽기
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
	          </div>
	        </article>

        <aside className='space-y-4 lg:sticky lg:top-20 lg:self-start'>
          <section
            className='rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:h-[calc(100vh-6rem)] lg:max-h-[calc(100vh-6rem)] lg:overflow-hidden'>
            <div className='flex h-full min-h-0 flex-col'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <h2 className='text-sm font-bold text-slate-800 dark:text-slate-100'>
                    목차
                  </h2>
                  <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>
                    긴 글에서도 빠르게 이동할 수 있습니다.
                  </p>
                </div>
                <span className='inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'>
                  {toc.length}개 헤더
                </span>
              </div>

              {toc.length === 0 ? (
                <p className='mt-3 text-xs text-slate-500 dark:text-slate-400'>
                  목차를 표시할 헤더가 없습니다.
                </p>
              ) : (
                <nav className='mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1'>
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={[
                        'block rounded-xl px-3 py-2 text-[13px] leading-5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                        item.level === 2 ? 'pl-5' : '',
                        item.level === 3 ? 'pl-7' : '',
                      ].join(' ')}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              )}
            </div>
          </section>
        </aside>
      </div>

      <ActionDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        icon={<Trash2 className='h-5 w-5' aria-hidden='true'/>}
        title='게시글 삭제'
        content='게시글을 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?'
        cancelIcon={<X className='h-4 w-4' aria-hidden='true'/>}
        confirmIcon={<Trash2 className='h-4 w-4' aria-hidden='true'/>}
        iconWrapperClassName='bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
        confirmText={deletePostMutation.isPending ? '삭제 중...' : '삭제'}
        cancelText='취소'
        confirmDisabled={deletePostMutation.isPending}
        cancelDisabled={deletePostMutation.isPending}
        onConfirm={() => {
          void handleDeletePost();
        }}
        confirmClassName='bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200'
        cancelClassName='border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
        footerClassName='gap-2 sm:space-x-0'
      />

      {mobileCommentSheet}
    </div>
  );
}
