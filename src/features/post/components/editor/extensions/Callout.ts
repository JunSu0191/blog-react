import { Node, mergeAttributes } from "@tiptap/core";

const CALLOUT_TONES = ["info", "tip", "warning"] as const;

export type CalloutTone = (typeof CALLOUT_TONES)[number];

export type CalloutAttributes = {
  tone?: CalloutTone | null;
};

type CalloutOptions = {
  HTMLAttributes: Record<string, string>;
};

function isCalloutTone(value: unknown): value is CalloutTone {
  return (
    typeof value === "string" &&
    (CALLOUT_TONES as readonly string[]).includes(value)
  );
}

function getCalloutLabel(tone: CalloutTone) {
  if (tone === "tip") return "팁";
  if (tone === "warning") return "주의";
  return "정보";
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: CalloutAttributes) => ReturnType;
    };
  }
}

const Callout = Node.create<CalloutOptions>({
  name: "callout",

  group: "block",

  content: "block+",

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      tone: {
        default: "info",
        parseHTML: (element: HTMLElement) => {
          const tone = element.getAttribute("data-callout-tone");
          return isCalloutTone(tone) ? tone : "info";
        },
        renderHTML: (attributes: { tone?: unknown }) => {
          const tone = isCalloutTone(attributes.tone)
            ? attributes.tone
            : "info";

          return {
            "data-callout-tone": tone,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
        contentElement: ".editor-callout-body",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const tone = isCalloutTone(node.attrs.tone)
      ? node.attrs.tone
      : "info";

    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "callout",
        "data-callout-tone": tone,
        class: `editor-callout editor-callout-${tone}`,
      }),
      [
        "div",
        {
          class: "editor-callout-label",
          contenteditable: "false",
        },
        getCalloutLabel(tone),
      ],
      [
        "div",
        {
          class: "editor-callout-body",
        },
        0,
      ],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes = {}) =>
        ({ commands }) =>
          commands.insertContent([
            {
              type: this.name,
              attrs: {
                tone: isCalloutTone(attributes.tone) ? attributes.tone : "info",
              },
              content: [
                {
                  type: "paragraph",
                },
              ],
            },
            {
              type: "paragraph",
            },
          ]),
    };
  },
});

export default Callout;
