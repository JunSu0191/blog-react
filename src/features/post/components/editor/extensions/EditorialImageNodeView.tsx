import type { DragEvent } from "react";
import { Edit3, GripHorizontal, Trash2 } from "lucide-react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import {
  createEditorialImage,
  readEditorMediaDragPayload,
  removeEditorialImage,
  swapPayloadWithEditorialImage,
  writeEditorMediaDragPayload,
} from "./mediaSwap";

export default function EditorialImageNodeView({
  editor,
  getPos,
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps<HTMLDivElement>) {
  const attrs = createEditorialImage(node.attrs as Record<string, unknown>);
  const position = getPos();

  const editCaption = () => {
    const nextCaption = window.prompt(
      "이미지 캡션을 입력해 주세요.",
      attrs.caption ?? "",
    );
    if (nextCaption === null) return;

    updateAttributes({
      caption: nextCaption.trim() || null,
    });
  };

  const handleDelete = () => {
    if (typeof position !== "number") return;
    removeEditorialImage(editor, position);
  };

  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    if (typeof position !== "number") return;
    writeEditorMediaDragPayload(event.dataTransfer, {
      kind: "editorialImage",
      pos: position,
      image: attrs,
    });
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (typeof position !== "number") return;

    const payload = readEditorMediaDragPayload(event.dataTransfer);
    if (!payload) return;

    swapPayloadWithEditorialImage(editor, payload, position);
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={[
        "editorial-image-node group relative my-[1.15rem]",
        selected ? "is-selected" : "",
      ].join(" ")}
      contentEditable={false}
      data-type="editorial-image"
      draggable
      onDragStart={handleDragStart}
      onDragOver={(event: DragEvent<HTMLElement>) => {
        if (readEditorMediaDragPayload(event.dataTransfer)) {
          event.preventDefault();
        }
      }}
      onDrop={handleDrop}
    >
      <div className="editorial-image-shell">
        <div className="editorial-image-toolbar">
          <span className="editorial-image-toolbar-label">
            <GripHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            이미지
          </span>
          <div className="editorial-image-toolbar-actions">
            <button type="button" onClick={editCaption} aria-label="이미지 캡션 편집">
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={handleDelete} aria-label="이미지 삭제">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <img
          src={attrs.src}
          alt={attrs.alt ?? ""}
          title={attrs.title ?? ""}
          className="editor-image"
        />
        {attrs.caption ? (
          <figcaption className="editorial-image-caption">
            {attrs.caption}
          </figcaption>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
