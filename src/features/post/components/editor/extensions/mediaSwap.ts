import type { Editor } from "@tiptap/core";

export const EDITOR_MEDIA_MIME = "application/x-blog-pause-editor-media";

export type TwoColumnSlot = "left" | "right";

export type EditorMediaImage = {
  src: string;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
};

export type EditorMediaDragPayload =
  | {
      kind: "editorialImage";
      pos: number;
      image: EditorMediaImage;
    }
  | {
      kind: "twoColumnSlot";
      pos: number;
      slot: TwoColumnSlot;
      image: EditorMediaImage;
    };

type AttrRecord = Record<string, unknown>;

const SLOT_ATTR_KEYS: Record<
  TwoColumnSlot,
  {
    src: string;
    alt: string;
    caption: string;
  }
> = {
  left: {
    src: "leftSrc",
    alt: "leftAlt",
    caption: "leftCaption",
  },
  right: {
    src: "rightSrc",
    alt: "rightAlt",
    caption: "rightCaption",
  },
};

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isDragPayload(value: unknown): value is EditorMediaDragPayload {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  if (!Number.isInteger(record.pos)) return false;

  if (record.kind === "editorialImage") {
    return true;
  }

  return (
    record.kind === "twoColumnSlot" &&
    (record.slot === "left" || record.slot === "right")
  );
}

export function createEditorialImage(image: AttrRecord): EditorMediaImage {
  return {
    src: normalizeString(image.src) ?? "",
    alt: normalizeString(image.alt),
    title: normalizeString(image.title),
    caption: normalizeString(image.caption),
  };
}

export function createTwoColumnSlotImage(
  attrs: AttrRecord,
  slot: TwoColumnSlot,
): EditorMediaImage {
  const keys = SLOT_ATTR_KEYS[slot];
  return {
    src: normalizeString(attrs[keys.src]) ?? "",
    alt: normalizeString(attrs[keys.alt]),
    caption: normalizeString(attrs[keys.caption]),
  };
}

export function toEditorialImageAttrs(image: EditorMediaImage) {
  return {
    src: image.src,
    alt: image.alt ?? null,
    title: image.title ?? null,
    caption: image.caption ?? null,
  };
}

export function assignTwoColumnSlotImage(
  attrs: AttrRecord,
  slot: TwoColumnSlot,
  image: EditorMediaImage,
) {
  const keys = SLOT_ATTR_KEYS[slot];

  return {
    ...attrs,
    [keys.src]: image.src,
    [keys.alt]: image.alt ?? null,
    [keys.caption]: image.caption ?? null,
  };
}

export function writeEditorMediaDragPayload(
  dataTransfer: DataTransfer,
  payload: EditorMediaDragPayload,
) {
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(EDITOR_MEDIA_MIME, JSON.stringify(payload));
  dataTransfer.setData("text/plain", payload.image.src);
}

