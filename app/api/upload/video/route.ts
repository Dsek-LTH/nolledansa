import { auth } from "@/auth";
import { withPreparedVideo } from "@/lib/prepare-video";
import { jsonProcessingResponse } from "@/lib/json-processing-response";
import { createObjectKey, getStorageErrorMessage, uploadObjectFile } from "@/lib/object-storage";

export const runtime = "nodejs";

/** Raw binary video uploads bypass the in-memory FormData parser entirely. */
export async function POST(request: Request) {
  if (!request.body) return Response.json({ error: "Ingen videofil skickades." }, { status: 400 });
  const contentType = request.headers.get("content-type")?.split(";")[0];
  if (!contentType?.startsWith("video/") && contentType !== "application/octet-stream") {
    return Response.json({ error: "Ogiltig videouppladdning." }, { status: 415 });
  }
  const session = await auth();
  const ownerId = session?.user?.email ?? null;
  const source = request.body;
  return jsonProcessingResponse(() => withPreparedVideo(source, path => uploadObjectFile({
    key: createObjectKey({ kind: "video", filename: "video.mp4", ownerId }),
    path,
    contentType: "video/mp4",
  }), request.signal), error => {
    console.error("[Streaming video upload] failed:", error);
    return getStorageErrorMessage(error);
  });
}
