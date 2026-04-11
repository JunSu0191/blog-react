import type { DragEvent } from "react";
import { Edit3, GripHorizontal, MoveHorizontal, Trash2 } from "lucide-react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import {
  createTwoColumnSlotImage,
  readEditorMediaDragPayload,
  removeTwoColumnSlot,
  swapPayloadWithTwoColumnSlot,
  swapTwoColumnSlots,
  type TwoColumnSlot,
  writeEditorMediaDragPayload,
} from "./mediaSwap";

export default function TwoColumnImagesNodeView({
  editor,
  getPos,
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps<HTMLDivElement>) {
  const position = getPos();
  const leftImage = createTwoColumnSlotImage(
    node.attrs as Record<string, unknown>,
    "left",
  );
  const rightImage = createTwoColumnSlotImage(
    node.attrs as Record<string, unknown>,
    "right",
  );

  const editSlotCaption = (slot: TwoColumnSlot) => {
    const currentCaption = slot === "left" ? leftImage.caption : rightImage.caption;
    const nextCaption = window.prompt(
      `${slot === "left" ? "왼쪽" : "오른쪽"} 이미지 캡션을 입력해 주세요.`,
      currentCaption ?? "",
    );
    if (nextCaption === null) return;

    updateAttributes({
      [slot === "left" ? "leftCaption" : "rightCaption"]:
        nextCaption.trim() || null,
    });
  };

  const handleSlotDragStart =
    (slot: TwoColumnSlot) => (event: DragEvent<HTMLElement>) => {
      if (typeof position !== "number") return;

      writeEditorMediaDragPayload(event.dataTransfer, {
        kind: "twoColumnSlot",
        pos: position,
        slot,
        image: slot === "left" ? leftImage : rightImage,
      });
    };

  const handleSlotDrop =
    (slot: TwoColumnSlot) => (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (typeof position !== "number") return;

      const payload = readEditorMediaDragPayload(event.dataTransfer);
      if (!payload) return;

      swapPayloadWithTwoColumnSlot(editor, payload, position, slot);
    };

  const handleSwap = () => {
    if (typeof position !== "number") return;
    swapTwoColumnSlots(editor, position);
  };

  const handleRemoveSlot = (slot: TwoColumnSlot) => {
    if (typeof position !== "number") return;
    removeTwoColumnSlot(editor, position, slot);
  };

  const renderSlot = (
    slot: TwoColumnSlot,
    image: ReturnType<typeof createTwoColumnSlotImage>,
  ) => (
    <figure
      key={slot}
      className="two-column-images-cell"
      data-two-column-side={slot}
      draggable
      onDragStart={handleSlotDragStart(slot)}
      onDragOver={(event) => {
        if (readEditorMediaDragPayload(event.dataTransfer)) {
          event.preventDefault();
        }
      }}
      onDrop={handleSlotDrop(slot)}
    >
      <div className="two-column-slot-toolbar">
        <span className="two-column-slot-label">
          <GripHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          {slot === "left" ? "왼쪽" : "오른쪽"}
        </span>
        <div className="two-column-slot-actions">
          <button
            type="button"
            onClick={() => editSlotCaption(slot)}
            aria-label={`${slot === "left" ? "왼쪽" : "오른쪽"} 이미지 캡션 편집`}
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleRemoveSlot(slot)}
            aria-label={`${slot === "left" ? "왼쪽" : "오른쪽"} 이미지 제거`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <img
        src={image.src}
        alt={image.alt ?? ""}
        className="editor-image"
        data-two-column-image={slot}
      />
      {image.caption ? (
        <figcaption className="two-column-images-caption">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );

  return (
    <NodeViewWrapper
      as="figure"
      className={[
        "two-column-images-node group relative my-[1.35rem]",
        selected ? "is-selected" : "",
      ].join(" ")}
      contentEditable={false}
      data-type="two-column-images"
    >
      <div className="two-column-images-toolbar">
        <span className="two-column-images-toolbar-label">
          <GripHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          좌우 2열 이미지
        </span>
        <button type="button" onClick={handleSwap} aria-label="좌우 이미지 서로 바꾸기">
          <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          좌우 교체
        </button>
      </div>
      <div className="two-column-images-grid">
        {renderSlot("left", leftImage)}
        {renderSlot("right", rightImage)}
      </div>
    </NodeViewWrapper>
  );
}
