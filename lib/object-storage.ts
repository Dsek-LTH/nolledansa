import "server-only";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Upload } from "@aws-sdk/lib-storage";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type UploadKind = "video" | "thumbnail";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

export function getStorageErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Uppladdningen misslyckades.";
  }

  const code = "Code" in error && typeof error.Code === "string" ? error.Code : undefined;
  const name = error.name;

  if (name === "SignatureDoesNotMatch" || code === "SignatureDoesNotMatch") {
    return "Felaktig signatur mot objektlagring. Kontrollera S3 credentials och endpoint.";
  }

  if (name === "InvalidAccessKeyId" || code === "InvalidAccessKeyId") {
    return "Felaktig access key för objektlagring.";
  }

  if (name === "NoSuchBucket" || code === "NoSuchBucket") {
    return "Bucket hittades inte. Kontrollera S3_BUCKET_NAME.";
  }

  return error.message || "Uppladdningen misslyckades.";
}

function getBucketName() {
  return requireEnv("S3_BUCKET_NAME");
}

function getS3Client() {
  const endpoint = requireEnv("S3_ENDPOINT");
  const region = process.env.S3_REGION?.trim() || "us-east-1";
  const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE?.trim() ?? "true") === "true";

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
}

function cleanExtension(filename: string, fallback: string) {
  const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || fallback;
}

export function createObjectKey(params: {
  kind: UploadKind;
  filename: string;
  ownerId?: string | null;
  danceId?: string | null;
  requestId?: string | null;
}) {
  const ext = cleanExtension(params.filename, params.kind === "video" ? "mp4" : "jpg");
  const owner = params.ownerId ?? "anonymous";
  const date = new Date().toISOString().slice(0, 10);
  const id = crypto.randomUUID();

  if (params.kind === "thumbnail" && params.danceId && params.requestId) {
    return `thumbnails/edits/${params.danceId}/${params.requestId}-${id}.${ext}`;
  }

  return `${params.kind}s/${owner}/${date}/${Date.now()}-${id}.${ext}`;
}

export function getObjectUrl(key: string) {
  const publicUrl = process.env.S3_PUBLIC_URL?.replace(/\/+$/, "");
  if (publicUrl) {
    return `${publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  return `/api/object?key=${encodeURIComponent(key)}`;
}

export async function uploadObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    key: params.key,
    url: getObjectUrl(params.key),
  };
}

export async function getObject(params: {
  key: string;
  range?: string | null;
}) {
  return getS3Client().send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: params.key,
      Range: params.range ?? undefined,
    })
  );
}

/** Bound buffering to one 16 MiB part, even for multi-gigabyte files. */
export async function uploadObjectFile(params: { key: string; path: string; contentType: string }) {
  const body = createReadStream(params.path);
  try {
    const uploader = new Upload({
      client: getS3Client(),
      queueSize: 1,
      partSize: 16 * 1024 * 1024,
      leavePartsOnError: false,
      params: {
        Bucket: getBucketName(), Key: params.key, Body: body,
        ContentLength: (await stat(params.path)).size,
        ContentType: params.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      },
    });
    await uploader.done();
    return { key: params.key, url: getObjectUrl(params.key) };
  } finally {
    body.destroy();
  }
}
