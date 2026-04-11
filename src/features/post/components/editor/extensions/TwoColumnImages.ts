import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import TwoColumnImagesNodeView from "./TwoColumnImagesNodeView";

export type TwoColumnImagesAttributes = {
  leftSrc: string;
  rightSrc: string;
  leftAlt?: string | null;
  rightAlt?: string | null;
  leftCaption?: string | null;
  rightCaption?: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    twoColumnImages: {
      setTwoColumnImages: (attributes: TwoColumnImagesAttributes) => ReturnType;
    };
  }
}

const TwoColumnImages = Node.create({
  name: "twoColumnImages",

  group: "block",

  atom: true,

  draggable: true,

  selectable: true,

  isolating: true,

  addAttributes() {
    return {
      leftSrc: {
        default: null,
      },
      rightSrc: {
        default: null,
      },
      leftAlt: {
        default: null,
      },
      rightAlt: {
        default: null,
      },
      leftCaption: {
        default: null,
      },
      rightCaption: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="two-column-images"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const leftImage = element.querySelector(
            '[data-two-column-side="left"] img',
          );
          const rightImage = element.querySelector(
            '[data-two-column-side="right"] img',
          );

          if (!leftImage || !rightImage) return false;

          return {
            leftSrc: leftImage.getAttribute("src"),
            rightSrc: rightImage.getAttribute("src"),
            leftAlt: leftImage.getAttribute("alt"),
            rightAlt: rightImage.getAttribute("alt"),
            leftCaption:
              element
                .querySelector('[data-two-column-side="left"] figcaption')
                ?.textContent?.trim() || null,
            rightCaption:
              element
                .querySelector('[data-two-column-side="right"] figcaption')
                ?.textContent?.trim() || null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const leftCaption =
      typeof HTMLAttributes.leftCaption === "string"
        ? HTMLAttributes.leftCaption.trim()
        : "";
    const rightCaption =
      typeof HTMLAttributes.rightCaption === "string"
        ? HTMLAttributes.rightCaption.trim()
        : "";

    return [
      "figure",
      {
        "data-type": "two-column-images",
        class: "two-column-images-block",
      },
      [
        "div",
        {
          class: "two-column-images-grid",
        },
        [
          "figure",
          {
            class: "two-column-images-cell",
            "data-two-column-side": "left",
          },
          [
            "img",
            {
              src: String(HTMLAttributes.leftSrc ?? ""),
              alt:
                typeof HTMLAttributes.leftAlt === "string"
                  ? HTMLAttributes.leftAlt
                  : "",
              class: "editor-image",
              "data-two-column-image": "left",
            },
          ],
          ...(leftCaption
            ? [
                [
                  "figcaption",
                  {
                    class: "two-column-images-caption",
                  },
                  leftCaption,
                ],
              ]
            : []),
        ],
        [
          "figure",
          {
            class: "two-column-images-cell",
            "data-two-column-side": "right",
          },
          [
            "img",
            {
              src: String(HTMLAttributes.rightSrc ?? ""),
              alt:
                typeof HTMLAttributes.rightAlt === "string"
                  ? HTMLAttributes.rightAlt
                  : "",
              class: "editor-image",
              "data-two-column-image": "right",
            },
          ],
          ...(rightCaption
            ? [
                [
                  "figcaption",
                  {
                    class: "two-column-images-caption",
                  },
                  rightCaption,
                ],
              ]
            : []),
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TwoColumnImagesNodeView);
  },

  addCommands() {
    return {
      setTwoColumnImages:
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

export default TwoColumnImages;
