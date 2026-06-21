import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function safeTitle(title: string): string {
  return title
    .replace(/\.html?$/i, "")
    .replace(/\.md$/i, "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "preview";
}

export async function writeLocalOutput(html: string, outputDir: string, title: string): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const path = join(outputDir, `${safeTitle(title)}.html`);
  await writeFile(path, html, "utf8");
  return path;
}

export interface S3Options {
  endpoint: string;
  bucket: string;
  region: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  acl?: string;
  customDomain?: string;
  pathStyle?: boolean;
  presignExpiry?: number;
}

function publicUrl(options: S3Options): string {
  const key = options.key.replace(/^\/+/, "");
  if (options.customDomain) {
    const domain = options.customDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${domain}/${key}`;
  }

  const host = options.endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (options.pathStyle) {
    return `https://${host}/${options.bucket}/${key}`;
  }
  return `https://${options.bucket}.${host}/${key}`;
}

export async function uploadS3(html: string, options: S3Options): Promise<string> {
  const client = new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: options.pathStyle,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: options.bucket,
    Key: options.key,
    Body: html,
    ContentType: "text/html; charset=utf-8",
    ACL: options.acl as PutObjectCommandInput["ACL"],
  });

  await client.send(command);

  if (options.presignExpiry && options.presignExpiry > 0) {
    return getSignedUrl(client, new GetObjectCommand({ Bucket: options.bucket, Key: options.key }), {
      expiresIn: options.presignExpiry,
    });
  }

  return publicUrl(options);
}
