import {
  Suspense,
  useCallback,
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActionDialog, Button, Input, Select } from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import HashtagInput from "../components/HashtagInput";
import { getPostDraft, uploadPostImage } from "../api";
import {
  useDeletePostDraft,
  usePatchPost,
  usePostCategories,
  usePostDetail,
  usePostDrafts,
  usePublishPost,
  useSavePostDraft,
} from "../queries";
import { ComposeMode } from "../types/enums";
import type { ComposeMode as ComposeModeType } from "../types/enums";
import type { PostComposerFormValues } from "../types/form";
import {
  parseTagText,
  resolvePostPath,
  sanitizeHtml,
  stripHtml,
  stringifyTags,
} from "../utils/postContent";

const ThumbnailMode = {
  AUTO_FROM_CONTENT: "auto_from_content",
  MANUAL_UPLOAD: "manual_upload",
} as const;

type ThumbnailMode = (typeof ThumbnailMode)[keyof typeof ThumbnailMode];

const INITIAL_FORM_VALUES: PostComposerFormValues = {
  title: "",
  subtitle: "",
  category: "",
  tagsText: "",
  thumbnailUrl: "",
  contentHtml: "",
  contentJson: undefined,
};

const AUTOSAVE_DEBOUNCE_MS = 8000;
const BlogEditor = lazy(() => import("../components/editor/BlogEditor"));

function normalizeDisplayText(value: unknown) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = trimmed.toLocaleLowerCase();
  if (normalized === "undefined" || normalized === "null") {
    return "";
  }

  return trimmed;
}

