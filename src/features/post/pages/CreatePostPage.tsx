import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCreatePost } from "../queries";
import { Button, Input } from "@/shared/ui";
import { uploadImageWithTus } from "../tusUpload";
import { getToken } from "@/shared/lib/auth";
import { API_BASE_URL } from "@/shared/lib/api";
import { toApiAbsoluteUrl } from "@/shared/lib/networkRuntime";

const RichTextEditor = lazy(() => import("@/shared/ui/RichTextEditor"));

type AttachmentUploadItem = {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  url?: string;
  downloadUrl?: string;
  error?: string;
};

type ComposeTab = "write" | "preview" | "attachments";

const composeTabs: Array<{
  key: ComposeTab;
  label: string;
  description: string;
}> = [
  { key: "write", label: "작성", description: "에디터" },
  { key: "preview", label: "미리보기", description: "출판 형태" },
  { key: "attachments", label: "첨부", description: "파일 관리" },
];

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const toAbsoluteApiUrl = (rawUrl: string) => {
  return toApiAbsoluteUrl(rawUrl, API_BASE_URL);
};

const extractUploadId = (url: string) => {
  const matched = url.match(/\/uploads\/([^/?#]+)/);
  return matched?.[1];
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildAttachmentSectionHtml = (
  attachments: AttachmentUploadItem[],
  content: string,
) => {
  const candidates = attachments.filter(
    (item) => item.status === "done" && (item.downloadUrl || item.url),
  );
  const missing = candidates.filter((item) => {
    const link = item.downloadUrl || item.url || "";
    return link && !content.includes(link);
  });

  if (missing.length === 0) return "";

  const links = missing
    .map((item) => {
      const href = item.downloadUrl || item.url || "";
      return `<li><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.file.name)}</a></li>`;
    })
    .join("");

  return `<hr/><h3>첨부 파일</h3><ul>${links}</ul>`;
};

export default function CreatePostPage() {
  const navigate = useNavigate();
  const createPostMutation = useCreatePost();
  const [activeTab, setActiveTab] = useState<ComposeTab>("write");
  const [attachments, setAttachments] = useState<AttachmentUploadItem[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
  });

  const setAttachmentPatch = useCallback(
    (id: string, patch: Partial<AttachmentUploadItem>) => {
      setAttachments((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const processContentImages = useCallback(
    async (content: string, headers: Record<string, string>) => {
      const imgRegex = /<img[^>]+src="data:image\/[^;]+;base64,([^"]+)"[^>]*>/g;
      const replacements: { oldSrc: string; newSrc: Promise<string> }[] = [];

      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        const base64Data = match[1];
        const mimeType = match[0].match(/data:image\/([^;]+)/)?.[1];
        if (!mimeType || !base64Data) continue;

        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const blob = new Blob([new Uint8Array(byteNumbers)], {
          type: `image/${mimeType}`,
        });
        const file = new File([blob], `image.${mimeType}`, {
          type: `image/${mimeType}`,
        });

        replacements.push({
          oldSrc: match[0],
          newSrc: uploadImageWithTus(file, { headers }),
        });
      }

      const urls = await Promise.all(
        replacements.map((replacement) => replacement.newSrc),
      );

      let processedContent = content;
      replacements.forEach((replacement, index) => {
        const absoluteUrl = toAbsoluteApiUrl(urls[index]);
        const newImgTag = replacement.oldSrc.replace(
          /src="data:image\/[^;]+;base64,[^"]+"/,
          `src="${absoluteUrl}"`,
        );
        processedContent = processedContent.replace(
          replacement.oldSrc,
          newImgTag,
        );
      });

      return processedContent;
    },
    [],
  );

  const uploadAttachmentFile = useCallback(
    async (file: File) => {
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      if (attachments.some((item) => item.id === id)) return;

      setAttachments((prev) => [
        ...prev,
        { id, file, progress: 0, status: "uploading" },
      ]);

      const token = getToken();
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      try {
        const uploadedUrl = await uploadImageWithTus(file, {
          headers,
          onProgress: (uploadedBytes, totalBytes) => {
            if (totalBytes <= 0) return;
            const progress = Math.round((uploadedBytes / totalBytes) * 100);
            setAttachmentPatch(id, { progress });
          },
        });

        const absoluteUrl = toAbsoluteApiUrl(uploadedUrl);
        const uploadId =
          extractUploadId(absoluteUrl) || extractUploadId(uploadedUrl);
        const downloadUrl = uploadId
          ? `${API_BASE_URL}/attach-files/uploads/${uploadId}/download`
          : absoluteUrl;

        setAttachmentPatch(id, {
          status: "done",
          progress: 100,
          url: absoluteUrl,
          downloadUrl,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "파일 업로드 실패";
        setAttachmentPatch(id, {
          status: "error",
          error: message,
        });
      }
    },
    [attachments, setAttachmentPatch],
  );

  const uploadAttachmentFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      await Promise.all(files.map((file) => uploadAttachmentFile(file)));
    },
    [uploadAttachmentFile],
  );

  const handleAttachmentSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.target.files || []);
      event.target.value = "";
      await uploadAttachmentFiles(selected);
    },
    [uploadAttachmentFiles],
  );

  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement?.getAttribute("contenteditable") === "true") return;

      const items = Array.from(event.clipboardData?.items || []);
      const files = items
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length === 0) return;

      event.preventDefault();
      await uploadAttachmentFiles(files);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploadAttachmentFiles]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const copyAttachmentUrl = useCallback(async (url?: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      alert("첨부파일 링크를 복사했습니다.");
    } catch (error) {
      console.error("클립보드 복사 실패:", error);
      alert("클립보드 복사에 실패했습니다.");
    }
  }, []);

  const insertAttachmentLinkToContent = useCallback(
    (item: AttachmentUploadItem) => {
      const href = item.downloadUrl || item.url;
      if (!href) return;

      const linkHtml = `<p><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.file.name)}</a></p>`;
      setFormData((prev) => ({
        ...prev,
        content: `${prev.content}${linkHtml}`,
      }));
      setActiveTab("write");
    },
    [],
  );

  const isUploadingAttachment = attachments.some(
    (item) => item.status === "uploading",
  );
  const isPendingSubmit = createPostMutation.isPending;
  const isActionLocked = isUploadingAttachment || isPendingSubmit;

  const completeAttachmentCount = attachments.filter(
    (item) => item.status === "done",
  ).length;
  const failedAttachmentCount = attachments.filter(
    (item) => item.status === "error",
  ).length;

  const plainContentText = useMemo(
    () => stripHtml(formData.content),
    [formData.content],
  );
  const previewContent = useMemo(() => {
    const attachmentHtml = buildAttachmentSectionHtml(
      attachments,
      formData.content,
    );
    return `${formData.content}${attachmentHtml}`;
  }, [attachments, formData.content]);

  const tabIndex = composeTabs.findIndex((tab) => tab.key === activeTab);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      alert("제목과 내용을 모두 입력해주세요.");
      return;
    }

    if (isUploadingAttachment) {
      alert("첨부파일 업로드가 끝난 후 게시해주세요.");
      return;
    }

    try {
      const token = getToken();
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const processedContent = await processContentImages(
        formData.content,
        headers,
      );
      const attachmentHtml = buildAttachmentSectionHtml(
        attachments,
        processedContent,
      );
      const finalContent = `${processedContent}${attachmentHtml}`;

      await createPostMutation.mutateAsync({
        title: formData.title.trim(),
        content: finalContent.trim(),
      });

      navigate("/posts");
    } catch (error) {
      console.error("게시글 작성 실패:", error);
      alert("게시글 작성에 실패했습니다.");
    }
  };

  return (
    <div className="relative mx-auto max-w-6xl overflow-x-hidden px-3 pb-32 pt-4 sm:px-6 sm:pb-12 sm:pt-8 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-72 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_85%_12%,rgba(99,102,241,0.12),transparent_38%)] sm:block" />

      <div className="mb-5 flex flex-col items-stretch gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold text-blue-700">
            Story Studio
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
            새 글 작성
          </h1>
          <p className="mt-2 text-xs text-slate-600 sm:text-sm">
            토스 스타일의 빠른 편집 흐름으로 글, 첨부, 미리보기를 한 번에
            관리하세요.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/posts")}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-5 sm:w-auto"
        >
          목록으로
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:hidden">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">본문 길이</p>
          <p className="mt-1 text-sm font-bold text-slate-800">
            {plainContentText.length.toLocaleString()}자
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-500">첨부 완료</p>
          <p className="mt-1 text-sm font-bold text-emerald-700">
            {completeAttachmentCount}개
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <section className="min-w-0 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_26px_64px_-44px_rgba(15,23,42,0.6)] sm:p-6">
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              제목
            </label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="독자가 스크롤을 멈추게 할 제목을 입력하세요"
              className="h-11 rounded-2xl border-slate-200 text-[16px] sm:h-12"
              maxLength={120}
              required
            />
          </section>

          <section className="min-w-0 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_26px_64px_-44px_rgba(15,23,42,0.6)] sm:p-6">
            <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5 sm:mb-5">
              <div className="relative col-span-3 grid grid-cols-3 gap-2">
                <span
                  className="absolute inset-y-0 left-0 w-[calc((100%-1rem)/3)] rounded-xl bg-white shadow-[0_12px_24px_-16px_rgba(15,23,42,0.55)] transition-transform duration-300"
                  style={{
                    transform: `translateX(calc(${tabIndex} * (100% + 0.5rem)))`,
                  }}
                />
                {composeTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={[
                      "relative z-10 rounded-xl px-2.5 py-2 text-center text-xs transition-colors sm:px-3 sm:text-sm",
                      activeTab === tab.key
                        ? "font-bold text-slate-900"
                        : "font-medium text-slate-500 hover:text-slate-700",
                    ].join(" ")}
                  >
                    <span className="block">{tab.label}</span>
                    <span className="hidden text-[11px] opacity-80 sm:block">
                      {tab.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "write" && (
              <div className="animate-fade-in min-w-0 overflow-hidden">
                <Suspense
                  fallback={
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-semibold text-slate-500">
                      에디터를 준비하는 중...
                    </div>
                  }
                >
                  <RichTextEditor
                    value={formData.content}
                    onChange={(value: string) =>
                      setFormData((prev) => ({ ...prev, content: value }))
                    }
                    placeholder="글의 핵심 메시지를 강하게 시작해보세요"
                  />
                </Suspense>
              </div>
            )}

            {activeTab === "preview" && (
              <div className="animate-fade-in rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-6">
                {plainContentText.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
                    미리보기 내용이 없습니다. 작성 탭에서 본문을 입력해보세요.
                  </div>
                ) : (
                  <article
                    className="prose prose-slate max-w-none break-words prose-headings:tracking-tight prose-img:rounded-2xl prose-img:shadow-md"
                    dangerouslySetInnerHTML={{ __html: previewContent }}
                  />
                )}
              </div>
            )}

            {activeTab === "attachments" && (
              <div className="animate-fade-in rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      첨부파일 업로드
                    </h3>
                    <p className="text-xs text-slate-500">
                      파일 선택 또는 Ctrl/Cmd+V 붙여넣기로 업로드됩니다.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100">
                    파일 선택
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleAttachmentSelect}
                    />
                  </label>
                </div>

                <div className="mt-4 space-y-3">
                  {attachments.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      아직 업로드한 파일이 없습니다.
                    </div>
                  )}

                  {attachments.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {item.file.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatFileSize(item.file.size)}
                          </p>

                          {item.status === "uploading" && (
                            <div className="mt-2">
                              <div className="h-1.5 rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-[width] duration-300"
                                  style={{
                                    width: `${Math.max(item.progress, 4)}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-1 text-[11px] font-semibold text-blue-700">
                                업로드 중 {item.progress}%
                              </p>
                            </div>
                          )}

                          {item.status === "done" && (
                            <p className="mt-2 text-[11px] font-semibold text-emerald-700">
                              업로드 완료
                            </p>
                          )}

                          {item.status === "error" && (
                            <p className="mt-2 text-[11px] font-semibold text-rose-700">
                              실패: {item.error || "오류"}
                            </p>
                          )}
                        </div>

                        <div className="flex w-full flex-wrap items-center gap-2 text-xs sm:w-auto sm:flex-nowrap">
                          {item.status === "done" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  copyAttachmentUrl(
                                    item.downloadUrl || item.url,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                              >
                                링크
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  insertAttachmentLinkToContent(item)
                                }
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                              >
                                본문삽입
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(item.id)}
                            disabled={item.status === "uploading"}
                            className="w-full rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="hidden space-y-4 lg:sticky lg:top-6 lg:block lg:h-fit">
          <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_24px_56px_-44px_rgba(15,23,42,0.65)] sm:p-5">
            <h2 className="text-sm font-bold text-slate-700">작성 상태</h2>
            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">제목 길이</span>
                <span className="font-bold text-slate-800">
                  {formData.title.trim().length}자
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">본문 길이</span>
                <span className="font-bold text-slate-800">
                  {plainContentText.length.toLocaleString()}자
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">첨부 완료</span>
                <span className="font-bold text-emerald-700">
                  {completeAttachmentCount}개
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">첨부 실패</span>
                <span className="font-bold text-rose-700">
                  {failedAttachmentCount}개
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-bold text-slate-800">발행 액션</h2>
            <p className="mt-1 text-xs text-slate-600">
              업로드 완료 후 게시하기가 활성화됩니다.
            </p>
            <div className="mt-4 space-y-2">
              <Button
                type="submit"
                disabled={isActionLocked}
                className="h-11 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                {isPendingSubmit ? "게시 중..." : "게시하기"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/posts")}
                disabled={isActionLocked}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white"
              >
                취소
              </Button>
            </div>
          </section>
        </aside>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/posts")}
              disabled={isActionLocked}
              className="h-11 min-w-[92px] rounded-xl border border-slate-200 bg-white text-sm"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isActionLocked}
              className="h-11 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {isPendingSubmit ? "게시 중..." : "게시하기"}
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            첨부 완료 {completeAttachmentCount}개 · 실패 {failedAttachmentCount}개
          </p>
        </div>
      </form>
    </div>
  );
}
