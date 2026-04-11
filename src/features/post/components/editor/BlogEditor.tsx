import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import {
  AlertTriangle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  CheckSquare2,
  Code2,
  Columns2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Info,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Table2,
  Undo2,
} from "lucide-react";
import {
  TusUploadStage,
  type TusUploadStage as TusUploadStageType,
} from "../../tusUpload";
import type { JsonValue, PostTocItem } from "../../types/api";
import { extractTocFromHtml, injectHeadingIds } from "../../utils/postContent";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type CalloutTone } from "./extensions/Callout";
import { TextAlignValue } from "./extensions/TextAlign";
import {
  normalizePostContentJson,
  renderPostContentHtmlFromJson,
} from "./postEditorContent";
import { createPostEditorExtensions } from "./postEditorExtensions";

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
  onUploadImage: (
    file: File,
    options?: {
      onStageChange?: (stage: TusUploadStageType) => void;
    },
  ) => Promise<string>;
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

type ToolbarSectionProps = {
  label: string;
  children: ReactNode;
};

type SlashCommandDescriptor = {
  id: string;
  label: string;
  description: string;
  group: string;
  keywords: string[];
  icon: ReactNode;
};

type SlashMenuState = {
  from: number;
  to: number;
  query: string;
  top: number;
  left: number;
};

type UploadedImageAsset = {
  src: string;
  alt: string;
};

type PendingImageInsertMode = "single" | "two-column";

const SLASH_MENU_WIDTH_PX = 320;
const SLASH_MENU_ESTIMATED_HEIGHT_PX = 360;

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

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

function getUploadStageLabel(stage: TusUploadStageType) {
  if (stage === TusUploadStage.COMPLETING) {
    return "최종 저장 요청 중...";
  }
  if (stage === TusUploadStage.COMPLETED) {
    return "업로드 완료";
  }
  return "업로드 중...";
}

function toImageAltText(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "").trim();
  return withoutExtension || "본문 이미지";
}

