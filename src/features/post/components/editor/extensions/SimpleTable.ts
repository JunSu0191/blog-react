import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import SimpleTableNodeView from "./SimpleTableNodeView";

export type SimpleTableAttributes = {
  rows: string[][];
  hasHeaderRow?: boolean;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    simpleTable: {
      setSimpleTable: (attributes?: Partial<SimpleTableAttributes>) => ReturnType;
    };
  }
}

function normalizeRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [
      ["제목", "항목", "설명"],
      ["", "", ""],
      ["", "", ""],
    ];
  }

  const rows = value
    .map((row) =>
      Array.isArray(row)
        ? row.map((cell) => (typeof cell === "string" ? cell : ""))
        : [],
    )
    .filter((row) => row.length > 0);

  return rows.length > 0
    ? rows
    : [
        ["제목", "항목", "설명"],
        ["", "", ""],
        ["", "", ""],
      ];
}

const SimpleTable = Node.create({
  name: "simpleTable",

  group: "block",

  atom: true,

  draggable: true,

  selectable: true,

  isolating: true,

  addAttributes() {
    return {
      rows: {
        default: [
          ["제목", "항목", "설명"],
          ["", "", ""],
          ["", "", ""],
        ],
      },
      hasHeaderRow: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="compose-table"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const rows = Array.from(element.querySelectorAll("tr")).map((row) =>
            Array.from(row.querySelectorAll("th, td")).map(
              (cell) => cell.textContent?.trim() ?? "",
            ),
          );

          return {
            rows: normalizeRows(rows),
            hasHeaderRow: Boolean(element.querySelector("th")),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const rows = normalizeRows(HTMLAttributes.rows);
    const hasHeaderRow = HTMLAttributes.hasHeaderRow !== false;

    return [
      "div",
      {
        "data-type": "compose-table",
        class: "compose-table-block",
      },
      [
        "div",
        {
          class: "compose-table-scroll",
        },
        [
          "table",
          {
            class: "compose-table",
          },
          [
            "tbody",
            ...rows.map((row, rowIndex) => [
              "tr",
              ...row.map((cell) => [
                hasHeaderRow && rowIndex === 0 ? "th" : "td",
                cell,
              ]),
            ]),
          ],
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SimpleTableNodeView);
  },

  addCommands() {
    return {
      setSimpleTable:
        (attributes = {}) =>
        ({ commands }) =>
          commands.insertContent([
            {
              type: this.name,
              attrs: {
                rows: normalizeRows(attributes.rows),
                hasHeaderRow: attributes.hasHeaderRow !== false,
              },
            },
            {
              type: "paragraph",
            },
          ]),
    };
  },
});

export default SimpleTable;
