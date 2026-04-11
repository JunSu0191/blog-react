import type { JsonValue } from "./api";

export type PostComposerFormValues = {
  title: string;
  subtitle: string;
  category: string;
  seriesId: string;
  seriesTitle: string;
  seriesOrder: string;
  tagsText: string;
  thumbnailUrl: string;
  contentHtml: string;
  contentJson?: JsonValue;
};

export type PostComposerErrors = Partial<
  Record<
    | "title"
    | "category"
    | "content"
    | "thumbnailUrl"
    | "submit"
    | "draft"
    | "imageUpload",
    string
  >
>;

export type PostEditorChange = {
  html: string;
  json?: JsonValue;
  plainText: string;
};
