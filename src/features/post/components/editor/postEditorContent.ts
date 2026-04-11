import { generateHTML, type JSONContent } from "@tiptap/core";
import type { JsonValue } from "../../types/api";
import { postRenderExtensions } from "./postEditorExtensions";

function normalizeHtmlValue(value: unknown): string | undefined {
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
    const normalized = normalizeHtmlValue(candidate);
    if (normalized) return normalized;
  }

  return undefined;
}

export function normalizePostContentJson(
  value: unknown,
): JSONContent | undefined {
  if (!value) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed) as JsonValue;
      return normalizePostContentJson(parsed);
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
    const normalized = normalizePostContentJson(candidate);
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

  return value as JSONContent;
}

export function normalizePostContentHtml(value: unknown): string | undefined {
  return normalizeHtmlValue(value);
}

export function renderPostContentHtmlFromJson(
  value: unknown,
): string | undefined {
  if (typeof document === "undefined") return undefined;

  const normalizedJson = normalizePostContentJson(value);
  if (!normalizedJson) return undefined;

  try {
    return generateHTML(normalizedJson, postRenderExtensions);
  } catch {
    return undefined;
  }
}

export function resolvePostContentHtml(options: {
  contentHtml?: string;
  contentJson?: JsonValue;
  preferJson?: boolean;
}) {
  const normalizedHtml = normalizePostContentHtml(options.contentHtml);
  const renderedHtmlFromJson = renderPostContentHtmlFromJson(
    options.contentJson,
  );

  if (options.preferJson) {
    return renderedHtmlFromJson || normalizedHtml || "";
  }

  return normalizedHtml || renderedHtmlFromJson || "";
}
