import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import UnderlineExtension from "@tiptap/extension-underline";
import { TaskItem } from "@tiptap/extension-list/task-item";
import { TaskList } from "@tiptap/extension-list/task-list";
import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/core";
import Callout from "./extensions/Callout";
import EditorialImage from "./extensions/EditorialImage";
import LinkCard from "./extensions/LinkCard";
import SimpleTable from "./extensions/SimpleTable";
import TextAlign from "./extensions/TextAlign";
import TwoColumnImages from "./extensions/TwoColumnImages";

type CreatePostEditorExtensionsOptions = {
  placeholder?: string;
};

function createBaseExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    UnderlineExtension,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    EditorialImage,
    TwoColumnImages,
    SimpleTable,
    LinkCard,
    Callout,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "editor-link",
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
  ];
}

export function createPostEditorExtensions(
  options: CreatePostEditorExtensionsOptions = {},
): Extensions {
  const extensions = createBaseExtensions();

  if (typeof options.placeholder === "string") {
    extensions.push(
      Placeholder.configure({
        placeholder: options.placeholder,
      }),
    );
  }

  return extensions;
}

export const postRenderExtensions = createBaseExtensions();
