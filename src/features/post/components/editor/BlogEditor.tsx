import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { JsonValue, PostTocItem } from "../../types/api";
import { extractTocFromHtml, injectHeadingIds } from "../../utils/postContent";
import TextAlign, { TextAlignValue } from "./extensions/TextAlign";

type BlogEditorChangePayload = {
  html: string;
  json: JsonValue;
  plainText: string;
  toc: PostTocItem[];
};

type BlogEditorProps = {
  valueHtml: string;
  valueJson?: JsonValue;
  placeholder?: string;
  disabled?: boolean;
  fullScreen?: boolean;
  onChange: (payload: BlogEditorChangePayload) => void;
  onUploadImage: (file: File) => Promise<string>;
};

type ToolbarButtonProps = {
  label: string;
  title?: string;
  icon?: ReactNode;
  iconOnly?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

const AlignDirection = {
  LEFT: TextAlignValue.LEFT,
  CENTER: TextAlignValue.CENTER,
  RIGHT: TextAlignValue.RIGHT,
  JUSTIFY: TextAlignValue.JUSTIFY,
} as const;

function toStableJsonString(value: unknown) {
  try {
    return JSON.stringify(value) || "";
  } catch {
    return "";
  }
}

function normalizeContentHtml(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const nestedCandidates: unknown[] = [
    record.contentHtml,
    record.html,
    record.content,
    record.body,
    record.value,
    record.data,
  ];

  for (const candidate of nestedCandidates) {
    const normalized = normalizeContentHtml(candidate);
    if (normalized) return normalized;
  }

  return undefined;
}

function normalizeContentJson(value: unknown): JSONContent | undefined {
  if (!value) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed) as JsonValue;
      return normalizeContentJson(parsed);
    } catch {
      return undefined;
    }
  }

  if (typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const nestedCandidates: unknown[] = [
    record.contentJson,
    record.json,
    record.doc,
    record.data,
  ];

  for (const candidate of nestedCandidates) {
    const normalized: JSONContent | undefined = normalizeContentJson(candidate);
    if (normalized) return normalized;
  }

  const type = record.type;
  const content = record.content;

  if (typeof type !== "string" || type.trim().length === 0) {
    return undefined;
  }

  if (content !== undefined && !Array.isArray(content)) {
    return undefined;
  }

  return value as unknown as JSONContent;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

function ToolbarButton({
  label,
  title,
  icon,
  iconOnly = false,
  active = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  const tooltipLabel = title || label;

  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <button
          type="button"
          title={tooltipLabel}
          aria-label={tooltipLabel}
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={onClick}
          className={[
            "inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm",
            iconOnly ? "h-8 w-8 px-0" : "",
            active
              ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        >
          {icon ? <span aria-hidden="true">{icon}</span> : null}
          {iconOnly ? <span className="sr-only">{label}</span> : label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900">
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}

export default function BlogEditor({
  valueHtml,
  valueJson,
  placeholder = "본문을 작성해 주세요.",
  disabled = false,
  fullScreen = false,
  onChange,
  onUploadImage,
}: BlogEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedHtmlRef = useRef<string>("");
  const lastEmittedJsonRef = useRef<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const normalizedHtml = valueHtml.trim();
  const normalizedHtmlFromJson = useMemo(
    () => normalizeContentHtml(valueJson),
    [valueJson],
  );
  const normalizedJson = useMemo(
    () => normalizeContentJson(valueJson),
    [valueJson],
  );
  const normalizedJsonSignature = useMemo(
    () => toStableJsonString(normalizedJson),
    [normalizedJson],
  );

  const initialContent = useMemo(() => {
    if (normalizedHtml.length > 0) return normalizedHtml;
    if (normalizedHtmlFromJson) return normalizedHtmlFromJson;
    return normalizedJson ?? "<p></p>";
  }, [normalizedHtml, normalizedHtmlFromJson, normalizedJson]);

  const editorContentClassName = useMemo(
    () =>
      [
        "toss-editor-content editor-compose prose prose-slate max-w-none break-words focus:outline-none dark:prose-invert dark:text-slate-100",
        fullScreen
          ? "min-h-[calc(100dvh-23rem)] px-5 py-5 text-[17px] leading-[1.65] sm:px-6 sm:py-6"
          : "min-h-[360px] px-4 py-4 text-base leading-[1.6] sm:px-5 sm:py-5",
      ].join(" "),
    [fullScreen],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExtension,
      Image.configure({
        HTMLAttributes: {
          class: "editor-image",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "editor-link",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: initialContent,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: editorContentClassName,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const htmlWithHeadingIds = injectHeadingIds(currentEditor.getHTML());
      const json = currentEditor.getJSON() as unknown as JsonValue;
      lastEmittedHtmlRef.current = htmlWithHeadingIds;
      lastEmittedJsonRef.current = toStableJsonString(json);

      onChange({
        html: htmlWithHeadingIds,
        json,
        plainText: currentEditor.getText().trim(),
        toc: extractTocFromHtml(htmlWithHeadingIds),
      });
    },
  });

  const handleUploadImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploadErrorMessage(null);
      setIsUploadingImage(true);
      try {
        const uploadedUrl = await onUploadImage(file);
        editor.chain().focus().setImage({ src: uploadedUrl }).run();
      } catch (error) {
        setUploadErrorMessage(toErrorMessage(error));
      } finally {
        setIsUploadingImage(false);
      }
    },
    [editor, onUploadImage],
  );

  const onImageInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("image/")) {
        return;
      }
      await handleUploadImage(file);
    },
    [handleUploadImage],
  );

  const handlePasteImage = useCallback(
    (_view: unknown, event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return false;

      let hasImage = false;
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        hasImage = true;
        void handleUploadImage(file);
      }

      if (hasImage) {
        event.preventDefault();
      }
      return hasImage;
    },
    [handleUploadImage],
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
        void handleUploadImage(file);
      });
      return true;
    },
    [handleUploadImage],
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;

    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          class: editorContentClassName,
        },
        handlePaste: handlePasteImage,
        handleDrop: handleDropImage,
      },
    });
  }, [editor, editorContentClassName, handleDropImage, handlePasteImage]);

  useEffect(() => {
    if (!editor) return;
    if (normalizedHtml.length > 0) {
      if (normalizedHtml === lastEmittedHtmlRef.current) return;
      const current = injectHeadingIds(editor.getHTML().trim());
      if (normalizedHtml === current) return;

      editor.commands.setContent(normalizedHtml, { emitUpdate: false });
      return;
    }

    if (normalizedHtmlFromJson) {
      if (normalizedHtmlFromJson === lastEmittedHtmlRef.current) return;
      const current = injectHeadingIds(editor.getHTML().trim());
      if (normalizedHtmlFromJson === current) return;

      editor.commands.setContent(normalizedHtmlFromJson, { emitUpdate: true });
      return;
    }

    if (normalizedJson) {
      if (normalizedJsonSignature === lastEmittedJsonRef.current) return;
      const currentJsonSignature = toStableJsonString(editor.getJSON());
      if (normalizedJsonSignature === currentJsonSignature) return;

      editor.commands.setContent(normalizedJson, { emitUpdate: true });
    }
  }, [editor, normalizedHtml, normalizedHtmlFromJson, normalizedJson, normalizedJsonSignature]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href;
    const value = window.prompt("링크 URL을 입력해 주세요.", previous);
    if (value === null) return;

    if (value.trim().length === 0) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: value.trim() })
      .run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        에디터를 불러오는 중입니다...
      </div>
    );
  }

  const isAlignTargetActive =
    editor.isActive("paragraph") || editor.isActive("heading");
  const isCenterAligned = editor.isActive({ textAlign: AlignDirection.CENTER });
  const isRightAligned = editor.isActive({ textAlign: AlignDirection.RIGHT });
  const isJustified = editor.isActive({ textAlign: AlignDirection.JUSTIFY });
  const isLeftAligned =
    isAlignTargetActive && !isCenterAligned && !isRightAligned && !isJustified;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/70">
        <TooltipProvider>
          <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton
            label="본문"
            title="본문"
            iconOnly
            icon={<Pilcrow className="h-4 w-4" />}
            disabled={disabled}
            active={editor.isActive("paragraph")}
            onClick={() => editor.chain().focus().setParagraph().run()}
          />
          <ToolbarButton
            label="제목 1"
            title="제목 1"
            iconOnly
            icon={<Heading1 className="h-4 w-4" />}
            disabled={disabled}
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarButton
            label="제목 2"
            title="제목 2"
            iconOnly
            icon={<Heading2 className="h-4 w-4" />}
            disabled={disabled}
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            label="제목 3"
            title="제목 3"
            iconOnly
            icon={<Heading3 className="h-4 w-4" />}
            disabled={disabled}
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />

          <div className="mx-1 hidden h-6 w-px bg-slate-300 dark:bg-slate-600 sm:block" />

          <ToolbarButton
            label="왼쪽 정렬"
            title="왼쪽 정렬"
            iconOnly
            icon={<AlignLeft className="h-4 w-4" />}
            disabled={disabled}
            active={isLeftAligned}
            onClick={() =>
              editor.chain().focus().setTextAlign(AlignDirection.LEFT).run()
            }
          />
          <ToolbarButton
            label="가운데 정렬"
            title="가운데 정렬"
            iconOnly
            icon={<AlignCenter className="h-4 w-4" />}
            disabled={disabled}
            active={isCenterAligned}
            onClick={() =>
              editor.chain().focus().setTextAlign(AlignDirection.CENTER).run()
            }
          />
          <ToolbarButton
            label="오른쪽 정렬"
            title="오른쪽 정렬"
            iconOnly
            icon={<AlignRight className="h-4 w-4" />}
            disabled={disabled}
            active={isRightAligned}
            onClick={() =>
              editor.chain().focus().setTextAlign(AlignDirection.RIGHT).run()
            }
          />
          <ToolbarButton
            label="양쪽 정렬"
            title="양쪽 정렬"
            iconOnly
            icon={<AlignJustify className="h-4 w-4" />}
            disabled={disabled}
            active={isJustified}
            onClick={() =>
              editor.chain().focus().setTextAlign(AlignDirection.JUSTIFY).run()
            }
          />

          <div className="mx-1 hidden h-6 w-px bg-slate-300 dark:bg-slate-600 sm:block" />

          <ToolbarButton
            label="굵게"
            title="굵게 (Ctrl+B)"
            iconOnly
            icon={<span className="text-sm font-black">B</span>}
            disabled={disabled}
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="기울임"
            title="기울임 (Ctrl+I)"
            iconOnly
            icon={<span className="text-sm font-semibold italic">I</span>}
            disabled={disabled}
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="밑줄"
            title="밑줄"
            iconOnly
            icon={
              <span className="text-sm font-semibold underline decoration-[1.5px]">
                U
              </span>
            }
            disabled={disabled}
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            label="취소선"
            title="취소선"
            iconOnly
            icon={<span className="text-sm font-semibold line-through">S</span>}
            disabled={disabled}
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />

          <div className="mx-1 hidden h-6 w-px bg-slate-300 dark:bg-slate-600 sm:block" />

          <ToolbarButton
            label="글머리표 목록"
            title="글머리표 목록"
            iconOnly
            icon={<List className="h-4 w-4" />}
            disabled={disabled}
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="번호 목록"
            title="번호 목록"
            iconOnly
            icon={<ListOrdered className="h-4 w-4" />}
            disabled={disabled}
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="강조 박스"
            title="강조 박스"
            iconOnly
            icon={<Quote className="h-4 w-4" />}
            disabled={disabled}
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            label="코드 블록"
            title="코드 블록"
            iconOnly
            icon={<Code2 className="h-4 w-4" />}
            disabled={disabled}
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />

          <div className="mx-1 hidden h-6 w-px bg-slate-300 dark:bg-slate-600 sm:block" />

          <ToolbarButton
            label="링크"
            title="링크"
            iconOnly
            icon={<Link2 className="h-4 w-4" />}
            disabled={disabled}
            active={editor.isActive("link")}
            onClick={addLink}
          />
          <ToolbarButton
            label="이미지"
            title={isUploadingImage ? "이미지 업로드 중..." : "이미지 업로드"}
            iconOnly
            icon={<ImagePlus className="h-4 w-4" />}
            disabled={disabled || isUploadingImage}
            onClick={() => imageInputRef.current?.click()}
          />

          <div className="mx-1 hidden h-6 w-px bg-slate-300 dark:bg-slate-600 sm:block" />

          <ToolbarButton
            label="실행 취소"
            title="실행 취소"
            iconOnly
            icon={<Undo2 className="h-4 w-4" />}
            disabled={disabled || !editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            label="다시 실행"
            title="다시 실행"
            iconOnly
            icon={<Redo2 className="h-4 w-4" />}
            disabled={disabled || !editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          />
          </div>
        </TooltipProvider>
      </div>

      <EditorContent editor={editor} />

      <div className="border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 sm:px-4">
        <span>Ctrl+V 붙여넣기, 드래그앤드롭으로 이미지 업로드가 가능합니다.</span>
      </div>

      {uploadErrorMessage ? (
        <p className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 sm:px-4">
          {uploadErrorMessage}
        </p>
      ) : null}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void onImageInputChange(event);
        }}
      />
    </div>
  );
}
