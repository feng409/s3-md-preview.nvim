import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const binPath = resolve("bin", "md-preview");
const script = `#!/usr/bin/env node
import { main } from "../dist/src/cli.js";

await main();
`;

await mkdir(dirname(binPath), { recursive: true });
await writeFile(binPath, script, "utf8");
await chmod(binPath, 0o755);