function resolveSlashMenuState(
  currentEditor: Editor,
  rootElement: HTMLElement | null,
): SlashMenuState | null {
  const { state, view } = currentEditor;
  if (!state.selection.empty) return null;
  if (!rootElement) return null;

  const { $from } = state.selection;
  const parent = $from.parent;
  if (!parent.isTextblock) return null;

  const textBeforeCursor = parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    "\ufffc",
  );
  const matched = textBeforeCursor.match(/(?:^|\s)\/([^\s/]*)$/);
  if (!matched) return null;

  const slashToken = matched[0].startsWith(" ")
    ? matched[0].slice(1)
    : matched[0];
  const from = state.selection.from - slashToken.length;
  const to = state.selection.from;
  const coords = view.coordsAtPos(state.selection.from);
  const rootRect = rootElement.getBoundingClientRect();
  const horizontalPadding = 12;
  const minLeft = 12;
  const maxLeft = Math.max(
    rootRect.width - SLASH_MENU_WIDTH_PX - horizontalPadding,
    minLeft,
  );
  const localLeft = coords.left - rootRect.left - 12;
  const spaceBelow = window.innerHeight - coords.bottom - 16;
  const shouldFlipAbove =
    spaceBelow < 220 && coords.top - SLASH_MENU_ESTIMATED_HEIGHT_PX > 16;
  const resolvedTop = shouldFlipAbove
    ? Math.max(
        coords.top - rootRect.top - SLASH_MENU_ESTIMATED_HEIGHT_PX - 12,
        12,
      )
    : coords.bottom - rootRect.top + 10;

  return {
    from,
    to,
    query: matched[1] ?? "",
    top: resolvedTop,
    left: Math.min(Math.max(localLeft, minLeft), maxLeft),
  };
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
            "inline-flex items-center justify-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm",
            iconOnly ? "h-9 w-9 px-0" : "",
            active
              ? "border-blue-300 bg-blue-600 text-white shadow-[0_16px_30px_-22px_rgba(37,99,235,0.9)] dark:border-blue-500 dark:bg-blue-500 dark:text-slate-950"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        >
          {icon ? <span aria-hidden="true">{icon}</span> : null}
          {iconOnly ? <span className="sr-only">{label}</span> : label}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
      >
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarSection({ label, children }: ToolbarSectionProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white/90 px-2.5 py-2 dark:border-slate-700/80 dark:bg-slate-900/80">
      <span className="mr-1 hidden text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 xl:inline-flex dark:text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}

const BASE_SLASH_COMMANDS: readonly SlashCommandDescriptor[] = [
  {
    id: "paragraph",
    label: "본문",
    description: "일반 문단으로 이어서 작성합니다.",
    group: "기본 블록",
    keywords: ["본문", "문단", "text", "paragraph"],
    icon: <Pilcrow className="h-4 w-4" />,
  },
  {
    id: "heading-1",
    label: "제목 1",
    description: "가장 강한 섹션 제목을 넣습니다.",
    group: "기본 블록",
    keywords: ["제목1", "h1", "heading"],
    icon: <Heading1 className="h-4 w-4" />,
  },
  {
    id: "heading-2",
    label: "제목 2",
    description: "본문의 주요 구획을 나눕니다.",
    group: "기본 블록",
    keywords: ["제목2", "h2", "heading"],
    icon: <Heading2 className="h-4 w-4" />,
  },
  {
    id: "heading-3",
    label: "제목 3",
    description: "세부 단락 구성을 정리합니다.",
    group: "기본 블록",
    keywords: ["제목3", "h3", "heading"],
    icon: <Heading3 className="h-4 w-4" />,
  },
  {
    id: "blockquote",
    label: "인용문",
    description: "강조 인용이나 본문 하이라이트를 넣습니다.",
    group: "기본 블록",
    keywords: ["인용", "quote", "blockquote"],
    icon: <Quote className="h-4 w-4" />,
  },
  {
    id: "code-block",
    label: "코드 블록",
    description: "코드 예시나 설정 블록을 넣습니다.",
    group: "기본 블록",
    keywords: ["코드", "code", "snippet"],
    icon: <Code2 className="h-4 w-4" />,
  },
  {
    id: "divider",
    label: "구분선",
    description: "본문 섹션을 시각적으로 분리합니다.",
    group: "기본 블록",
    keywords: ["구분선", "divider", "hr", "line"],
    icon: <Minus className="h-4 w-4" />,
  },
  {
    id: "bullet-list",
    label: "글머리표 리스트",
    description: "순서가 없는 목록을 만듭니다.",
    group: "리스트",
    keywords: ["리스트", "목록", "bullet", "list"],
    icon: <List className="h-4 w-4" />,
  },
  {
    id: "ordered-list",
    label: "번호 리스트",
    description: "순서가 필요한 단계를 정리합니다.",
    group: "리스트",
    keywords: ["번호", "ordered", "list"],
    icon: <ListOrdered className="h-4 w-4" />,
  },
  {
    id: "task-list",
    label: "체크리스트",
    description: "할 일이나 검수 항목을 체크합니다.",
    group: "리스트",
    keywords: ["체크", "todo", "task", "checklist"],
    icon: <CheckSquare2 className="h-4 w-4" />,
  },
  {
    id: "image",
    label: "이미지",
    description: "단일 이미지를 업로드해 삽입합니다.",
    group: "삽입",
    keywords: ["이미지", "사진", "image", "photo"],
    icon: <ImagePlus className="h-4 w-4" />,
  },
  {
    id: "two-column-images",
    label: "좌우 2열 이미지",
    description: "이미지 두 장을 왼쪽/오른쪽 반반으로 배치합니다.",
    group: "삽입",
    keywords: ["2열", "반반", "좌우", "two", "columns", "gallery"],
    icon: <Columns2 className="h-4 w-4" />,
  },
  {
    id: "table",
    label: "표",
    description: "블로그 본문 안에서 간단한 표를 바로 편집합니다.",
    group: "삽입",
    keywords: ["표", "테이블", "table", "grid"],
    icon: <Table2 className="h-4 w-4" />,
  },
  {
    id: "link-card",
    label: "링크 카드",
    description: "외부 링크를 카드 형태로 삽입합니다.",
    group: "삽입",
    keywords: ["링크", "카드", "url", "link", "embed"],
    icon: <Link2 className="h-4 w-4" />,
  },
  {
    id: "callout-info",
    label: "정보 콜아웃",
    description: "설명성 메모 블록을 넣습니다.",
    group: "삽입",
    keywords: ["콜아웃", "정보", "info", "note"],
    icon: <Info className="h-4 w-4" />,
  },
  {
    id: "callout-tip",
    label: "팁 콜아웃",
    description: "작성 팁이나 요령을 강조합니다.",
    group: "삽입",
    keywords: ["팁", "tip", "callout"],
    icon: <Lightbulb className="h-4 w-4" />,
  },
  {
    id: "callout-warning",
    label: "주의 콜아웃",
    description: "주의사항이나 경고를 강조합니다.",
    group: "삽입",
    keywords: ["주의", "warning", "alert", "callout"],
    icon: <AlertTriangle className="h-4 w-4" />,
  },
];

export default function BlogEditor({
  valueHtml,
  valueJson,
  placeholder = "본문을 작성해 주세요.",
  disabled = false,
  fullScreen = false,
  onChange,
  onUploadImage,
}: BlogEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const slashMenuListRef = useRef<HTMLDivElement>(null);
  const lastEmittedHtmlRef = useRef<string>("");
  const lastEmittedJsonRef = useRef<string>("");
  const [pendingImageInsertMode, setPendingImageInsertMode] =
    useState<PendingImageInsertMode>("single");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadStage, setUploadStage] = useState<TusUploadStageType>(
    TusUploadStage.UPLOADING,
  );
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(
    null,
  );
  const [slashMenuState, setSlashMenuState] = useState<SlashMenuState | null>(
    null,
  );
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const normalizedHtml = valueHtml.trim();
  const normalizedHtmlFromJson = useMemo(
    () => renderPostContentHtmlFromJson(valueJson),
    [valueJson],
  );
  const normalizedJson = useMemo(
    () => normalizePostContentJson(valueJson),
    [valueJson],
  );
  const normalizedJsonSignature = useMemo(
    () => toStableJsonString(normalizedJson),
    [normalizedJson],
  );

  const initialContent = useMemo(() => {
    if (normalizedJson) return normalizedJson;
    if (normalizedHtmlFromJson) return normalizedHtmlFromJson;
    if (normalizedHtml.length > 0) return normalizedHtml;
    return "<p></p>";
  }, [normalizedHtml, normalizedHtmlFromJson, normalizedJson]);

  const editorContentClassName = useMemo(
    () =>
      [
        "toss-editor-content editor-compose prose prose-slate max-w-none break-words focus:outline-none dark:prose-invert dark:text-slate-100",
        fullScreen
          ? "min-h-[calc(100dvh-23rem)] px-6 py-6 text-[17px] leading-[1.72] sm:px-7 sm:py-7"
          : "min-h-[420px] px-5 py-5 text-[16px] leading-[1.7] sm:px-6 sm:py-6",
      ].join(" "),
    [fullScreen],
  );
  const editorExtensions = useMemo(
    () => createPostEditorExtensions({ placeholder }),
    [placeholder],
  );

  const editor = useEditor({
    extensions: editorExtensions,
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

  const openImagePicker = useCallback((mode: PendingImageInsertMode) => {
    setPendingImageInsertMode(mode);
    imageInputRef.current?.click();
  }, []);

  const insertUploadedAssets = useCallback(
    (assets: UploadedImageAsset[], preferPairs: boolean) => {
      if (!editor || assets.length === 0) return;

      const nextNodes: JSONContent[] = [];
      const shouldPair = preferPairs && assets.length > 1;

      if (!shouldPair) {
        assets.forEach((asset) => {
          nextNodes.push(
            {
              type: "editorialImage",
              attrs: {
                src: asset.src,
                alt: asset.alt,
              },
            },
            {
              type: "paragraph",
            },
          );
        });
      } else {
        for (let index = 0; index < assets.length; index += 2) {
          const left = assets[index];
          const right = assets[index + 1];

          if (left && right) {
            nextNodes.push(
              {
                type: "twoColumnImages",
                attrs: {
                  leftSrc: left.src,
                  rightSrc: right.src,
                  leftAlt: left.alt,
                  rightAlt: right.alt,
                },
              },
              {
                type: "paragraph",
              },
            );
            continue;
          }

          if (left) {
            nextNodes.push(
              {
                type: "editorialImage",
                attrs: {
                  src: left.src,
                  alt: left.alt,
                },
              },
              {
                type: "paragraph",
              },
            );
          }
        }
      }

      editor.chain().focus().insertContent(nextNodes).run();
    },
    [editor],
  );

  const uploadImageFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) return [];

      setUploadErrorMessage(null);
      setIsUploadingImage(true);
      setUploadStage(TusUploadStage.UPLOADING);

      const uploadedAssets: UploadedImageAsset[] = [];
      let uploadFailure: unknown = null;

      for (const file of imageFiles) {
        try {
          const uploadedUrl = await onUploadImage(file, {
            onStageChange: setUploadStage,
          });
          uploadedAssets.push({
            src: uploadedUrl,
            alt: toImageAltText(file.name),
          });
        } catch (error) {
          uploadFailure = error;
          break;
        }
      }

      if (uploadFailure) {
        setUploadErrorMessage(toErrorMessage(uploadFailure));
      }

      setIsUploadingImage(false);
      return uploadedAssets;
    },
    [onUploadImage],
  );

  const uploadAndInsertImageFiles = useCallback(
    async (files: File[], preferPairs: boolean) => {
      const uploadedAssets = await uploadImageFiles(files);
      if (uploadedAssets.length > 0) {
        insertUploadedAssets(uploadedAssets, preferPairs);
      }
    },
    [insertUploadedAssets, uploadImageFiles],
  );

  const onImageInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";

      if (files.length === 0) return;

      if (pendingImageInsertMode === "two-column" && files.length < 2) {
        setUploadErrorMessage("좌우 2열 이미지는 이미지를 두 장 이상 선택해야 합니다.");
        return;
      }

      const shouldPair =
        pendingImageInsertMode === "two-column" || files.length > 1;
      await uploadAndInsertImageFiles(files, shouldPair);
      setPendingImageInsertMode("single");
    },
    [pendingImageInsertMode, uploadAndInsertImageFiles],
  );

  const handlePasteImage = useCallback(
    (_view: unknown, event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return false;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return false;

      event.preventDefault();
      void uploadAndInsertImageFiles(imageFiles, imageFiles.length > 1);
      return true;
    },
    [uploadAndInsertImageFiles],
  );

  const handleDropImage = useCallback(
    (_view: unknown, event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) return false;

      event.preventDefault();
      void uploadAndInsertImageFiles(imageFiles, imageFiles.length > 1);
      return true;
    },
    [uploadAndInsertImageFiles],
  );

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

  const applyCalloutTone = useCallback(
    (tone: CalloutTone) => {
      if (!editor) return;

      if (editor.isActive("callout")) {
        editor.chain().focus().updateAttributes("callout", { tone }).run();
        return;
      }

      editor.chain().focus().setCallout({ tone }).run();
    },
    [editor],
  );

  const editSelectedVisualCaption = useCallback(() => {
    if (!editor) return;

    if (editor.isActive("twoColumnImages")) {
      const attributes = editor.getAttributes("twoColumnImages");
      const nextLeftCaption = window.prompt(
        "왼쪽 이미지 캡션을 입력해 주세요.",
        typeof attributes.leftCaption === "string" ? attributes.leftCaption : "",
      );
      if (nextLeftCaption === null) return;

      const nextRightCaption = window.prompt(
        "오른쪽 이미지 캡션을 입력해 주세요.",
        typeof attributes.rightCaption === "string"
          ? attributes.rightCaption
          : "",
      );
      if (nextRightCaption === null) return;

      editor
        .chain()
        .focus()
        .updateAttributes("twoColumnImages", {
          leftCaption: nextLeftCaption.trim() || null,
          rightCaption: nextRightCaption.trim() || null,
        })
        .run();
      return;
    }

    if (editor.isActive("editorialImage")) {
      const attributes = editor.getAttributes("editorialImage");
      const nextCaption = window.prompt(
        "이미지 캡션을 입력해 주세요.",
        typeof attributes.caption === "string" ? attributes.caption : "",
      );
      if (nextCaption === null) return;

      editor
        .chain()
        .focus()
        .updateAttributes("editorialImage", {
          caption: nextCaption.trim() || null,
        })
        .run();
    }
  }, [editor]);

  const insertSimpleTable = useCallback(() => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .setSimpleTable({
        rows: [
          ["제목", "항목", "설명"],
          ["", "", ""],
          ["", "", ""],
        ],
        hasHeaderRow: true,
      })
      .run();
  }, [editor]);

  const insertLinkCard = useCallback(() => {
    if (!editor) return;

    const rawValue = window.prompt("링크 URL을 입력해 주세요.", "https://");
    if (rawValue === null) return;

    const trimmed = rawValue.trim();
    if (!trimmed) return;

    const normalizedUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    try {
      const url = new URL(normalizedUrl);
      const pathnameLabel =
        url.pathname
          .split("/")
          .filter(Boolean)
          .at(-1)
          ?.replace(/[-_]+/g, " ") ?? "";

      editor
        .chain()
        .focus()
        .setLinkCard({
          url: url.toString(),
          domain: url.hostname.replace(/^www\./, ""),
          title:
            pathnameLabel.trim().length > 0
              ? pathnameLabel
              : url.hostname.replace(/^www\./, ""),
          description: "외부 문서, 레퍼런스, 참고 링크를 카드로 정리합니다.",
        })
        .run();
    } catch {
      setUploadErrorMessage("유효한 링크 URL을 입력해 주세요.");
    }
  }, [editor]);

  const runSlashCommandById = useCallback(
    (commandId: string) => {
      if (!editor) return;

      switch (commandId) {
        case "paragraph":
          editor.chain().focus().setParagraph().run();
          return;
        case "heading-1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          return;
        case "heading-2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          return;
        case "heading-3":
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          return;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          return;
        case "code-block":
          editor.chain().focus().toggleCodeBlock().run();
          return;
        case "divider":
          editor.chain().focus().setHorizontalRule().run();
          return;
        case "bullet-list":
          editor.chain().focus().toggleBulletList().run();
          return;
        case "ordered-list":
          editor.chain().focus().toggleOrderedList().run();
          return;
        case "task-list":
          editor.chain().focus().toggleTaskList().run();
          return;
        case "image":
          openImagePicker("single");
          return;
        case "two-column-images":
          openImagePicker("two-column");
          return;
        case "table":
          insertSimpleTable();
          return;
        case "link-card":
          insertLinkCard();
          return;
        case "callout-info":
          applyCalloutTone("info");
          return;
        case "callout-tip":
          applyCalloutTone("tip");
          return;
        case "callout-warning":
          applyCalloutTone("warning");
          return;
        default:
          return;
      }
    },
    [applyCalloutTone, editor, insertLinkCard, insertSimpleTable, openImagePicker],
  );

  const filteredSlashCommands = useMemo(() => {
    const query = slashMenuState?.query.trim().toLocaleLowerCase() ?? "";
    if (!query) return BASE_SLASH_COMMANDS;

    return BASE_SLASH_COMMANDS.filter((command) => {
      const corpus = [
        command.label,
        command.description,
        ...command.keywords,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return corpus.includes(query);
    });
  }, [slashMenuState?.query]);

  const executeSlashCommand = useCallback(
    (command: SlashCommandDescriptor) => {
      if (!editor || !slashMenuState) return;

      editor
        .chain()
        .focus()
        .deleteRange({
          from: slashMenuState.from,
          to: slashMenuState.to,
        })
        .run();
      runSlashCommandById(command.id);
      setSlashMenuState(null);
      setSelectedSlashIndex(0);
    },
    [editor, runSlashCommandById, slashMenuState],
  );

  const handleEditorKeyDown = useCallback(
    (_view: unknown, event: KeyboardEvent) => {
      if (!slashMenuState) return false;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (filteredSlashCommands.length === 0) return true;
        setSelectedSlashIndex((prev) =>
          prev + 1 >= filteredSlashCommands.length ? 0 : prev + 1,
        );
        return true;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (filteredSlashCommands.length === 0) return true;
        setSelectedSlashIndex((prev) =>
          prev - 1 < 0 ? filteredSlashCommands.length - 1 : prev - 1,
        );
        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        if (filteredSlashCommands.length === 0) return false;
        event.preventDefault();
        const command = filteredSlashCommands[
          filteredSlashCommands.length === 0
            ? 0
            : Math.min(selectedSlashIndex, filteredSlashCommands.length - 1)
        ];
        if (command) {
          executeSlashCommand(command);
          return true;
        }
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSlashMenuState(null);
        return true;
      }

      return false;
    },
    [executeSlashCommand, filteredSlashCommands, selectedSlashIndex, slashMenuState],
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
        handleKeyDown: handleEditorKeyDown,
      },
    });
  }, [
    editor,
    editorContentClassName,
    handleDropImage,
    handleEditorKeyDown,
    handlePasteImage,
  ]);

  useEffect(() => {
    if (!editor) return;

    const syncSlashMenu = () => {
      setSlashMenuState(resolveSlashMenuState(editor, rootRef.current));
    };

    syncSlashMenu();
    editor.on("update", syncSlashMenu);
    editor.on("selectionUpdate", syncSlashMenu);

    return () => {
      editor.off("update", syncSlashMenu);
      editor.off("selectionUpdate", syncSlashMenu);
    };
  }, [editor]);

  useEffect(() => {
    if (!slashMenuState) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setSlashMenuState(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [slashMenuState]);

  useEffect(() => {
    if (!slashMenuState) return;

    const menuList = slashMenuListRef.current;
    if (!menuList) return;

    const activeItem = menuList.querySelector<HTMLElement>(
      '[data-slash-command-active="true"]',
    );
    if (!activeItem) return;

    requestAnimationFrame(() => {
      activeItem.scrollIntoView({
        block: "nearest",
      });
    });
  }, [filteredSlashCommands, selectedSlashIndex, slashMenuState]);

  useEffect(() => {
    if (!editor) return;

    if (normalizedJson) {
      const currentHtml = injectHeadingIds(editor.getHTML().trim());
      const currentJsonSignature = toStableJsonString(editor.getJSON());
      const shouldSyncJson = normalizedJsonSignature !== currentJsonSignature;
      const shouldSyncHtml = normalizedHtml !== currentHtml;

      if (!shouldSyncJson && !shouldSyncHtml) return;

      editor.commands.setContent(normalizedJson, { emitUpdate: true });
      return;
    }

    if (normalizedHtmlFromJson) {
      if (normalizedHtmlFromJson === lastEmittedHtmlRef.current) return;
      const current = injectHeadingIds(editor.getHTML().trim());
      if (normalizedHtmlFromJson === current) return;

      editor.commands.setContent(normalizedHtmlFromJson, { emitUpdate: true });
      return;
    }

    if (normalizedHtml.length > 0) {
      if (normalizedHtml === lastEmittedHtmlRef.current) return;
      const current = injectHeadingIds(editor.getHTML().trim());
      if (normalizedHtml === current) return;

      editor.commands.setContent(normalizedHtml, { emitUpdate: false });
    }
  }, [
    editor,
    normalizedHtml,
    normalizedHtmlFromJson,
    normalizedJson,
    normalizedJsonSignature,
  ]);

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
  const canEditVisualCaption =
    editor.isActive("editorialImage") || editor.isActive("twoColumnImages");
  const effectiveSelectedSlashIndex =
    filteredSlashCommands.length === 0
      ? 0
      : Math.min(selectedSlashIndex, filteredSlashCommands.length - 1);
  const slashCommandGroups = Array.from(
    filteredSlashCommands.reduce(
      (groupMap, command) => {
        const current = groupMap.get(command.group) ?? [];
        current.push(command);
        groupMap.set(command.group, current);
        return groupMap;
      },
      new Map<string, SlashCommandDescriptor[]>(),
    ),
  );

  return (
    <div ref={rootRef} className="relative">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void onImageInputChange(event);
        }}
      />

      <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.96))] px-3 py-3 dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Editorial Composer
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              `/`로 블록을 빠르게 삽입하고, 이미지 두 장은 좌우 2열로 붙일 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              `/ 이미지`
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              `/ 좌우 2열 이미지`
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              `/ 콜아웃`
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              `/ 표`
            </span>
          </div>
        </div>

        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            <ToolbarSection label="텍스트">
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
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
              />
              <ToolbarButton
                label="제목 2"
                title="제목 2"
                iconOnly
                icon={<Heading2 className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("heading", { level: 2 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
              />
              <ToolbarButton
                label="제목 3"
                title="제목 3"
                iconOnly
                icon={<Heading3 className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("heading", { level: 3 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
              />
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
              <ToolbarButton
                label="링크"
                title="링크 추가"
                iconOnly
                icon={<Link2 className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("link")}
                onClick={addLink}
              />
            </ToolbarSection>

            <ToolbarSection label="구조">
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
                label="체크리스트"
                title="체크리스트"
                iconOnly
                icon={<CheckSquare2 className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("taskList")}
                onClick={() => editor.chain().focus().toggleTaskList().run()}
              />
              <ToolbarButton
                label="인용문"
                title="인용문"
                iconOnly
                icon={<Quote className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
              <ToolbarButton
                label="코드블록"
                title="코드블록"
                iconOnly
                icon={<Code2 className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("codeBlock")}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              />
              <ToolbarButton
                label="구분선"
                title="구분선"
                iconOnly
                icon={<Minus className="h-4 w-4" />}
                disabled={disabled}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              />
              <ToolbarButton
                label="정보 콜아웃"
                title="정보 콜아웃"
                iconOnly
                icon={<Info className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("callout", { tone: "info" })}
                onClick={() => applyCalloutTone("info")}
              />
              <ToolbarButton
                label="팁 콜아웃"
                title="팁 콜아웃"
                iconOnly
                icon={<Lightbulb className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("callout", { tone: "tip" })}
                onClick={() => applyCalloutTone("tip")}
              />
              <ToolbarButton
                label="주의 콜아웃"
                title="주의 콜아웃"
                iconOnly
                icon={<AlertTriangle className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("callout", { tone: "warning" })}
                onClick={() => applyCalloutTone("warning")}
              />
            </ToolbarSection>

            <ToolbarSection label="정렬">
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
                  editor
                    .chain()
                    .focus()
                    .setTextAlign(AlignDirection.CENTER)
                    .run()
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
                  editor
                    .chain()
                    .focus()
                    .setTextAlign(AlignDirection.JUSTIFY)
                    .run()
                }
              />
            </ToolbarSection>

            <ToolbarSection label="삽입">
              <ToolbarButton
                label="이미지"
                title="이미지"
                iconOnly
                icon={<ImagePlus className="h-4 w-4" />}
                disabled={disabled || isUploadingImage}
                onClick={() => openImagePicker("single")}
              />
              <ToolbarButton
                label="좌우 2열 이미지"
                title="좌우 2열 이미지"
                iconOnly
                icon={<Columns2 className="h-4 w-4" />}
                disabled={disabled || isUploadingImage}
                active={editor.isActive("twoColumnImages")}
                onClick={() => openImagePicker("two-column")}
              />
              <ToolbarButton
                label="표"
                title="표 삽입"
                iconOnly
                icon={<Table2 className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("simpleTable")}
                onClick={insertSimpleTable}
              />
              <ToolbarButton
                label="링크 카드"
                title="링크 카드 삽입"
                iconOnly
                icon={<Link2 className="h-4 w-4" />}
                disabled={disabled}
                active={editor.isActive("linkCard")}
                onClick={insertLinkCard}
              />
              <ToolbarButton
                label="캡션 편집"
                title="이미지 캡션 편집"
                disabled={disabled || !canEditVisualCaption}
                onClick={editSelectedVisualCaption}
              />
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
            </ToolbarSection>
          </div>
        </TooltipProvider>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            붙여넣기 이미지 2장은 자동으로 좌우 2열로 배치되고 드래그로 교체할 수 있습니다.
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            이미지, 표, 링크 카드는 모두 본문 안에서 바로 편집됩니다.
          </span>
        </div>

        {isUploadingImage ? (
          <p className="mt-3 text-xs font-medium text-blue-600 dark:text-blue-300">
            {getUploadStageLabel(uploadStage)}
          </p>
        ) : null}
        {uploadErrorMessage ? (
          <p className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {uploadErrorMessage}
          </p>
        ) : null}
      </div>

      <EditorContent editor={editor} />
      </div>

      {slashMenuState ? (
        <div
          className="absolute z-[160] w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900"
          style={{
            top: slashMenuState.top,
            left: slashMenuState.left,
          }}
        >
          <div className="border-b border-slate-200 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:border-slate-700 dark:text-slate-500">
            블록 명령
          </div>

          <div
            ref={slashMenuListRef}
            className="max-h-[min(55vh,28rem)] overflow-y-auto p-2"
          >
            {slashCommandGroups.length === 0 ? (
              <div className="rounded-xl px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                일치하는 블록이 없습니다.
              </div>
            ) : (
              slashCommandGroups.map(([group, commands]) => (
                <div key={group} className="pb-2 last:pb-0">
                  <div className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    {group}
                  </div>
                  <div className="space-y-1">
                    {commands.map((command) => {
                      const commandIndex = filteredSlashCommands.findIndex(
                        (candidate) => candidate.id === command.id,
                      );
                      const isActive =
                        commandIndex === effectiveSelectedSlashIndex;

                      return (
                        <button
                          key={command.id}
                          type="button"
                          data-slash-command-active={isActive ? "true" : "false"}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            executeSlashCommand(command);
                          }}
                          className={[
                            "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                            isActive
                              ? "bg-blue-600 text-white shadow-[0_16px_32px_-24px_rgba(37,99,235,0.95)] dark:bg-blue-500 dark:text-white"
                              : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                          ].join(" ")}
                        >
                          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-current/10 bg-current/10">
                            {command.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">
                              {command.label}
                            </span>
                            <span
                              className={[
                                "mt-0.5 block text-xs",
                                isActive
                                  ? "text-white/80"
                                  : "text-slate-500 dark:text-slate-400",
                              ].join(" ")}
                            >
                              {command.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
