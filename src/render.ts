import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { codeToHtml } from "shiki";

import { inlineLocalImageTokens } from "./images.js";
import { MARKDOWN_CSS } from "./styles.js";

const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11.15.0/dist/mermaid.min.js";

export interface RenderOptions {
  title: string;
  baseDir?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function highlightCode(code: string, language: string): Promise<string> {
  if (!language) {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }

  try {
    return await codeToHtml(code, {
      lang: language,
      theme: "github-dark",
    });
  } catch {
    return `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(code)}</code></pre>`;
  }
}

function wrapHtmlDocument(title: string, body: string, hasMermaid: boolean): string {
  const mermaidScript = hasMermaid
    ? `<script src="${MERMAID_CDN}"></script>\n<script>mermaid.initialize({startOnLoad:true});</script>\n`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${MARKDOWN_CSS}
</style>
</head>
<body>
<article class="markdown-body">
${body}
</article>
${mermaidScript}</body>
</html>
`;
}

export async function renderMarkdown(markdown: string, options: RenderOptions): Promise<string> {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
  }).use(taskLists, { enabled: false });

  const env = {};
  const tokens = md.parse(markdown, env);
  await inlineLocalImageTokens(tokens, options.baseDir);

  let hasMermaid = false;

  for (const token of tokens) {
    if (token.type !== "fence") {
      continue;
    }

    const info = token.info.trim();
    const language = info.split(/\s+/)[0] ?? "";

    token.type = "html_block";
    token.tag = "";
    token.nesting = 0;
    token.markup = "";
    token.children = null;

    if (language === "mermaid") {
      hasMermaid = true;
      token.content = `<pre class="mermaid">\n${escapeHtml(token.content)}</pre>\n`;
    } else {
      token.content = `${await highlightCode(token.content, language)}\n`;
    }
  }

  return wrapHtmlDocument(options.title, md.renderer.render(tokens, md.options, env), hasMermaid);
}
