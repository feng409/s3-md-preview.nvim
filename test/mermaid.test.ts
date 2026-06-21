import { describe, expect, it } from "vitest";

import { renderMermaidToSvg } from "../src/mermaid.js";

describe("renderMermaidToSvg", () => {
  it(
    "renders nested block-beta syntax with official Mermaid semantics",
    async () => {
      const source = [
        "block-beta",
        "columns 4",
        "block:c0:1",
        "  columns 1",
        '  c0t["chunk_000"]',
        '  c0d["group 1~50"]',
        '  c0s["sealed ✓"]',
        "end",
        "block:c3:1",
        "  columns 1",
        '  c3t["chunk_003"]',
        '  c3d["(待创建)"]',
        '  c3s["..."]',
        "end",
        "style c0 fill:#e8f5e9",
        "style c3 fill:#f5f5f5,stroke-dasharray: 5 5",
      ].join("\n");

      const svg = await renderMermaidToSvg(source);

      expect(svg).toContain("<svg");
      expect(svg).toContain("chunk_000");
      expect(svg).toContain("group 1~50");
      expect(svg).toContain("chunk_003");
      expect(svg).not.toContain("block-beta");
    },
    60_000,
  );
});