export function readEditorMediaDragPayload(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return null;

  const rawPayload = dataTransfer.getData(EDITOR_MEDIA_MIME);
  if (!rawPayload) return null;

  try {
    const parsed = JSON.parse(rawPayload) as unknown;
    return isDragPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function swapPayloadWithTwoColumnSlot(
  editor: Editor,
  payload: EditorMediaDragPayload,
  targetPos: number,
  targetSlot: TwoColumnSlot,
) {
  const { state } = editor.view;
  const targetNode = state.doc.nodeAt(targetPos);
  if (!targetNode || targetNode.type.name !== "twoColumnImages") return false;

  const targetImage = createTwoColumnSlotImage(
    targetNode.attrs as AttrRecord,
    targetSlot,
  );
  const tr = state.tr;

  if (payload.kind === "editorialImage") {
    if (payload.pos === targetPos) return false;

    const sourceNode = tr.doc.nodeAt(payload.pos);
    if (!sourceNode || sourceNode.type.name !== "editorialImage") return false;

    const sourceImage = createEditorialImage(sourceNode.attrs as AttrRecord);
    tr.setNodeMarkup(payload.pos, undefined, {
      ...sourceNode.attrs,
      ...toEditorialImageAttrs(targetImage),
    });

    const refreshedTargetNode = tr.doc.nodeAt(targetPos);
    if (!refreshedTargetNode) return false;

    tr.setNodeMarkup(targetPos, undefined, assignTwoColumnSlotImage(
      refreshedTargetNode.attrs as AttrRecord,
      targetSlot,
      sourceImage,
    ));
  } else {
    const sourceNode = tr.doc.nodeAt(payload.pos);
    if (!sourceNode || sourceNode.type.name !== "twoColumnImages") return false;

    if (payload.pos === targetPos && payload.slot === targetSlot) return false;

    const sourceImage = createTwoColumnSlotImage(
      sourceNode.attrs as AttrRecord,
      payload.slot,
    );

    if (payload.pos === targetPos) {
      tr.setNodeMarkup(targetPos, undefined, assignTwoColumnSlotImage(
        assignTwoColumnSlotImage(
          sourceNode.attrs as AttrRecord,
          payload.slot,
          targetImage,
        ),
        targetSlot,
        sourceImage,
      ));
    } else {
      tr.setNodeMarkup(payload.pos, undefined, assignTwoColumnSlotImage(
        sourceNode.attrs as AttrRecord,
        payload.slot,
        targetImage,
      ));

      const refreshedTargetNode = tr.doc.nodeAt(targetPos);
      if (!refreshedTargetNode) return false;

      tr.setNodeMarkup(targetPos, undefined, assignTwoColumnSlotImage(
        refreshedTargetNode.attrs as AttrRecord,
        targetSlot,
        sourceImage,
      ));
    }
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  return true;
}

export function swapPayloadWithEditorialImage(
  editor: Editor,
  payload: EditorMediaDragPayload,
  targetPos: number,
) {
  const { state } = editor.view;
  const targetNode = state.doc.nodeAt(targetPos);
  if (!targetNode || targetNode.type.name !== "editorialImage") return false;

  const targetImage = createEditorialImage(targetNode.attrs as AttrRecord);
  const tr = state.tr;

  if (payload.kind === "editorialImage") {
    if (payload.pos === targetPos) return false;

    const sourceNode = tr.doc.nodeAt(payload.pos);
    if (!sourceNode || sourceNode.type.name !== "editorialImage") return false;

    const sourceImage = createEditorialImage(sourceNode.attrs as AttrRecord);
    tr.setNodeMarkup(payload.pos, undefined, {
      ...sourceNode.attrs,
      ...toEditorialImageAttrs(targetImage),
    });

    const refreshedTargetNode = tr.doc.nodeAt(targetPos);
    if (!refreshedTargetNode) return false;
    tr.setNodeMarkup(targetPos, undefined, {
      ...refreshedTargetNode.attrs,
      ...toEditorialImageAttrs(sourceImage),
    });
  } else {
    const sourceNode = tr.doc.nodeAt(payload.pos);
    if (!sourceNode || sourceNode.type.name !== "twoColumnImages") return false;

    const sourceImage = createTwoColumnSlotImage(
      sourceNode.attrs as AttrRecord,
      payload.slot,
    );
    tr.setNodeMarkup(payload.pos, undefined, assignTwoColumnSlotImage(
      sourceNode.attrs as AttrRecord,
      payload.slot,
      targetImage,
    ));

    const refreshedTargetNode = tr.doc.nodeAt(targetPos);
    if (!refreshedTargetNode) return false;
    tr.setNodeMarkup(targetPos, undefined, {
      ...refreshedTargetNode.attrs,
      ...toEditorialImageAttrs(sourceImage),
    });
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  return true;
}

export function swapTwoColumnSlots(editor: Editor, pos: number) {
  const node = editor.view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "twoColumnImages") return false;

  const attrs = node.attrs as AttrRecord;
  const leftImage = createTwoColumnSlotImage(attrs, "left");
  const rightImage = createTwoColumnSlotImage(attrs, "right");
  const nextAttrs = assignTwoColumnSlotImage(
    assignTwoColumnSlotImage(attrs, "left", rightImage),
    "right",
    leftImage,
  );

  const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, nextAttrs);
  editor.view.dispatch(tr);
  return true;
}

export function removeTwoColumnSlot(editor: Editor, pos: number, slot: TwoColumnSlot) {
  const { state } = editor.view;
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "twoColumnImages") return false;

  const remainingSlot: TwoColumnSlot = slot === "left" ? "right" : "left";
  const remainingImage = createTwoColumnSlotImage(
    node.attrs as AttrRecord,
    remainingSlot,
  );
  const editorialImageType = state.schema.nodes.editorialImage;
  if (!editorialImageType) return false;

  const replacementNode = editorialImageType.create(
    toEditorialImageAttrs(remainingImage),
  );
  const tr = state.tr.replaceWith(pos, pos + node.nodeSize, replacementNode);
  editor.view.dispatch(tr);
  return true;
}

export function removeEditorialImage(editor: Editor, pos: number) {
  const { state } = editor.view;
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "editorialImage") return false;

  const tr = state.tr.delete(pos, pos + node.nodeSize);
  editor.view.dispatch(tr);
  return true;
}
