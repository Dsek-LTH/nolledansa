import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prepareVideo } from "@/lib/prepare-video";
import { jsonProcessingResponse } from "@/lib/json-processing-response";
import { createObjectKey, getStorageErrorMessage, uploadObject } from "@/lib/object-storage";

export const runtime = "nodejs";

function isUploadKind(value: FormDataEntryValue | null): value is "video" | "thumbnail" {
  return value === "video" || value === "thumbnail";
}

function validateFile(kind: "video" | "thumbnail", file: File) {
  if (file.size <= 0) {
    return "Filen är tom.";
  }

  if (kind === "video" && !file.type.startsWith("video/") && !/\.(mp4|mov|m4v|mkv|webm|avi|mpg|mpeg|mts|m2ts|3gp|ogv|wmv)$/i.test(file.name)) {
    return "Videofilen har fel filtyp.";
  }

  if (kind === "thumbnail" && !file.type.startsWith("image/")) {
    return "Thumbnail-filen har fel filtyp.";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const kind = formData.get("kind");
    const file = formData.get("file");

    if (!isUploadKind(kind)) {
      return NextResponse.json({ error: "Ogiltig upload-typ." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Ingen fil skickades." }, { status: 400 });
    }

    const validationError = validateFile(kind, file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const session = await auth();
    const userId = session?.user?.email ?? null;

    const processUpload = async () => {
      const prepared = kind === "video" ? await prepareVideo(file) : {
        body: Buffer.from(await file.arrayBuffer()),
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      };

      const key = createObjectKey({
        kind,
        filename: prepared.filename,
        ownerId: userId,
        danceId: formData.get("danceId")?.toString() ?? null,
        requestId: formData.get("requestId")?.toString() ?? null,
      });

      const result = await uploadObject({
        key,
        body: prepared.body,
        contentType: prepared.contentType,
      });

      return result;
    };

    if (kind === "video") {
      return jsonProcessingResponse(processUpload, (error) => {
        console.error("[Video upload] failed:", error);
        return getStorageErrorMessage(error);
      });
    }
    return NextResponse.json(await processUpload());
  } catch (error) {
    console.error("[Object upload] failed:", error);
    return NextResponse.json({ error: getStorageErrorMessage(error) }, { status: 500 });
  }
}
