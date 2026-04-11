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
import { useAuthContext } from "@/shared/context/useAuthContext";
import { ActionDialog, Button, Input, Select } from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import { resolvePostContentHtml } from "../components/editor/postEditorContent";
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
  useSeriesList,
} from "../queries";
import { ComposeMode } from "../types/enums";
import type { ComposeMode as ComposeModeType } from "../types/enums";
import type { PostComposerFormValues } from "../types/form";
import {
  parseTagText,
  estimateReadTimeMinutes,
  extractTocFromHtml,
  hasCustomEditorBlocks,
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
  seriesId: "",
  seriesTitle: "",
  seriesOrder: "",
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

function toPositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
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
  const { user } = useAuthContext();
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
  const hasShownMissingJsonWarningRef = useRef(false);

  const categoriesQuery = usePostCategories();
  const seriesQuery = useSeriesList({
    enabled: Boolean(user),
  });
  const editTargetQuery = usePostDetail(editingPostId ?? 0, {
    enabled: isEditMode,
  });
  const draftsQuery = usePostDrafts();
  const saveDraftMutation = useSavePostDraft();
  const deleteDraftMutation = useDeletePostDraft();
  const publishMutation = usePublishPost();
  const patchMutation = usePatchPost();

  const draftItems = draftsQuery.data || [];
  const resolvedContentHtml = useMemo(
    () =>
      resolvePostContentHtml({
        contentHtml: formValues.contentHtml,
        contentJson: formValues.contentJson,
        preferJson: true,
      }),
    [formValues.contentHtml, formValues.contentJson],
  );
  const parsedTags = useMemo(
    () => parseTagText(formValues.tagsText),
    [formValues.tagsText],
  );
  const plainText = useMemo(
    () => stripHtml(resolvedContentHtml),
    [resolvedContentHtml],
  );
  const previewExcerpt = useMemo(() => {
    const summarySource = normalizeDisplayText(formValues.subtitle) || plainText;
    if (!summarySource) {
      return "요약 문구나 본문 첫 문단이 카드 미리보기에 반영됩니다.";
    }
    return summarySource.length > 132
      ? `${summarySource.slice(0, 132).trim()}...`
      : summarySource;
  }, [formValues.subtitle, plainText]);
  const hasBodyContent = useMemo(
    () => plainText.trim().length > 0 || hasMeaningfulHtml(resolvedContentHtml),
    [plainText, resolvedContentHtml],
  );
  const safePreviewHtml = useMemo(
    () => sanitizeHtml(resolvedContentHtml),
    [resolvedContentHtml],
  );
  const estimatedReadMinutes = useMemo(
    () => estimateReadTimeMinutes(resolvedContentHtml),
    [resolvedContentHtml],
  );
  const tocItems = useMemo(
    () => extractTocFromHtml(resolvedContentHtml),
    [resolvedContentHtml],
  );

  const firstImageThumbnailUrl = useMemo(
    () => extractFirstImageUrlFromHtml(resolvedContentHtml),
    [resolvedContentHtml],
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
        seriesId: normalizeDisplayText(formValues.seriesId),
        seriesTitle: normalizeDisplayText(formValues.seriesTitle),
        seriesOrder: normalizeDisplayText(formValues.seriesOrder),
        tags: parsedTags,
        thumbnailMode,
        thumbnailUrl: formValues.thumbnailUrl.trim(),
        contentHtml: resolvedContentHtml.trim(),
      }),
    [
      formValues.category,
      formValues.seriesId,
      formValues.seriesOrder,
      formValues.seriesTitle,
      formValues.subtitle,
      formValues.thumbnailUrl,
      formValues.title,
      parsedTags,
      resolvedContentHtml,
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
  const availableSeriesItems = useMemo(() => {
    const rawItems = seriesQuery.data || [];
    if (rawItems.length === 0) return rawItems;
    if (typeof user?.id !== "number") return rawItems;

    const ownSeries = rawItems.filter(
      (series) => typeof series.authorId !== "number" || series.authorId === user.id,
    );

    return ownSeries.length > 0 ? ownSeries : rawItems;
  }, [seriesQuery.data, user?.id]);
  const seriesOptions = useMemo(
    () => [
      { value: "", label: "시리즈 선택 안 함" },
      ...availableSeriesItems.map((series) => ({
        value: String(series.id),
        label:
          series.postCount > 0
            ? `${series.title} (${series.postCount}편)`
            : series.title,
      })),
    ],
    [availableSeriesItems],
  );

  const normalizedTitle = normalizeDisplayText(formValues.title);
  const normalizedSubtitle = normalizeDisplayText(formValues.subtitle);
  const normalizedCategory = normalizeDisplayText(formValues.category);
  const normalizedSeriesId = normalizeDisplayText(formValues.seriesId);
  const normalizedSeriesTitle = normalizeDisplayText(formValues.seriesTitle);
  const normalizedSeriesOrder = normalizeDisplayText(formValues.seriesOrder);
  const selectedSeriesOption = normalizedSeriesId
    ? seriesOptions.find((option) => option.value === normalizedSeriesId)
    : undefined;
  const resolvedCategoryLabel = formValues.category
    ? categoryOptions.find((option) => option.value === formValues.category)
        ?.label || "미분류"
    : "미분류";
  const resolvedSeriesLabel = selectedSeriesOption?.label
    ? normalizedSeriesOrder
      ? `${selectedSeriesOption.label} · ${normalizedSeriesOrder}편`
      : selectedSeriesOption.label
    : normalizedSeriesTitle
    ? normalizedSeriesOrder
      ? `${normalizedSeriesTitle} · ${normalizedSeriesOrder}편`
      : normalizedSeriesTitle
    : "";

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
  const completedChecklistCount = useMemo(
    () => publishChecklist.filter((item) => item.done).length,
    [publishChecklist],
  );
  const composerStatusLabel = useMemo(() => {
    if (completedChecklistCount === publishChecklist.length) {
      return "발행 준비 완료";
    }
    if (normalizedTitle.length > 0 || hasBodyContent) {
      return "작성 중";
    }
    return "초안 시작 전";
  }, [
    completedChecklistCount,
    hasBodyContent,
    normalizedTitle.length,
    publishChecklist.length,
  ]);
  const compositionSuggestions = useMemo(() => {
    const suggestions: string[] = [];

    if (normalizedTitle.length > 0 && normalizedTitle.length < 12) {
      suggestions.push("제목이 짧습니다. 검색/탐색 카드에서 더 눈에 띄게 다듬어 보세요.");
    }
    if (hasBodyContent && plainText.length > 1000 && tocItems.length < 2) {
      suggestions.push("본문이 길어졌습니다. 제목 2/3을 추가해 읽기 흐름을 나누는 편이 좋습니다.");
    }
    if (hasBodyContent && parsedTags.length === 0) {
      suggestions.push("태그가 없으면 탐색 노출이 약해집니다. 핵심 키워드를 1개 이상 붙이는 편이 좋습니다.");
    }
    if (hasBodyContent && !effectiveThumbnailUrl.trim()) {
      suggestions.push("대표 이미지가 없으면 카드 미리보기가 약합니다. 본문 첫 이미지나 직접 업로드를 준비해 주세요.");
    }
    if (plainText.length > 0 && plainText.length < 280) {
      suggestions.push("본문이 짧습니다. 문제 제기나 요약 한 단락을 더 넣으면 블로그 글 느낌이 더 강해집니다.");
    }

    return suggestions.slice(0, 4);
  }, [
    effectiveThumbnailUrl,
    hasBodyContent,
    parsedTags.length,
    plainText.length,
    normalizedTitle.length,
    tocItems.length,
  ]);

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
            seriesId: toPositiveInteger(normalizedSeriesId),
            seriesTitle:
              normalizedSeriesId.length === 0
                ? normalizedSeriesTitle || undefined
                : undefined,
            seriesOrder: toPositiveInteger(normalizedSeriesOrder),
            tags: parsedTags,
            thumbnailUrl: effectiveThumbnailUrl || undefined,
            contentHtml: resolvedContentHtml,
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
      formValues.contentHtml,
      formValues.contentJson,
      normalizedCategory,
      normalizedSeriesId,
      normalizedSeriesOrder,
      normalizedSeriesTitle,
      normalizedSubtitle,
      normalizedTitle,
      parsedTags,
      resolvedContentHtml,
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
        seriesId: toPositiveInteger(normalizedSeriesId),
        seriesTitle:
          normalizedSeriesId.length === 0
            ? normalizedSeriesTitle || undefined
            : undefined,
        seriesOrder: toPositiveInteger(normalizedSeriesOrder),
        tags: parsedTags,
        thumbnailUrl: effectiveThumbnailUrl || undefined,
        contentHtml: resolvedContentHtml,
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
    const resolvedSeriesId =
      typeof target.series?.id === "number" ? String(target.series.id) : "";
    const resolvedSeriesTitle = normalizeDisplayText(target.series?.title);
    const resolvedSeriesOrder =
      typeof target.series?.order === "number" ? String(target.series.order) : "";
    const tags = target.tags.map((tag) => tag.name).filter((name) => name.trim().length > 0);
    const incomingFingerprint = JSON.stringify({
      title: normalizeDisplayText(target.title),
      subtitle: normalizeDisplayText(target.subtitle),
      category: resolvedCategory,
      seriesId: resolvedSeriesId,
      seriesTitle: resolvedSeriesTitle,
      seriesOrder: resolvedSeriesOrder,
      tags,
      thumbnailMode: resolvedThumbnailMode,
      thumbnailUrl: target.thumbnailUrl || "",
      contentHtml: resolvePostContentHtml({
        contentHtml: target.contentHtml || "",
        contentJson: target.contentJson,
        preferJson: true,
      }),
    });
    const isSamePost = initializedEditPostIdRef.current === editingPostId;
    const hasLocalEdits =
      isSamePost && fingerprint !== editInitialFingerprintRef.current;
    const alreadyHydratedWithIncoming =
      isSamePost && fingerprint === incomingFingerprint;

    if (hasLocalEdits || alreadyHydratedWithIncoming) return;

    hasShownMissingJsonWarningRef.current = false;
    setFormValues({
      title: normalizeDisplayText(target.title),
      subtitle: normalizeDisplayText(target.subtitle),
      category: resolvedCategory,
      seriesId: resolvedSeriesId,
      seriesTitle: resolvedSeriesTitle,
      seriesOrder: resolvedSeriesOrder,
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

  useEffect(() => {
    if (hasShownMissingJsonWarningRef.current) return;

    const loadedHtml = formValues.contentHtml;
    if (!loadedHtml.trim()) return;
    if (formValues.contentJson) return;
    if (!hasCustomEditorBlocks(loadedHtml)) return;

    hasShownMissingJsonWarningRef.current = true;
    showError(
      "서버가 편집 블록 데이터를 완전히 돌려주지 않았습니다. 표, 콜아웃, 링크 카드 같은 블록은 백엔드에서 contentJson을 그대로 저장/반환해야 안전합니다.",
    );
  }, [formValues.contentHtml, formValues.contentJson, showError]);

  const loadDraft = async (draftId: number) => {
    setIsLoadingDraft(true);

    try {
      const draft = await getPostDraft(draftId);
      const hasThumbnail = Boolean(draft.thumbnailUrl?.trim());
      const resolvedThumbnailMode = hasThumbnail
        ? ThumbnailMode.MANUAL_UPLOAD
        : ThumbnailMode.AUTO_FROM_CONTENT;

      hasShownMissingJsonWarningRef.current = false;
      setFormValues({
        title: normalizeDisplayText(draft.title),
        subtitle: normalizeDisplayText(draft.subtitle),
        category: normalizeDisplayText(draft.category),
        seriesId:
          typeof draft.seriesId === "number" ? String(draft.seriesId) : "",
        seriesTitle: normalizeDisplayText(draft.seriesTitle),
        seriesOrder:
          typeof draft.seriesOrder === "number"
            ? String(draft.seriesOrder)
            : "",
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
        seriesId:
          typeof draft.seriesId === "number" ? String(draft.seriesId) : "",
        seriesTitle: normalizeDisplayText(draft.seriesTitle),
        seriesOrder:
          typeof draft.seriesOrder === "number"
            ? String(draft.seriesOrder)
            : "",
        tags: draft.tags,
        thumbnailMode: resolvedThumbnailMode,
        thumbnailUrl: draft.thumbnailUrl || "",
        contentHtml: resolvePostContentHtml({
          contentHtml: draft.contentHtml,
          contentJson: draft.contentJson,
          preferJson: true,
        }),
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
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5 dark:border-slate-700 dark:bg-slate-800/80">
      <button
        type="button"
        onClick={() => setComposeMode(ComposeMode.WRITE)}
        className={[
          "rounded-xl px-3.5 py-2 text-sm font-semibold transition",
          composeMode === ComposeMode.WRITE
            ? "bg-white text-slate-950 shadow-[0_14px_28px_-18px_rgba(15,23,42,0.35)] dark:bg-slate-900 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
        ].join(" ")}
      >
        작성
      </button>
      <button
        type="button"
        onClick={() => setComposeMode(ComposeMode.PREVIEW)}
        className={[
          "rounded-xl px-3.5 py-2 text-sm font-semibold transition",
          composeMode === ComposeMode.PREVIEW
            ? "bg-white text-slate-950 shadow-[0_14px_28px_-18px_rgba(15,23,42,0.35)] dark:bg-slate-900 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
        ].join(" ")}
      >
        미리보기
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-2 pr-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <span className="rounded-full bg-white px-2.5 py-1 dark:bg-slate-900">
          글자 수 {plainText.length.toLocaleString()}자
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 dark:bg-slate-900">
          예상 {estimatedReadMinutes}분
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 dark:bg-slate-900">
          목차 {tocItems.length}개
        </span>
      </div>
    </div>
  );

  const renderMetaFields = (fullScreen: boolean) => (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Story Setup
        </p>
        <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
          글의 제목, 맥락, 노출 정보를 먼저 정리해 주세요.
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          제목과 부제, 카테고리, 태그, 대표 이미지는 글을 클릭하게 만드는 첫 화면입니다.
        </p>
      </div>
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
        <Select
          label="기존 시리즈"
          value={formValues.seriesId}
          onValueChange={(value) =>
            setFormValues((prev) => ({
              ...prev,
              seriesId: value,
              seriesTitle: value ? "" : prev.seriesTitle,
            }))
          }
          options={seriesOptions}
          disabled={seriesQuery.isLoading}
          hint={
            seriesQuery.data?.length
              ? "내 시리즈가 있으면 바로 선택하고, 없으면 아래에 새 이름을 입력하세요."
              : "아직 연결할 시리즈가 없습니다. 새 시리즈 이름을 입력해도 됩니다."
          }
        />
        <Input
          label="새 시리즈 이름"
          value={formValues.seriesTitle}
          onChange={(event) =>
            setFormValues((prev) => ({
              ...prev,
              seriesId: "",
              seriesTitle: event.target.value,
            }))
          }
          placeholder="예: 프론트엔드 리디자인 일지"
          maxLength={100}
          disabled={Boolean(formValues.seriesId)}
        />
        <Input
          label="시리즈 순서"
          value={formValues.seriesOrder}
          onChange={(event) =>
            setFormValues((prev) => ({
              ...prev,
              seriesOrder: event.target.value,
            }))
          }
          placeholder="예: 3"
          maxLength={10}
        />
      </div>

      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              시리즈 연결
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              기존 시리즈를 선택하거나 새 시리즈 이름을 입력한 뒤, 몇 편인지 함께 저장할 수 있습니다.
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-white/80 bg-white/80 px-3 py-3 text-xs text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
          {resolvedSeriesLabel ? (
            <>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                현재 연결 시리즈
              </p>
              <p className="mt-1">{resolvedSeriesLabel}</p>
            </>
          ) : (
            "시리즈를 지정하면 상세 페이지와 피드 카드에서 함께 노출됩니다."
          )}
        </div>
        {seriesQuery.isError ? (
          <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
            시리즈 목록을 불러오지 못했습니다. 새 시리즈 이름으로 직접 저장은 계속 시도할 수 있습니다.
          </p>
        ) : null}
      </section>

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
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Editorial Canvas
        </p>
        <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
          블로그 글처럼 보이게 쓰고, 블록으로 구조를 만드세요.
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          `/` 명령으로 제목, 체크리스트, 콜아웃, 좌우 2열 이미지를 빠르게 넣을 수 있습니다.
        </p>
      </div>
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
        <article className="toss-editor-content prose prose-slate max-w-none rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.98))] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:prose-invert dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))]">
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

  const renderDocumentOverview = () => (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          문서 구조
        </h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {estimatedReadMinutes}분 읽기
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            글자 수
          </p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
            {plainText.length.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            제목 수
          </p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
            {tocItems.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            태그 수
          </p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
            {parsedTags.length}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {tocItems.length > 0 ? (
          tocItems.map((item) => (
            <div
              key={`${item.id}-${item.text}`}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70"
            >
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                H{item.level}
              </span>
              <span className="line-clamp-1 text-slate-700 dark:text-slate-200">
                {item.text}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
            아직 제목 구조가 없습니다. 긴 글이라면 제목 2, 제목 3으로 흐름을 나누는 편이 좋습니다.
          </p>
        )}
      </div>
    </section>
  );

  const renderWritingGuide = () => (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
        작성 가이드
      </h2>
      <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">
        <li>• `/`로 제목, 체크리스트, 콜아웃, 표, 링크 카드, 좌우 2열 이미지를 빠르게 넣을 수 있습니다.</li>
        <li>• Ctrl+V 또는 드래그앤드롭으로 이미지를 넣으면 2장은 자동으로 반반 배치되고, 이후 드래그로 서로 교체할 수 있습니다.</li>
        <li>• 대표 이미지는 직접 업로드하거나 본문 첫 이미지를 자동으로 쓸 수 있습니다.</li>
        <li>• 8초 간격으로 자동 임시저장이 동작합니다.</li>
      </ul>

      <div className="mt-4 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          개선 제안
        </p>
        {compositionSuggestions.length > 0 ? (
          compositionSuggestions.map((suggestion) => (
            <p
              key={suggestion}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            >
              {suggestion}
            </p>
          ))
        ) : (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            현재 구성이 안정적입니다. 미리보기에서 카드 썸네일과 제목 균형만 마지막으로 확인해 보세요.
          </p>
        )}
      </div>

      <Link
        to="/posts"
        className="mt-4 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
      >
        목록으로 돌아가기
      </Link>
    </section>
  );

  const renderPublishPreviews = () => (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          발행 미리보기
        </h2>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          카드 3종
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            Search Card
          </p>
          <div className="mt-2 flex gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-blue-100 dark:bg-blue-950/40">
              {effectiveThumbnailUrl ? (
                <img
                  src={effectiveThumbnailUrl}
                  alt="검색 카드 썸네일"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {normalizedTitle || "제목이 비어 있습니다."}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {previewExcerpt}
              </p>
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                {resolvedCategoryLabel} · {estimatedReadMinutes}분 읽기
                {resolvedSeriesLabel ? ` · ${resolvedSeriesLabel}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="aspect-[16/9] w-full bg-[linear-gradient(135deg,rgba(37,99,235,0.16),rgba(79,70,229,0.12))] dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.22),rgba(79,70,229,0.18))]">
            {effectiveThumbnailUrl ? (
              <img
                src={effectiveThumbnailUrl}
                alt="피드 카드 대표 이미지"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-blue-700 dark:text-blue-300">
                대표 이미지 영역
              </div>
            )}
          </div>
          <div className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                {resolvedCategoryLabel}
              </span>
              {resolvedSeriesLabel ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
                  {resolvedSeriesLabel}
                </span>
              ) : null}
            </div>
            <p className="line-clamp-2 text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
              {normalizedTitle || "카드에 보일 제목을 입력해 주세요."}
            </p>
            <p className="line-clamp-3 text-sm text-slate-500 dark:text-slate-400">
              {previewExcerpt}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-blue-200 bg-[linear-gradient(135deg,rgba(37,99,235,0.96),rgba(79,70,229,0.92))] p-5 text-white shadow-[0_26px_60px_-36px_rgba(37,99,235,0.75)] dark:border-blue-500/30">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100/90">
            OG Preview
          </p>
          <div className="mt-5 flex min-h-[180px] flex-col justify-between gap-4">
            <div>
              <p className="max-w-[24rem] text-2xl font-black tracking-tight">
                {normalizedTitle || "소셜 카드 제목을 입력해 주세요."}
              </p>
              <p className="mt-3 max-w-[28rem] text-sm text-blue-50/90">
                {previewExcerpt}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-50/90">
              <span className="rounded-full bg-white/14 px-2.5 py-1">
                {resolvedCategoryLabel}
              </span>
              <span className="rounded-full bg-white/14 px-2.5 py-1">
                {estimatedReadMinutes}분 읽기
              </span>
              {resolvedSeriesLabel ? (
                <span className="rounded-full bg-white/14 px-2.5 py-1">
                  {resolvedSeriesLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
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

                  <aside className="space-y-3">
                    {renderDraftList(8)}
                    {renderDocumentOverview()}
                    {renderPublishPreviews()}
                    {renderWritingGuide()}
                  </aside>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_28%),linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))] pb-12 pt-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,rgba(2,6,23,1),rgba(15,23,42,1))]">
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
        <header className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-5 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                Blog Writing Studio
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                {isEditMode ? "글 수정" : "새 글 작성"}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {isEditMode
                  ? "기존 글을 다듬고, 제목 구조와 카드 노출 요소까지 함께 점검할 수 있습니다."
                  : "실제 블로그 작성기처럼 본문 구조와 카드 메타를 같이 잡으면서 작성할 수 있습니다."}
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

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span
              className={[
                "rounded-full px-3 py-1.5",
                completedChecklistCount === publishChecklist.length
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200",
              ].join(" ")}
            >
              {composerStatusLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              글자 수 {plainText.length.toLocaleString()}자
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              예상 {estimatedReadMinutes}분
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              제목 {tocItems.length}개
            </span>
            {resolvedSeriesLabel ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                {resolvedSeriesLabel}
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              {activeDraftId ? `Draft #${activeDraftId}` : "새 글"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              마지막 저장{" "}
              {lastSavedAt
                ? new Date(lastSavedAt).toLocaleString("ko-KR")
                : "-"}
            </span>
            {isEditMode ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                수정 대상 #{editingPostId}
              </span>
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
            {renderDocumentOverview()}
            {renderPublishPreviews()}
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  발행 준비 상태
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {completedChecklistCount}/{publishChecklist.length} 완료
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
            {renderWritingGuide()}
          </aside>
        </div>
      </div>

      {focusComposeOverlay}
    </div>
  );
}
