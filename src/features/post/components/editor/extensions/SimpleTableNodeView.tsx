import { useMemo } from "react";
import { Columns2, Plus, Rows3, Table2 } from "lucide-react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

type SimpleTableNodeAttrs = {
  rows?: string[][];
  hasHeaderRow?: boolean;
};

function normalizeRows(rawRows: unknown) {
  if (!Array.isArray(rawRows)) {
    return [
      ["제목", "항목", "설명"],
      ["", "", ""],
      ["", "", ""],
    ];
  }

  const parsedRows = rawRows
    .map((row) =>
      Array.isArray(row)
        ? row.map((cell) => (typeof cell === "string" ? cell : ""))
        : [],
    )
    .filter((row) => row.length > 0);

  return parsedRows.length > 0 ? parsedRows : [["제목", "항목", "설명"], ["", "", ""], ["", "", ""]];
}

export default function SimpleTableNodeView({
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps<HTMLDivElement>) {
  const attrs = node.attrs as SimpleTableNodeAttrs;
  const rows = useMemo(() => normalizeRows(attrs.rows), [attrs.rows]);
  const hasHeaderRow = attrs.hasHeaderRow !== false;

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    const nextRows = rows.map((row) => [...row]);
    nextRows[rowIndex][columnIndex] = value;
    updateAttributes({ rows: nextRows });
  };

  const appendRow = () => {
    const columnCount = rows[0]?.length ?? 3;
    updateAttributes({
      rows: [...rows, Array.from({ length: columnCount }, () => "")],
    });
  };

  const appendColumn = () => {
    const nextRows = rows.map((row) => [...row, ""]);
    updateAttributes({ rows: nextRows });
  };

  return (
    <NodeViewWrapper
      as="div"
      className={[
        "compose-table-node my-[1.3rem]",
        selected ? "is-selected" : "",
      ].join(" ")}
      contentEditable={false}
      data-type="compose-table"
    >
      <div className="compose-table-toolbar">
        <span className="compose-table-toolbar-label">
          <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
          표 블록
        </span>
        <div className="compose-table-toolbar-actions">
          <button type="button" onClick={appendRow}>
            <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
            행 추가
          </button>
          <button type="button" onClick={appendColumn}>
            <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
            열 추가
          </button>
          <button
            type="button"
            onClick={() => updateAttributes({ hasHeaderRow: !hasHeaderRow })}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {hasHeaderRow ? "헤더 해제" : "헤더 사용"}
          </button>
        </div>
      </div>

      <div className="compose-table-scroll">
        <table className="compose-table">
          <tbody>
            {rows.map((row, rowIndex) => {
              const CellTag = hasHeaderRow && rowIndex === 0 ? "th" : "td";
              return (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, columnIndex) => (
                    <CellTag key={`cell-${rowIndex}-${columnIndex}`}>
                      <input
                        value={cell}
                        onChange={(event) => {
                          updateCell(rowIndex, columnIndex, event.target.value);
                        }}
                        placeholder={
                          hasHeaderRow && rowIndex === 0 ? "헤더" : "내용"
                        }
                      />
                    </CellTag>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </NodeViewWrapper>
  );
}
