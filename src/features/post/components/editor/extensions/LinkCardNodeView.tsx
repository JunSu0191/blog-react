import { ExternalLink, Link2 } from "lucide-react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

type LinkCardNodeAttrs = {
  url?: string | null;
  title?: string | null;
  description?: string | null;
  domain?: string | null;
};

export default function LinkCardNodeView({
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps<HTMLDivElement>) {
  const attrs = node.attrs as LinkCardNodeAttrs;

  const editUrl = () => {
    const nextUrl = window.prompt("링크 URL을 입력해 주세요.", attrs.url ?? "");
    if (nextUrl === null) return;
    const trimmed = nextUrl.trim();
    if (!trimmed) return;

    try {
      const url = new URL(trimmed);
      updateAttributes({
        url: url.toString(),
        domain: url.hostname.replace(/^www\./, ""),
        title: attrs.title ?? url.hostname.replace(/^www\./, ""),
      });
    } catch {
      window.alert("유효한 URL을 입력해 주세요.");
    }
  };

  return (
    <NodeViewWrapper
      as="div"
      className={[
        "link-card-node my-[1.2rem]",
        selected ? "is-selected" : "",
      ].join(" ")}
      contentEditable={false}
      data-type="link-card"
    >
      <div className="link-card-shell">
        <a
          className="link-card-main"
          href={attrs.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="link-card-icon">
            <Link2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="link-card-content">
            <span className="link-card-domain">
              {attrs.domain || "외부 링크"}
            </span>
            <strong className="link-card-title">
              {attrs.title || attrs.url || "링크 카드"}
            </strong>
            <p className="link-card-description">
              {attrs.description ||
                "외부 자료, 참고 링크, 문서 링크를 카드 형태로 정리합니다."}
            </p>
            <span className="link-card-url">{attrs.url}</span>
          </div>
        </a>
        <button
          type="button"
          className="link-card-open-button"
          onClick={editUrl}
          aria-label="링크 카드 URL 편집"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
