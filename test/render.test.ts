import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../src/render.js";

describe("renderMarkdown", () => {
  it("renders markdown, highlighted code, and Mermaid as inline SVG without browser-side Mermaid JS", async () => {
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
      "",
      "```mermaid",
      "block-beta",
      "columns 4",
      'a["chunk_000"]',
      "```",
    ].join("\n");

    const html = await renderMarkdown(markdown, {
      title: "sample",
      mermaidRenderer: async (source) => `<svg data-source="${source.includes("block-beta")}"><text>chunk_000</text></svg>`,
    });

    expect(html).toContain("<h1");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("<svg");
    expect(html).toContain("chunk_000");
    expect(html).not.toContain("<pre class=\"mermaid\"");
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

  it("escapes raw HTML script tags", async () => {
    const html = await renderMarkdown("<script>alert('xss')</script>", {
      title: "html",
    });

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });
});
