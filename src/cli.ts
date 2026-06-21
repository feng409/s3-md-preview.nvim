import { pathToFileURL } from "node:url";

import { Command, CommanderError } from "commander";

import { renderMarkdown } from "./render.js";
import { uploadS3, writeLocalOutput } from "./output.js";

const VERSION = "0.4.0";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

type Env = Record<string, string | undefined>;

interface CliOptions {
  title: string;
  outputDir?: string;
  baseDir?: string;
  bucket?: string;
  endpoint?: string;
  region?: string;
  keyPrefix?: string;
  key?: string;
  customDomain?: string;
  acl?: string;
  pathStyle?: boolean;
  presignExpiry?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

function defaultOutputDir(env: Env): string {
  return `${env.TMPDIR || "/tmp"}/md-preview`;
}

function buildProgram(): Command {
  return new Command()
    .name("md-preview")
    .description("Render markdown to self-contained HTML")
    .version(VERSION)
    .option("--title <title>", "Title for the output HTML", "preview")
    .option("--output-dir <dir>", "Directory for local file output")
    .option("--base-dir <dir>", "Directory for resolving local markdown images")
    .option("--bucket <bucket>", "S3 bucket name")
    .option("--endpoint <url>", "S3-compatible endpoint URL")
    .option("--region <region>", "S3 region")
    .option("--key-prefix <prefix>", "S3 object key prefix")
    .option("--key <key>", "Explicit S3 object key")
    .option("--custom-domain <domain>", "Custom domain for public URL")
    .option("--acl <acl>", "S3 ACL")
    .option("--path-style", "Use path-style S3 URLs")
    .option("--presign-expiry <seconds>", "Generate pre-signed URL with expiry in seconds")
    .option("--access-key-id <id>", "AWS access key ID")
    .option("--secret-access-key <secret>", "AWS secret access key")
    .exitOverride();
}

function envValue(env: Env, key: string): string | undefined {
  const value = env[key];
  return value && value.length > 0 ? value : undefined;
}

function envFlag(env: Env, key: string): boolean {
  const value = envValue(env, key);
  return value === "1" || value === "true" || value === "yes";
}

function s3Key(options: CliOptions): string {
  return options.key || `${options.keyPrefix || "md-preview/"}${options.title}.html`;
}

function resolveCredentials(options: CliOptions, env: Env): { accessKeyId: string; secretAccessKey: string } {
  const accessKeyId =
    options.accessKeyId || envValue(env, "MD_PREVIEW_ACCESS_KEY") || envValue(env, "AWS_ACCESS_KEY_ID");
  const secretAccessKey =
    options.secretAccessKey || envValue(env, "MD_PREVIEW_SECRET_KEY") || envValue(env, "AWS_SECRET_ACCESS_KEY");

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "missing credentials: set --access-key-id/--secret-access-key, MD_PREVIEW_ACCESS_KEY/MD_PREVIEW_SECRET_KEY, or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY",
    );
  }

  return { accessKeyId, secretAccessKey };
}

export async function runCli(args: string[], stdin: string, env: Env = process.env): Promise<CliResult> {
  if (args.includes("--version") || args.includes("-V")) {
    return { exitCode: 0, stdout: `${VERSION}\n`, stderr: "" };
  }

  const program = buildProgram();

  try {
    program.parse(args, { from: "user" });
    const options = program.opts<CliOptions>();
    const html = await renderMarkdown(stdin, {
      title: options.title,
      baseDir: options.baseDir,
    });

    const bucket = options.bucket || (!options.outputDir ? envValue(env, "MD_PREVIEW_BUCKET") : undefined);
    if (bucket) {
      const endpoint = options.endpoint || envValue(env, "MD_PREVIEW_ENDPOINT");
      if (!endpoint) {
        throw new Error("--endpoint is required when --bucket is set");
      }

      const credentials = resolveCredentials(options, env);
      const url = await uploadS3(html, {
        endpoint,
        bucket,
        region: options.region || envValue(env, "MD_PREVIEW_REGION") || "us-east-1",
        key: s3Key(options),
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        acl: options.acl,
        customDomain: options.customDomain || envValue(env, "MD_PREVIEW_CUSTOM_DOMAIN"),
        pathStyle: Boolean(options.pathStyle || envFlag(env, "MD_PREVIEW_PATH_STYLE")),
        presignExpiry: Number(options.presignExpiry || envValue(env, "MD_PREVIEW_PRESIGN_EXPIRY") || "0"),
      });
      return { exitCode: 0, stdout: `${url}\n`, stderr: "" };
    }

    const outputDir = options.outputDir || defaultOutputDir(env);
    const path = await writeLocalOutput(html, outputDir, options.title);
    return { exitCode: 0, stdout: `${path}\n`, stderr: "" };
  } catch (error) {
    if (error instanceof CommanderError) {
      return { exitCode: error.exitCode, stdout: "", stderr: error.message };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 1, stdout: "", stderr: `${message}\n` };
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-V")) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (args.includes("--help") || args.includes("-h")) {
    buildProgram().outputHelp();
    return;
  }

  const result = await runCli(args, await readStdin(), process.env);
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
