function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

/** 将常见 Markdown 转为安全 HTML（供 v-html 展示 AI 文本） */
export function renderMarkdownToHtml(source: string): string {
  const raw = (source || "").trim();
  if (!raw) return "";

  const parts: string[] = [];
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(raw)) !== null) {
    if (match.index > last) {
      parts.push(renderMarkdownBlocks(raw.slice(last, match.index)));
    }
    const lang = match[1] ? ` class="language-${match[1]}"` : "";
    parts.push(
      `<pre class="md-pre"><code${lang}>${escapeHtml(match[2].trimEnd())}</code></pre>`
    );
    last = fenceRe.lastIndex;
  }

  if (last < raw.length) {
    parts.push(renderMarkdownBlocks(raw.slice(last)));
  }

  return parts.join("");
}

function renderMarkdownBlocks(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let para: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    html.push(`<p>${renderInline(para.join(" "))}</p>`);
    para = [];
  };

  const flushList = () => {
    if (!listType || !listItems.length) return;
    const tag = listType;
    html.push(
      `<${tag}>${listItems.map(li => `<li>${renderInline(li)}</li>`).join("")}</${tag}>`
    );
    listType = null;
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }

    const h = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      html.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      continue;
    }

    const ul = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      flushPara();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ul[1]);
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      flushPara();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(ol[1]);
      continue;
    }

    flushList();
    para.push(trimmed);
  }

  flushPara();
  flushList();
  return html.join("");
}
