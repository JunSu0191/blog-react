import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import LinkCardNodeView from "./LinkCardNodeView";

export type LinkCardAttributes = {
  url: string;
  title?: string | null;
  description?: string | null;
  domain?: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkCard: {
      setLinkCard: (attributes: LinkCardAttributes) => ReturnType;
    };
  }
}

const LinkCard = Node.create({
  name: "linkCard",

  group: "block",

  atom: true,

  draggable: true,

  selectable: true,

  isolating: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
      title: {
        default: null,
      },
      description: {
        default: null,
      },
      domain: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="link-card"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const anchor = element.querySelector("a[href]") as HTMLAnchorElement | null;
          return {
            url: anchor?.getAttribute("href"),
            title:
              element.querySelector(".link-card-title")?.textContent?.trim() ||
              anchor?.getAttribute("data-link-title"),
            description:
              element
                .querySelector(".link-card-description")
                ?.textContent?.trim() ||
              anchor?.getAttribute("data-link-description"),
            domain:
              element.querySelector(".link-card-domain")?.textContent?.trim() ||
              anchor?.getAttribute("data-link-domain"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const url =
      typeof HTMLAttributes.url === "string" ? HTMLAttributes.url : "#";
    const title =
      typeof HTMLAttributes.title === "string" && HTMLAttributes.title.trim()
        ? HTMLAttributes.title.trim()
        : url;
    const description =
      typeof HTMLAttributes.description === "string"
        ? HTMLAttributes.description.trim()
        : "";
    const domain =
      typeof HTMLAttributes.domain === "string" && HTMLAttributes.domain.trim()
        ? HTMLAttributes.domain.trim()
        : (() => {
            try {
              return new URL(url).hostname.replace(/^www\./, "");
            } catch {
              return "외부 링크";
            }
          })();

    return [
      "div",
      {
        "data-type": "link-card",
        class: "link-card-node",
      },
      [
        "a",
        {
          class: "link-card-shell",
          href: url,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-link-title": title,
          "data-link-description": description,
          "data-link-domain": domain,
        },
        [
          "div",
          {
            class: "link-card-icon",
          },
          "↗",
        ],
        [
          "div",
          {
            class: "link-card-content",
          },
          [
            "span",
            {
              class: "link-card-domain",
            },
            domain,
          ],
          [
            "strong",
            {
              class: "link-card-title",
            },
            title,
          ],
          ...(description
            ? [
                [
                  "p",
                  {
                    class: "link-card-description",
                  },
                  description,
                ],
              ]
            : []),
          [
            "span",
            {
              class: "link-card-url",
            },
            url,
          ],
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkCardNodeView);
  },

  addCommands() {
    return {
      setLinkCard:
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

export default LinkCard;
