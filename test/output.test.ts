import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeLocalOutput } from "../src/output.js";

describe("writeLocalOutput", () => {
  it("writes title-based HTML output and returns the path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "md-preview-output-"));

    const outputPath = await writeLocalOutput("<h1>Hello</h1>", dir, "hello world.md");

    expect(outputPath).toBe(join(dir, "hello-world.html"));
    await expect(readFile(outputPath, "utf8")).resolves.toBe("<h1>Hello</h1>");
  });
});
