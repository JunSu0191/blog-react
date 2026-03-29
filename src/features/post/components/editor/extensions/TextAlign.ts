import { Extension } from "@tiptap/core";

export const TextAlignValue = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFY: "justify",
} as const;

export type TextAlignValue = (typeof TextAlignValue)[keyof typeof TextAlignValue];

const TEXT_ALIGN_VALUES = [
  TextAlignValue.LEFT,
  TextAlignValue.CENTER,
  TextAlignValue.RIGHT,
  TextAlignValue.JUSTIFY,
] as const;

type TextAlignOptions = {
  types: string[];
  alignments: readonly TextAlignValue[];
  defaultAlignment: TextAlignValue;
};

function isTextAlignValue(value: unknown): value is TextAlignValue {
  return (
    typeof value === "string" &&
    (TEXT_ALIGN_VALUES as readonly string[]).includes(value)
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: TextAlignValue) => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
  }
}

const TextAlign = Extension.create<TextAlignOptions>({
  name: "textAlign",

  addOptions() {
    return {
      types: [],
      alignments: TEXT_ALIGN_VALUES,
      defaultAlignment: TextAlignValue.LEFT,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => {
              const styleAlign = element.style.textAlign?.toLowerCase().trim();
              if (isTextAlignValue(styleAlign)) {
                return styleAlign;
              }

              const dataAlign = element
                .getAttribute("data-text-align")
                ?.toLowerCase()
                .trim();
              if (isTextAlignValue(dataAlign)) {
                return dataAlign;
              }

              return null;
            },
            renderHTML: (attributes) => {
              const align = attributes.textAlign as unknown;
              if (!isTextAlignValue(align) || align === this.options.defaultAlignment) {
                return {};
              }

              return {
                style: `text-align: ${align}`,
                "data-text-align": align,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ commands }) => {
          if (!isTextAlignValue(alignment)) return false;
          const normalizedAlignment =
            alignment === this.options.defaultAlignment ? null : alignment;

          return this.options.types
            .map((type) =>
              commands.updateAttributes(type, { textAlign: normalizedAlignment }),
            )
            .some(Boolean);
        },
      unsetTextAlign:
        () =>
        ({ commands }) =>
          this.options.types
            .map((type) => commands.resetAttributes(type, "textAlign"))
            .some(Boolean),
    };
  },
});

export default TextAlign;
