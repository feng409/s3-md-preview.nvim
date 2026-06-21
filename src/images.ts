import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { lookup as lookupMime } from "mime-types";

function shouldInline(url: string): boolean {
  return !/^(?:https?:|data:|#)/i.test(url);
}

type MarkdownToken = {
  type: string;
  children: MarkdownToken[] | null;
  attrGet(name: string): string | null;
  attrSet(name: string, value: string): void;
};

function isWithinBaseDir(path: string, baseDir: string): boolean {
  const rel = relative(resolve(baseDir), path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export async function localImageToDataUri(url: string, baseDir: string): Promise<string | null> {
  if (!shouldInline(url)) {
    return null;
  }

  const path = isAbsolute(url) ? url : resolve(baseDir, url);
  try {
    const [realBaseDir, realTarget] = await Promise.all([realpath(baseDir), realpath(path)]);
    if (!isWithinBaseDir(realTarget, realBaseDir)) {
      return null;
    }

    const mime = lookupMime(realTarget);
    if (!mime || !mime.startsWith("image/")) {
      return null;
    }

    const bytes = await readFile(realTarget);
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function inlineLocalImageTokens(tokens: MarkdownToken[], baseDir?: string): Promise<void> {
  if (!baseDir) {
    return;
  }

  for (const token of tokens) {
    if (token.type === "image") {
      const src = token.attrGet("src");
      if (src) {
        const dataUri = await localImageToDataUri(src, baseDir);
        if (dataUri) {
          token.attrSet("src", dataUri);
        }
      }
    }

    if (token.children) {
      await inlineLocalImageTokens(token.children, baseDir);
    }
  }
}
