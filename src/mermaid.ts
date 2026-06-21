import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function localMmdcBin(): string {
  const name = process.platform === "win32" ? "mmdc.cmd" : "mmdc";
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "..", "node_modules", ".bin", name),
    resolve(here, "..", "..", "node_modules", ".bin", name),
    resolve(process.cwd(), "node_modules", ".bin", name),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || "mmdc";
}

export async function renderMermaidToSvg(source: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "md-preview-mermaid-"));
  const input = join(dir, "diagram.mmd");
  const output = join(dir, "diagram.svg");
  const puppeteerConfig = join(dir, "puppeteer.json");

  try {
    await writeFile(input, source, "utf8");
    await writeFile(
      puppeteerConfig,
      JSON.stringify({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      }),
      "utf8",
    );

    await execFileAsync(
      localMmdcBin(),
      ["--input", input, "--output", output, "--backgroundColor", "transparent", "--puppeteerConfigFile", puppeteerConfig],
      {
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    return await readFile(output, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to render mermaid diagram with mmdc: ${message}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
