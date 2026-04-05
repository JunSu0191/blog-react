import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ChangeEvent, ReactNode } from "react";
import Button from "./Button";
import { useTusUpload } from "../../shared/hooks/useTusUpload";
import { useAuthContext } from "../context/useAuthContext";
import { TusUploadStage } from "../../features/post/tusUpload";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

type ToolbarButtonProps = {
  title: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
};

type ToolbarGroupProps = {
  children: ReactNode;
  className?: string;
};

function ToolbarGroup({ children, className }: ToolbarGroupProps) {
  return (
    <div
      className={[
        "flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-[0_10px_22px_-20px_rgba(15,23,42,0.7)] dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-[0_16px_30px_-22px_rgba(2,6,23,0.9)]",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function ToolbarButton({
  title,
  label,
  active = false,
  onClick,
  disabled = false,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-8 min-w-8 rounded-lg px-2.5 text-xs font-semibold transition-all duration-200 sm:h-9 sm:min-w-9 sm:rounded-xl sm:px-3 sm:text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-blue-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.8)]"
          : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading, progress, stage, error } = useTusUpload();
  const { token } = useAuthContext();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "editor-image",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "editor-link",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "내용을 입력하세요...",
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  const buildAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const insertImageWithFallback = useCallback(
    async (file: File) => {
      try {
        const imageUrl = await upload(file, { headers: buildAuthHeaders() });
        editor?.chain().focus().setImage({ src: imageUrl }).run();
      } catch (uploadError) {
        console.error("이미지 업로드 실패:", uploadError);
      }
    },
    [buildAuthHeaders, editor, upload],
  );

  const handlePasteImage = useCallback(
    (_view: unknown, event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return false;

      let hasImage = false;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          hasImage = true;
          const file = item.getAsFile();
          if (file) {
            void insertImageWithFallback(file);
          }
        }
      }

      if (hasImage) {
        event.preventDefault();
      }

      return hasImage;
    },
    [insertImageWithFallback],
  );

  const handleDropImage = useCallback(
    (_view: unknown, event: DragEvent) => {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return false;

      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (imageFiles.length === 0) return false;

      event.preventDefault();
      imageFiles.forEach((file) => {
        void insertImageWithFallback(file);
      });
      return true;
    },
    [insertImageWithFallback],
  );

  useEffect(() => {
    if (!editor) return;

    editor.setOptions({
      editorProps: {
        attributes: {
          class:
            "toss-editor-content prose prose-slate max-w-none min-h-[240px] max-w-full break-words px-4 py-4 text-base leading-7 focus:outline-none dark:prose-invert dark:text-slate-100 sm:min-h-[340px] sm:px-6 sm:py-5",
        },
        handlePaste: handlePasteImage,
        handleDrop: handleDropImage,
      },
    });
  }, [editor, handleDropImage, handlePasteImage]);

  const addImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.type.startsWith("image/")) {
        await insertImageWithFallback(file);
      }
      event.target.value = "";
    },
    [insertImageWithFallback],
  );

  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes("link").href;
    const url = window.prompt("링크 URL을 입력하세요:", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const textCount = useMemo(() => {
    if (!editor) return 0;
    return editor.getText().trim().length;
  }, [editor, value]);

  const uploadStatusLabel =
    stage === TusUploadStage.COMPLETING
      ? "complete 요청 중"
      : "업로드 중";

  if (!editor) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        에디터를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_64px_-42px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_28px_70px_-48px_rgba(2,6,23,0.9)]">
      <div className="w-full max-w-full border-b border-slate-200 bg-slate-50/70 px-2.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/70 sm:px-3 sm:py-3">
        <div className="flex w-full max-w-full min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ToolbarGroup>
            <ToolbarButton
              title="굵게 (Ctrl+B)"
              label="B"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              title="기울임 (Ctrl+I)"
              label="I"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              title="취소선"
              label="S"
              active={editor.isActive("strike")}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            />
            <ToolbarButton
              title="코드"
              label="</>"
              active={editor.isActive("code") || editor.isActive("codeBlock")}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            />
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolbarButton
              title="제목 1"
              label="H1"
              active={editor.isActive("heading", { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            />
            <ToolbarButton
              title="제목 2"
              label="H2"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            />
            <ToolbarButton
              title="제목 3"
              label="H3"
              active={editor.isActive("heading", { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            />
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolbarButton
              title="불릿 리스트"
              label="•"
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              title="번호 리스트"
              label="1."
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              title="강조 박스"
              label="▍"
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
          </ToolbarGroup>

          <ToolbarGroup className="sm:ml-auto">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={addImage}
              disabled={isUploading}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-9 sm:rounded-xl sm:px-3 sm:text-sm"
            >
              이미지
            </Button>
            <Button
              type="button"
              size="sm"
              variant={editor.isActive("link") ? "primary" : "secondary"}
              onClick={setLink}
              className="h-8 rounded-lg px-2.5 py-1.5 text-xs sm:h-9 sm:rounded-xl sm:px-3 sm:text-sm"
            >
              링크
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-9 sm:rounded-xl sm:px-3 sm:text-sm"
            >
              실행취소
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-9 sm:rounded-xl sm:px-3 sm:text-sm"
            >
              다시실행
            </Button>
          </ToolbarGroup>
        </div>
        <p className="mt-1 pl-0.5 text-[11px] text-slate-500 dark:text-slate-400 sm:hidden">
          툴바를 좌우로 스와이프해서 추가 기능을 사용할 수 있습니다.
        </p>
      </div>

      <div className="max-w-full overflow-x-hidden bg-white dark:bg-slate-950">
        <EditorContent editor={editor} />
      </div>

      <div className="border-t border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/75 sm:px-6 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span className="leading-relaxed">
            TipTap Editor · 이미지 붙여넣기/드롭 업로드 · 실시간 편집
          </span>
          <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {textCount.toLocaleString()}자
          </span>
        </div>

        {isUploading && (
          <div className="mt-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-[width] duration-300"
                style={{ width: `${Math.max(progress, 4)}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs font-medium text-blue-700">
              이미지 {uploadStatusLabel} {Math.round(progress)}%
            </p>
          </div>
        )}

        {error && !isUploading && (
          <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            업로드 오류: {error.message}
          </p>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
