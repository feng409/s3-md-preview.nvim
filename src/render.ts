import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { codeToHtml } from "shiki";

import { inlineLocalImageTokens } from "./images.js";
import { renderMermaidToSvg } from "./mermaid.js";
import { MARKDOWN_CSS } from "./styles.js";

export type MermaidRenderer = (source: string) => Promise<string>;

export interface RenderOptions {
  title: string;
  baseDir?: string;
  mermaidRenderer?: MermaidRenderer;
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

function wrapHtmlDocument(title: string, body: string): string {
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
</body>
</html>
`;
}

export async function renderMarkdown(markdown: string, options: RenderOptions): Promise<string> {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
  }).use(taskLists, { enabled: false });

  const mermaidRenderer = options.mermaidRenderer ?? renderMermaidToSvg;
  const env = {};
  const tokens = md.parse(markdown, env);
  await inlineLocalImageTokens(tokens, options.baseDir);

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
      const svg = await mermaidRenderer(token.content);
      token.content = `<div class="mermaid-diagram">${svg}</div>\n`;
    } else {
      token.content = `${await highlightCode(token.content, language)}\n`;
    }
  }

  return wrapHtmlDocument(options.title, md.renderer.render(tokens, md.options, env));
}
