import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, stat, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { type MediaInfo, videoPlan } from "./video-compatibility";

function run(binary: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { timeout, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

/** Inspect actual streams, never infer compatibility from extension or MIME type. */
async function prepareVideoPath(input: string, output: string): Promise<string> {
  try {
    const info = JSON.parse(await run(process.env.FFPROBE_PATH || "ffprobe", [
      "-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", input,
    ], 60_000)) as MediaInfo;
    const plan = videoPlan(info);
    if (plan.unchanged) return input;
    // Large x264 lookahead buffers are expensive for 4K frames. Keep the same
    // resolution and CRF, but use fewer queued frames when encoding above 1080p.
    const lowMemoryEncoding = (plan.video.width ?? 0) * (plan.video.height ?? 0) > 1920 * 1080;

    await run(process.env.FFMPEG_PATH || "ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-protocol_whitelist", "file,pipe", "-threads", "2", "-i", input,
      "-map", `0:${plan.video.index}`,
      ...(plan.audio ? ["-map", `0:${plan.audio.index}`] : []),
      "-c:v", plan.copyVideo ? "copy" : "libx264",
      ...(!plan.copyVideo ? [
        "-preset", lowMemoryEncoding ? "veryfast" : "fast",
        ...(lowMemoryEncoding ? ["-tune", "zerolatency"] : []),
        "-crf", "18", "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-threads", "2",
      ] : []),
      "-c:a", plan.copyAudio ? "copy" : "aac",
      ...(!plan.copyAudio ? ["-b:a", "192k"] : []),
      "-movflags", "+faststart", output,
    ], 30 * 60_000);
    // Never publish an audio-only/partial result as a successful upload.
    const result = JSON.parse(await run(process.env.FFPROBE_PATH || "ffprobe", [
      "-v", "error", "-show_streams", "-show_format", "-of", "json", output,
    ], 60_000)) as MediaInfo;
    if (!videoPlan(result).unchanged) throw new Error("Konverteringen gav ett inkompatibelt format.");
    return output;
  } catch (error) {
    console.error("[Video preparation] failed:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("Serverns videokonvertering är inte tillgänglig. Kontakta administratören så att serverinstallationen kan kontrolleras.");
    }
    throw new Error("Videon kunde inte förberedas. Filen kan vara skadad eller ha ett format som inte stöds. Försök med MP4 (H.264 och AAC), eller kontakta administratören.");
  }
}

/** Keep source and output on disk until the consumer has finished streaming them. */
export async function withPreparedVideo<T>(
  source: ReadableStream<Uint8Array>,
  consume: (path: string) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "nolledansa-video-"));
  try {
    const input = join(directory, "input");
    const output = join(directory, "output.mp4");
    await pipeline(Readable.fromWeb(source as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(input), { signal });
    if ((await stat(input)).size === 0) throw new Error("Filen är tom.");
    return await consume(await prepareVideoPath(input, output));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
