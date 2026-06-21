import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../src/cli.js";

describe("runCli", () => {
  it("prints version without requiring stdin", async () => {
    const result = await runCli(["--version"], "", {});

    expect(result).toEqual({
      exitCode: 0,
      stdout: "0.4.0\n",
      stderr: "",
    });
  });

  it("reads markdown from stdin, writes local HTML, and prints one output path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "md-preview-cli-"));
    await writeFile(join(dir, "pixel.png"), Buffer.from("iVBORw0KGgo=", "base64"));

    const result = await runCli(
      ["--title", "sample", "--output-dir", dir, "--base-dir", dir],
      "# Hello\n\n![](./pixel.png)\n",
      {},
    );

    const outputPath = join(dir, "sample.html");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe(outputPath);
    await expect(readFile(outputPath, "utf8")).resolves.toContain("data:image/png;base64,");
  });

  it("keeps --output-dir local even when S3 environment variables are present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "md-preview-cli-local-"));

    const result = await runCli(["--title", "local", "--output-dir", dir], "# Local\n", {
      MD_PREVIEW_BUCKET: "bucket-from-env",
      MD_PREVIEW_ENDPOINT: "https://s3.example.test",
      MD_PREVIEW_ACCESS_KEY: "access-key",
      MD_PREVIEW_SECRET_KEY: "secret-key",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(join(dir, "local.html"));
    expect(result.stderr).toBe("");
    await expect(readFile(join(dir, "local.html"), "utf8")).resolves.toContain("Local");
  });
});
