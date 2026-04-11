import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import EditorialImageNodeView from "./EditorialImageNodeView";

export type EditorialImageAttributes = {
  src: string;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    editorialImage: {
      setEditorialImage: (attributes: EditorialImageAttributes) => ReturnType;
    };
  }
}

const EditorialImage = Node.create({
  name: "editorialImage",

  group: "block",

  atom: true,

  draggable: true,

  selectable: true,

  isolating: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      caption: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="editorial-image"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const image = element.querySelector("img");
          if (!image) return false;

          return {
            src: image.getAttribute("src"),
            alt: image.getAttribute("alt"),
            title: image.getAttribute("title"),
            caption: element.querySelector("figcaption")?.textContent?.trim() || null,
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (node) => {
          const element = node as HTMLElement;
          if (element.closest('[data-type="two-column-images"]')) {
            return false;
          }

          return {
            src: element.getAttribute("src"),
            alt: element.getAttribute("alt"),
            title: element.getAttribute("title"),
            caption: null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const caption =
      typeof HTMLAttributes.caption === "string"
        ? HTMLAttributes.caption.trim()
        : "";

    return [
      "figure",
      {
        "data-type": "editorial-image",
        class: "editorial-image-block",
      },
      [
        "img",
        {
          src: String(HTMLAttributes.src ?? ""),
          alt:
            typeof HTMLAttributes.alt === "string" ? HTMLAttributes.alt : "",
          title:
            typeof HTMLAttributes.title === "string"
              ? HTMLAttributes.title
              : "",
          class: "editor-image",
        },
      ],
      ...(caption
        ? [
            [
              "figcaption",
              {
                class: "editorial-image-caption",
              },
              caption,
            ],
          ]
        : []),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditorialImageNodeView);
  },

  addCommands() {
    return {
      setEditorialImage:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent([
            {
              type: this.name,
              attrs: attributes,
            },
            {
              type: "paragraph",
            },
          ]),
    };
  },
});

export default EditorialImage;
