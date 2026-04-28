// 軽量 Markdown レンダラ。外部依存なし。
// サポート: h1〜h3 / 順序なしリスト / 水平線 / 太字 / インラインコード / 段落 (空行区切り、段落内改行は <br>)
// 入力は HTML エスケープ後にマークアップを後付けする順序で組み立てる (XSS リスクの回避)

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseInline = (s: string): string => {
  return s
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
};

export function renderMarkdown(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  let inList = false;
  let paragraphBuf: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphBuf.length === 0) return;
    out.push(`<p>${paragraphBuf.join("<br />")}</p>`);
    paragraphBuf = [];
  };
  const closeList = (): void => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const escaped = escapeHtml(raw);
    const trimmed = escaped.trim();

    if (trimmed === "") {
      flushParagraph();
      closeList();
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push("<hr />");
      continue;
    }
    const h3 = trimmed.match(/^### (.+)/);
    if (h3) {
      flushParagraph();
      closeList();
      out.push(`<h3>${parseInline(h3[1])}</h3>`);
      continue;
    }
    const h2 = trimmed.match(/^## (.+)/);
    if (h2) {
      flushParagraph();
      closeList();
      out.push(`<h2>${parseInline(h2[1])}</h2>`);
      continue;
    }
    const h1 = trimmed.match(/^# (.+)/);
    if (h1) {
      flushParagraph();
      closeList();
      out.push(`<h1>${parseInline(h1[1])}</h1>`);
      continue;
    }
    const li = trimmed.match(/^- (.+)/);
    if (li) {
      flushParagraph();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${parseInline(li[1])}</li>`);
      continue;
    }
    closeList();
    paragraphBuf.push(parseInline(escaped));
  }
  flushParagraph();
  closeList();

  return out.join("\n");
}
