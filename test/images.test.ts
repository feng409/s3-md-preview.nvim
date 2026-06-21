import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { localImageToDataUri } from "../src/images.js";

describe("localImageToDataUri", () => {
  it("embeds local image URLs as base64 data URIs relative to baseDir", async () => {
    const dir = await mkdtemp(join(tmpdir(), "md-preview-images-"));
    await writeFile(join(dir, "pixel.png"), Buffer.from("iVBORw0KGgo=", "base64"));

    const result = await localImageToDataUri("./pixel.png", dir);

    expect(result).toContain("data:image/png;base64,");
  });

  it("preserves remote, data, anchor, and missing image URLs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "md-preview-images-"));

    await expect(localImageToDataUri("https://example.com/a.png", dir)).resolves.toBeNull();
    await expect(localImageToDataUri("data:image/png;base64,abc", dir)).resolves.toBeNull();
    await expect(localImageToDataUri("#image", dir)).resolves.toBeNull();
    await expect(localImageToDataUri("missing.png", dir)).resolves.toBeNull();
  });

  it("does not embed non-image files or files outside baseDir", async () => {
    const dir = await mkdtemp(join(tmpdir(), "md-preview-images-"));
    const outside = await mkdtemp(join(tmpdir(), "md-preview-outside-"));
    await writeFile(join(dir, "note.txt"), "not an image", "utf8");
    await writeFile(join(outside, "secret.png"), Buffer.from("iVBORw0KGgo=", "base64"));

    await expect(localImageToDataUri("note.txt", dir)).resolves.toBeNull();
    await expect(localImageToDataUri(join(outside, "secret.png"), dir)).resolves.toBeNull();
  });

  it("does not follow symlinks that point outside baseDir", async () => {
    const dir = await mkdtemp(join(tmpdir(), "md-preview-images-"));
    const outside = await mkdtemp(join(tmpdir(), "md-preview-outside-"));
    const outsideFile = join(outside, "secret.png");
    await writeFile(outsideFile, Buffer.from("iVBORw0KGgo=", "base64"));
    await symlink(outsideFile, join(dir, "logo.png"));

    await expect(localImageToDataUri("logo.png", dir)).resolves.toBeNull();
  });
});