function extractFirstImageUrlFromHtml(html: string) {
  if (!html.trim()) return "";
  const matched = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
  const raw = matched?.[1];
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeTagToken(value: string) {
  return value
    .replace(/^#+/, "")
    .replace(/[#,]+$/g, "")
    .trim();
}

function tokenizeTagInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  return trimmed
    .split(",")
    .map(normalizeTagToken)
    .filter((token) => token.length > 0);
}

function hasMeaningfulHtml(rawHtml: string) {
  if (!rawHtml.trim()) return false;

  const compact = rawHtml
    .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/\u00a0/g, " ")
    .trim();

  return compact.length > 0;
}

function toErrorMessage(error: unknown) {
  const status = getErrorStatus(error);
  if (status === 409) {
    return "요청이 충돌했습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message =
      typeof record.message === "string" ? record.message.trim() : "";
    if (message.length > 0) {
      if (/slugㅜ/i.test(message)) {
        return "제목에 한글/영문/숫자를 1자 이상 포함해 주세요.";
      }
      return message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

function normalizeTitleForPublish(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function hasSlugConvertibleChar(value: string) {
  return /[a-zA-Z0-9가-힣]/.test(value);
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  const status = record.status;
  if (typeof status === "number" && Number.isFinite(status)) return status;
  if (typeof status === "string") {
    const parsed = Number(status);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function EditorLoader() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
        에디터 준비 중...
      </div>
    </div>
  );
}

export default function CreatePostPage() {
  const params = useParams<{ postId?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { success, error: showError } = useToast();
  const rawPostId = Number(params.postId);
  const editingPostId =
    Number.isFinite(rawPostId) && rawPostId > 0 ? rawPostId : undefined;
  const isEditMode = typeof editingPostId === "number";

  const [formValues, setFormValues] =
    useState<PostComposerFormValues>(INITIAL_FORM_VALUES);
  const [composeMode, setComposeMode] = useState<ComposeModeType>(
    ComposeMode.WRITE,
  );
  const [thumbnailMode, setThumbnailMode] = useState<ThumbnailMode>(
    ThumbnailMode.AUTO_FROM_CONTENT,
  );
  const [activeDraftId, setActiveDraftId] = useState<number | undefined>(
    undefined,
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isFocusComposeOpen, setIsFocusComposeOpen] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const latestSavedFingerprintRef = useRef<string>("");
  const editInitialFingerprintRef = useRef<string>("");
  const autosaveTimerRef = useRef<number | null>(null);
  const initializedEditPostIdRef = useRef<number | null>(null);

  const categoriesQuery = usePostCategories();
  const editTargetQuery = usePostDetail(editingPostId ?? 0, {
    enabled: isEditMode,
  });
  const draftsQuery = usePostDrafts();
  const saveDraftMutation = useSavePostDraft();
  const deleteDraftMutation = useDeletePostDraft();
  const publishMutation = usePublishPost();
  const patchMutation = usePatchPost();

  const draftItems = draftsQuery.data || [];
  const parsedTags = useMemo(
    () => parseTagText(formValues.tagsText),
    [formValues.tagsText],
  );
  const plainText = useMemo(
    () => stripHtml(formValues.contentHtml),
    [formValues.contentHtml],
  );
  const hasBodyContent = useMemo(
    () => plainText.trim().length > 0 || hasMeaningfulHtml(formValues.contentHtml),
    [formValues.contentHtml, plainText],
  );
  const safePreviewHtml = useMemo(
    () => sanitizeHtml(formValues.contentHtml),
    [formValues.contentHtml],
  );

  const firstImageThumbnailUrl = useMemo(
    () => extractFirstImageUrlFromHtml(formValues.contentHtml),
    [formValues.contentHtml],
  );

  const effectiveThumbnailUrl = useMemo(() => {
    if (thumbnailMode === ThumbnailMode.MANUAL_UPLOAD) {
      return formValues.thumbnailUrl.trim();
    }
    return firstImageThumbnailUrl;
  }, [firstImageThumbnailUrl, formValues.thumbnailUrl, thumbnailMode]);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        title: normalizeDisplayText(formValues.title),
        subtitle: normalizeDisplayText(formValues.subtitle),
        category: normalizeDisplayText(formValues.category),
        tags: parsedTags,
        thumbnailMode,
        thumbnailUrl: formValues.thumbnailUrl.trim(),
        contentHtml: formValues.contentHtml.trim(),
      }),
    [
      formValues.category,
      formValues.contentHtml,
      formValues.subtitle,
      formValues.thumbnailUrl,
      formValues.title,
      parsedTags,
      thumbnailMode,
    ],
  );
  const categoryOptions = useMemo(
    () => [
      { value: "", label: "카테고리 선택 안 함" },
      ...(categoriesQuery.data || []).map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    ],
    [categoriesQuery.data],
  );

  const normalizedTitle = normalizeDisplayText(formValues.title);
  const normalizedSubtitle = normalizeDisplayText(formValues.subtitle);
  const normalizedCategory = normalizeDisplayText(formValues.category);

  const canPublish =
    normalizedTitle.length > 0 &&
    hasBodyContent &&
    !publishMutation.isPending &&
    !patchMutation.isPending;
  const isSubmittingPost = publishMutation.isPending || patchMutation.isPending;

  const canSaveDraft =
    (normalizedTitle.length > 0 || hasBodyContent) &&
    !saveDraftMutation.isPending;
  const publishChecklist = useMemo(
    () => [
      {
        label: "제목 입력",
        done: normalizedTitle.length > 0,
      },
      {
        label: "본문 작성",
        done: hasBodyContent,
      },
      {
        label: "카테고리 선택",
        done: normalizedCategory.length > 0,
      },
      {
        label: "태그 1개 이상",
        done: parsedTags.length > 0,
      },
      {
        label: "대표 이미지 준비",
        done: effectiveThumbnailUrl.trim().length > 0,
      },
    ],
    [
      effectiveThumbnailUrl,
      normalizedCategory,
      normalizedTitle,
      hasBodyContent,
      parsedTags.length,
    ],
  );

  const saveDraft = useCallback(
    async (silent: boolean) => {
      if (!canSaveDraft) return;

      try {
        const result = await saveDraftMutation.mutateAsync({
          draftId: activeDraftId,
          request: {
            title: normalizedTitle,
            subtitle: normalizedSubtitle || undefined,
            category: normalizedCategory || undefined,
            tags: parsedTags,
            thumbnailUrl: effectiveThumbnailUrl || undefined,
            contentHtml: formValues.contentHtml,
            contentJson: formValues.contentJson,
          },
        });

        setActiveDraftId(result.id);
        setLastSavedAt(result.updatedAt);
        latestSavedFingerprintRef.current = fingerprint;
        if (!silent) {
          success("임시저장을 완료했습니다.");
        }
      } catch (error) {
        if (!silent) {
          showError(toErrorMessage(error));
        }
      }
    },
    [
      activeDraftId,
      canSaveDraft,
      effectiveThumbnailUrl,
      fingerprint,
      formValues.category,
      formValues.contentHtml,
      formValues.contentJson,
      formValues.subtitle,
      formValues.title,
      parsedTags,
      saveDraftMutation,
      showError,
      success,
    ],
  );

  const commitTagInput = useCallback((rawValue: string) => {
    const incomingTags = tokenizeTagInput(rawValue);
    if (incomingTags.length === 0) {
      setTagInputValue("");
      return false;
    }

    const normalizedCurrentTags = parsedTags.map((tag) => tag.trim());
    const nextTags = [...normalizedCurrentTags];
    const seen = new Set(normalizedCurrentTags.map((tag) => tag.toLocaleLowerCase()));
    let changed = false;

    incomingTags.forEach((tag) => {
      const normalizedTag = normalizeTagToken(tag);
      if (!normalizedTag) return;

      const key = normalizedTag.toLocaleLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      nextTags.push(normalizedTag);
      changed = true;
    });

    if (!changed) {
      setTagInputValue("");
      return false;
    }

    setFormValues((prev) => {
      const currentTags = parseTagText(prev.tagsText);
      const nextTags = [...currentTags];
      const seen = new Set(currentTags.map((tag) => tag.toLocaleLowerCase()));

      incomingTags.forEach((tag) => {
        const normalizedTag = normalizeTagToken(tag);
        if (!normalizedTag) return;

        const key = normalizedTag.toLocaleLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        nextTags.push(normalizedTag);
      });

      return { ...prev, tagsText: stringifyTags(nextTags) };
    });

    setTagInputValue("");
    return true;
  }, [parsedTags, setTagInputValue, setFormValues]);

  const removeTag = useCallback((removedTag: string) => {
    setFormValues((prev) => {
      const currentTags = parseTagText(prev.tagsText);
      const nextTags = currentTags.filter(
        (tag) => tag.toLocaleLowerCase() !== removedTag.toLocaleLowerCase(),
      );
      if (nextTags.length === currentTags.length) {
        return prev;
      }
      return { ...prev, tagsText: stringifyTags(nextTags) };
    });
  }, []);

  const publishPost = async () => {
    const normalizedPublishTitle = normalizeTitleForPublish(normalizedTitle);

    if (!normalizedPublishTitle) {
      showError("제목을 입력해 주세요.");
      return;
    }
    if (!hasSlugConvertibleChar(normalizedPublishTitle)) {
      showError("제목에 한글/영문/숫자를 1자 이상 포함해 주세요.");
      return;
    }
    if (!hasBodyContent) {
      showError("본문 내용을 입력해 주세요.");
      return;
    }

    try {
      const request = {
        title: normalizedPublishTitle,
        subtitle: normalizedSubtitle || undefined,
        category: normalizedCategory || undefined,
        tags: parsedTags,
        thumbnailUrl: effectiveThumbnailUrl || undefined,
        contentHtml: formValues.contentHtml,
        contentJson: formValues.contentJson,
        publishNow: true,
        draftId: activeDraftId,
      };

      if (isEditMode && typeof editingPostId !== "number") {
        showError("수정할 게시글 정보를 확인할 수 없습니다.");
        return;
      }

      const created = isEditMode
        ? await patchMutation.mutateAsync({
            postId: editingPostId as number,
            request,
          })
        : await publishMutation.mutateAsync(request);

      if (typeof activeDraftId === "number") {
        try {
          await deleteDraftMutation.mutateAsync(activeDraftId);
        } catch (cleanupError) {
          const cleanupStatus = getErrorStatus(cleanupError);
          if (cleanupStatus !== 404 && cleanupStatus !== 409) {
            showError(toErrorMessage(cleanupError));
          }
        }
      }

      success(isEditMode ? "게시글이 수정되었습니다." : "게시글이 등록되었습니다.");
      navigate(resolvePostPath(created.id), { replace: true });
    } catch (error) {
      showError(toErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!isEditMode || !editTargetQuery.data) return;
    if (typeof editingPostId !== "number") return;

    const target = editTargetQuery.data;
    const hasThumbnail = Boolean(target.thumbnailUrl?.trim());
    const resolvedThumbnailMode = hasThumbnail
      ? ThumbnailMode.MANUAL_UPLOAD
      : ThumbnailMode.AUTO_FROM_CONTENT;
    const resolvedCategory = normalizeDisplayText(
      typeof target.category?.id === "number"
        ? String(target.category.id)
        : (target.category?.name ?? ""),
    );
    const tags = target.tags.map((tag) => tag.name).filter((name) => name.trim().length > 0);
    const incomingFingerprint = JSON.stringify({
        title: normalizeDisplayText(target.title),
        subtitle: normalizeDisplayText(target.subtitle),
        category: resolvedCategory,
      tags,
      thumbnailMode: resolvedThumbnailMode,
      thumbnailUrl: target.thumbnailUrl || "",
      contentHtml: target.contentHtml || "",
    });
    const isSamePost = initializedEditPostIdRef.current === editingPostId;
    const hasLocalEdits =
      isSamePost && fingerprint !== editInitialFingerprintRef.current;
    const alreadyHydratedWithIncoming =
      isSamePost && fingerprint === incomingFingerprint;

    if (hasLocalEdits || alreadyHydratedWithIncoming) return;

    setFormValues({
      title: normalizeDisplayText(target.title),
      subtitle: normalizeDisplayText(target.subtitle),
      category: resolvedCategory,
      tagsText: stringifyTags(tags),
      thumbnailUrl: target.thumbnailUrl || "",
      contentHtml: target.contentHtml || "",
      contentJson: target.contentJson,
    });
    setThumbnailMode(resolvedThumbnailMode);
    setComposeMode(ComposeMode.WRITE);
    setActiveDraftId(undefined);
    setLastSavedAt(undefined);
    setTagInputValue("");
    latestSavedFingerprintRef.current = incomingFingerprint;
    editInitialFingerprintRef.current = latestSavedFingerprintRef.current;
    initializedEditPostIdRef.current = editingPostId;
  }, [
    editTargetQuery.data,
    editingPostId,
    fingerprint,
    isEditMode,
  ]);

  const loadDraft = async (draftId: number) => {
    setIsLoadingDraft(true);

    try {
      const draft = await getPostDraft(draftId);
      const hasThumbnail = Boolean(draft.thumbnailUrl?.trim());
      const resolvedThumbnailMode = hasThumbnail
        ? ThumbnailMode.MANUAL_UPLOAD
        : ThumbnailMode.AUTO_FROM_CONTENT;

      setFormValues({
        title: normalizeDisplayText(draft.title),
        subtitle: normalizeDisplayText(draft.subtitle),
        category: normalizeDisplayText(draft.category),
        tagsText: stringifyTags(draft.tags),
        thumbnailUrl: draft.thumbnailUrl || "",
        contentHtml: draft.contentHtml,
        contentJson: draft.contentJson,
      });
      setTagInputValue("");
      setThumbnailMode(resolvedThumbnailMode);
      setComposeMode(ComposeMode.WRITE);
      setActiveDraftId(draft.id);
      setLastSavedAt(draft.updatedAt);
      latestSavedFingerprintRef.current = JSON.stringify({
        title: normalizeDisplayText(draft.title),
        subtitle: normalizeDisplayText(draft.subtitle),
        category: normalizeDisplayText(draft.category),
        tags: draft.tags,
        thumbnailMode: resolvedThumbnailMode,
        thumbnailUrl: draft.thumbnailUrl || "",
        contentHtml: draft.contentHtml,
      });
      success("임시저장 글을 불러왔습니다.");
    } catch (error) {
      showError(toErrorMessage(error));
    } finally {
      setIsLoadingDraft(false);
    }
  };

  const removeDraft = async (draftId: number) => {
    try {
      await deleteDraftMutation.mutateAsync(draftId);
      if (activeDraftId === draftId) {
        setActiveDraftId(undefined);
      }
      success("임시저장을 삭제했습니다.");
    } catch (error) {
      showError(toErrorMessage(error));
    }
  };

  const handleThumbnailFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    setIsUploadingThumbnail(true);
    try {
      const uploaded = await uploadPostImage(file);
      setFormValues((prev) => ({ ...prev, thumbnailUrl: uploaded.url }));
      setThumbnailMode(ThumbnailMode.MANUAL_UPLOAD);
      success("대표 이미지가 업로드되었습니다.");
    } catch (error) {
      showError(toErrorMessage(error));
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  useEffect(() => {
    if (!canSaveDraft) return;
    if (fingerprint === latestSavedFingerprintRef.current) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveDraft(true);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [canSaveDraft, fingerprint, saveDraft]);

  useEffect(() => {
    if (!isFocusComposeOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFocusComposeOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFocusComposeOpen]);

  useEffect(() => {
    if (!isFocusComposeOpen) return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    const previousHtmlOverscrollBehavior = documentElement.style.overscrollBehavior;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    documentElement.style.overscrollBehavior = "contain";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
    };
  }, [isFocusComposeOpen]);

  if (isMobile) {
    return (
      <>
        <div className="route-enter flex min-h-[48vh] items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="space-y-3">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              모바일에서는 글쓰기를 지원하지 않습니다.
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              게시글 작성과 수정은 PC 환경에서 진행해 주세요.
            </p>
          </div>
        </div>

        <ActionDialog
          open
          title="PC에서 글쓰기를 이용해 주세요"
          description="모바일 환경에서는 에디터 사용을 제한하고 있습니다. PC에서 접속해 게시글을 작성하거나 수정해 주세요."
          confirmText="목록으로 이동"
          onConfirm={() => {
            navigate("/posts", { replace: true });
          }}
          onOpenChange={() => {
            navigate("/posts", { replace: true });
          }}
          closeOnEsc={false}
          closeOnOverlayClick={false}
        />
      </>
    );
  }

  if (isEditMode && editTargetQuery.isLoading) {
    return (
      <div className="route-enter flex min-h-[48vh] flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-semibold text-slate-500">게시글 불러오는 중...</p>
      </div>
    );
  }

  if (isEditMode && editTargetQuery.isError) {
    return (
      <div className="route-enter rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">
          {toErrorMessage(editTargetQuery.error)}
        </p>
        <Link to="/posts" className="mt-4 inline-flex">
          <Button type="button" variant="outline">
            목록으로
          </Button>
        </Link>
      </div>
    );
  }

  const renderComposeModeToggle = (
    <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      <button
        type="button"
        onClick={() => setComposeMode(ComposeMode.WRITE)}
        className={[
          "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
          composeMode === ComposeMode.WRITE
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
        ].join(" ")}
      >
        작성
      </button>
      <button
        type="button"
        onClick={() => setComposeMode(ComposeMode.PREVIEW)}
        className={[
          "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
          composeMode === ComposeMode.PREVIEW
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
        ].join(" ")}
      >
        미리보기
      </button>
      <span className="ml-auto pr-2 text-xs text-slate-500 dark:text-slate-400">
        글자 수 {plainText.length.toLocaleString()}자
      </span>
    </div>
  );

  const renderMetaFields = (fullScreen: boolean) => (
    <div className="space-y-4">
      <div
        className={
          fullScreen ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2"
        }
      >
        <Input
          label="제목"
          value={formValues.title}
          onChange={(event) =>
            setFormValues((prev) => ({ ...prev, title: event.target.value }))
          }
          placeholder="독자가 클릭하고 싶은 제목"
          maxLength={200}
        />
        <Input
          label="부제"
          value={formValues.subtitle}
          onChange={(event) =>
            setFormValues((prev) => ({ ...prev, subtitle: event.target.value }))
          }
          placeholder="요약 부제"
          maxLength={255}
        />
        <Select
          label="카테고리"
          value={formValues.category}
          onValueChange={(value) =>
            setFormValues((prev) => ({
              ...prev,
              category: value,
            }))
          }
          options={categoryOptions}
          disabled={categoriesQuery.isLoading}
          hint={
            categoriesQuery.data?.length
              ? "관리자에서 등록한 카테고리만 선택할 수 있습니다."
              : "등록된 카테고리가 없습니다. 우선 카테고리 없이 작성할 수 있습니다."
          }
        />
        <HashtagInput
          label="태그 (해시태그)"
          tags={parsedTags}
          value={tagInputValue}
          onValueChange={setTagInputValue}
          onCommit={commitTagInput}
          onRemove={removeTag}
          hint="#을 생략하고 입력 후 Enter(또는 콤마)로 등록할 수 있습니다."
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              대표 이미지
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              직접 업로드하거나 본문 첫 이미지를 자동 썸네일로 사용할 수
              있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setThumbnailMode(ThumbnailMode.AUTO_FROM_CONTENT)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                thumbnailMode === ThumbnailMode.AUTO_FROM_CONTENT
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              ].join(" ")}
            >
              본문 첫 이미지 자동
            </button>
            <button
              type="button"
              onClick={() => setThumbnailMode(ThumbnailMode.MANUAL_UPLOAD)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                thumbnailMode === ThumbnailMode.MANUAL_UPLOAD
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              ].join(" ")}
            >
              직접 업로드
            </button>
          </div>
        </div>

        {thumbnailMode === ThumbnailMode.MANUAL_UPLOAD ? (
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => thumbnailInputRef.current?.click()}
              disabled={isUploadingThumbnail}
            >
              {isUploadingThumbnail ? "업로드 중..." : "대표 이미지 파일 첨부"}
            </Button>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              JPG, PNG, WEBP 파일을 권장합니다.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            본문에 이미지가 있으면 첫 번째 이미지를 자동으로 썸네일에
            사용합니다.
          </p>
        )}

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {effectiveThumbnailUrl ? (
            <img
              src={effectiveThumbnailUrl}
              alt="대표 이미지 미리보기"
              className="h-[180px] w-full object-cover"
            />
          ) : (
            <div className="flex h-[180px] items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              대표 이미지가 없습니다.
            </div>
          )}
        </div>

        {thumbnailMode === ThumbnailMode.AUTO_FROM_CONTENT &&
        !firstImageThumbnailUrl ? (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            본문에 이미지가 아직 없어 자동 썸네일을 만들 수 없습니다.
          </p>
        ) : null}
      </section>

      {categoriesQuery.isError ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          카테고리 목록을 불러오지 못했습니다. 다시 시도해 주세요.
        </p>
      ) : null}
    </div>
  );

  const renderEditorSection = (fullScreen: boolean) => (
    <div className="space-y-3">
      {renderComposeModeToggle}
      {composeMode === ComposeMode.WRITE ? (
        <Suspense fallback={<EditorLoader />}>
          <BlogEditor
            fullScreen={fullScreen}
            valueHtml={formValues.contentHtml}
            valueJson={formValues.contentJson}
            onUploadImage={async (file, options) => {
              const uploaded = await uploadPostImage(file, {
                onStageChange: options?.onStageChange,
              });
              return uploaded.url;
            }}
            onChange={(payload) => {
              setFormValues((prev) => ({
                ...prev,
                contentHtml: payload.html,
                contentJson: payload.json,
              }));
            }}
          />
        </Suspense>
      ) : (
        <article className="toss-editor-content prose prose-slate max-w-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 dark:prose-invert dark:border-slate-700 dark:bg-slate-900/60">
          {safePreviewHtml.trim().length > 0 ? (
            <div
              dangerouslySetInnerHTML={{
                __html: safePreviewHtml,
              }}
            />
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              작성된 내용이 없습니다.
            </p>
          )}
        </article>
      )}
    </div>
  );

  const renderDraftList = (maxItems?: number) => {
    const items =
      typeof maxItems === "number" ? draftItems.slice(0, maxItems) : draftItems;
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          임시저장 목록
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          최근에 저장한 초안을 이어서 작성할 수 있습니다.
        </p>

        <div className="mt-3 space-y-2">
          {draftsQuery.isLoading ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              불러오는 중...
            </p>
          ) : null}

          {!draftsQuery.isLoading && items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
              임시저장된 글이 없습니다.
            </p>
          ) : null}

          {items.map((draft) => {
            const isActive = draft.id === activeDraftId;
            return (
              <div
                key={draft.id}
                className={[
                  "rounded-xl border p-3",
                  isActive
                    ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
                ].join(" ")}
              >
                <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {normalizeDisplayText(draft.title) || "제목 없는 초안"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {new Date(draft.updatedAt).toLocaleString("ko-KR")}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoadingDraft}
                    onClick={() => {
                      void loadDraft(draft.id);
                    }}
                  >
                    불러오기
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deleteDraftMutation.isPending}
                    onClick={() => {
                      void removeDraft(draft.id);
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const focusComposeOverlay =
    isFocusComposeOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-white dark:bg-slate-950">
            <div className="min-h-dvh">
              <header className="sticky top-0 z-10 flex w-full flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/95 sm:px-6">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    전체화면 작성 모드
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void saveDraft(false);
                    }}
                    disabled={!canSaveDraft}
                  >
                    {saveDraftMutation.isPending ? "저장 중..." : "임시저장"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      void publishPost();
                    }}
                    disabled={!canPublish}
                    isLoading={isSubmittingPost}
                  >
                    {isEditMode ? "수정 완료" : "등록하기"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsFocusComposeOpen(false)}
                  >
                    닫기 (ESC)
                  </Button>
                </div>
              </header>

              <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-6 sm:pb-6 sm:pt-6">
                <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                      {renderMetaFields(true)}
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                      {renderEditorSection(true)}
                    </div>
                  </section>

                  <aside className="space-y-3">{renderDraftList(8)}</aside>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-white pb-12 pt-6 dark:from-slate-950 dark:to-slate-900">
      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleThumbnailFileChange(event);
        }}
      />

      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                {isEditMode ? "글 수정" : "새 글 작성"}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {isEditMode
                  ? "기존 글을 수정하고 바로 반영할 수 있습니다."
                  : "워드처럼 바로 작성하고 이미지도 붙여넣기로 업로드할 수 있습니다."}
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsFocusComposeOpen(true);
                }}
              >
                전체화면 작성
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void saveDraft(false);
                }}
                disabled={!canSaveDraft}
              >
                {saveDraftMutation.isPending ? "저장 중..." : "임시저장"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void publishPost();
                }}
                disabled={!canPublish}
                isLoading={isSubmittingPost}
              >
                {isEditMode ? "수정 완료" : "등록하기"}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>글자 수 {plainText.length.toLocaleString()}자</span>
            <span>·</span>
            <span>
              마지막 저장{" "}
              {lastSavedAt
                ? new Date(lastSavedAt).toLocaleString("ko-KR")
                : "-"}
            </span>
            <span>·</span>
            <span>{activeDraftId ? `Draft #${activeDraftId}` : "새 글"}</span>
            {isEditMode ? (
              <>
                <span>·</span>
                <span>수정 대상 #{editingPostId}</span>
              </>
            ) : null}
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
              {renderMetaFields(false)}
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
              {renderEditorSection(false)}
            </div>
          </section>

          <aside className="space-y-4">
            {renderDraftList()}
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  발행 준비 상태
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {publishChecklist.filter((item) => item.done).length}/
                  {publishChecklist.length} 완료
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {publishChecklist.map((item) => (
                  <div
                    key={item.label}
                    className={[
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-xs",
                      item.done
                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300"
                        : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300",
                    ].join(" ")}
                  >
                    <span>{item.label}</span>
                    <span className="font-semibold">
                      {item.done ? "완료" : "확인 필요"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                작성 안내
              </h2>
              <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">
                <li>
                  • Ctrl+V, 드래그앤드롭으로 이미지를 본문에 넣을 수 있습니다.
                </li>
                <li>
                  • 대표 이미지는 직접 업로드 또는 본문 첫 이미지 자동
                  선택입니다.
                </li>
                <li>• 8초 간격으로 자동 임시저장이 동작합니다.</li>
              </ul>

              <Link
                to="/posts"
                className="mt-4 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              >
                목록으로 돌아가기
              </Link>
            </section>
          </aside>
        </div>
      </div>

      {focusComposeOverlay}
    </div>
  );
}
