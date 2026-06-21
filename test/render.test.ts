import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../src/render.js";

describe("renderMarkdown", () => {
  it("renders markdown features: headings, tables, task lists, highlighted code", async () => {
    const markdown = [
      "# Title",
      "",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "- [x] done",
      "",
      "```ts",
      "const answer: number = 42;",
      "```",
    ].join("\n");

    const html = await renderMarkdown(markdown, { title: "sample" });

    expect(html).toContain("<h1");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("mermaid.min.js");
  });

  it("renders mermaid blocks as <pre class='mermaid'> with CDN script", async () => {
    const markdown = [
      "# Doc",
      "",
      "```mermaid",
      "graph LR",
      "  A --> B",
      "```",
    ].join("\n");

    const html = await renderMarkdown(markdown, { title: "mermaid" });

    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain("A --&gt; B");
    expect(html).toContain("mermaid.min.js");
    expect(html).toContain("mermaid.initialize");
  });

  it("omits mermaid CDN script when no mermaid blocks exist", async () => {
    const html = await renderMarkdown("# Hello", { title: "plain" });

    expect(html).not.toContain("mermaid.min.js");
    expect(html).not.toContain("mermaid.initialize");
  });

  it("does not inline image-looking text inside code fences", async () => {
    const dir = await mkdtemp(join(tmpdir(), "md-preview-render-"));
    await writeFile(join(dir, "pixel.png"), Buffer.from("iVBORw0KGgo=", "base64"));

    const html = await renderMarkdown("```md\n![](./pixel.png)\n```", {
      title: "code",
      baseDir: dir,
    });

    expect(html).toContain("./pixel.png");
    expect(html).not.toContain("data:image/png;base64,");
  });

  it("escapes script tags inside mermaid fences", async () => {
    const markdown = "```mermaid\n<script>alert(1)</script>\n```";
    const html = await renderMarkdown(markdown, { title: "xss" });

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('<pre class="mermaid">');
    expect(html).not.toContain("<script>alert");
  });

  it("escapes raw HTML script tags", async () => {
    const html = await renderMarkdown("<script>alert('xss')</script>", {
      title: "html",
    });

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });
});
