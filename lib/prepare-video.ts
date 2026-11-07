import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
export async function prepareVideo(file: File) {
  const directory = await mkdtemp(join(tmpdir(), "nolledansa-video-"));
  try {
    const input = join(directory, "input");
    const output = join(directory, "output.mp4");
    await pipeline(Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(input));
    const info = JSON.parse(await run(process.env.FFPROBE_PATH || "ffprobe", [
      "-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", input,
    ], 60_000)) as MediaInfo;
    const plan = videoPlan(info);
    if (plan.unchanged) {
      return { body: await readFile(input), filename: "video.mp4", contentType: "video/mp4" };
    }

    await run(process.env.FFMPEG_PATH || "ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-protocol_whitelist", "file,pipe", "-i", input,
      "-map", `0:${plan.video.index}`,
      ...(plan.audio ? ["-map", `0:${plan.audio.index}`] : []),
      "-c:v", plan.copyVideo ? "copy" : "libx264",
      ...(!plan.copyVideo ? ["-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-threads", "2"] : []),
      "-c:a", plan.copyAudio ? "copy" : "aac",
      ...(!plan.copyAudio ? ["-b:a", "192k"] : []),
      "-movflags", "+faststart", output,
    ], 30 * 60_000);
    // Never publish an audio-only/partial result as a successful upload.
    const result = JSON.parse(await run(process.env.FFPROBE_PATH || "ffprobe", [
      "-v", "error", "-show_streams", "-show_format", "-of", "json", output,
    ], 60_000)) as MediaInfo;
    if (!videoPlan(result).unchanged) throw new Error("Konverteringen gav ett inkompatibelt format.");
    return { body: await readFile(output), filename: "video.mp4", contentType: "video/mp4" };
  } catch (error) {
    console.error("[Video preparation] failed:", error);
    throw new Error("Videon kunde inte förberedas. Filen kan vara skadad eller ha ett format som inte stöds. Försök med MP4 (H.264 och AAC), eller kontakta administratören.");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
