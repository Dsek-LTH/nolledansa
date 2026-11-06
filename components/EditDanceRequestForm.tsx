"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, EyeOff, Loader2, PencilLine, Trash2, Upload } from "lucide-react";
import SegmentForm from "@/components/SegmentForm";
import {
  Dance,
  DanceOrganization,
  DanceSegment,
  Section,
  SegmentFormData,
} from "@/lib/types";
import { parseTime } from "@/lib/utils";
import { compressVideo, CompressionProgress } from "@/lib/compress-video";
import { VIDEO_COMPRESSION_ENABLED } from "@/lib/upload-config";

const SORTED_SECTIONS: Section[] = ["A", "D", "E", "F", "I", "ING", "K", "M", "V", "W"];
const ORGANIZATIONS: DanceOrganization[] = ["Nollningen", "Sexmästeriet", "Phusk"];
const MAX_UPLOAD_MB = 50;
const LIGHT_COMPRESSION_THRESHOLD_MB = 0;

async function uploadFileToObjectStorage(params: {
  file: File | Blob;
  kind: "video" | "thumbnail";
  filename: string;
  danceId?: string;
  requestId?: string;
}): Promise<{ key?: string; url: string }> {
  const formData = new FormData();
  formData.append("kind", params.kind);
  formData.append("file", params.file, params.filename);
  if (params.danceId) formData.append("danceId", params.danceId);
  if (params.requestId) formData.append("requestId", params.requestId);

  const response = await fetch("/api/upload/object", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as { key?: string; url?: string; error?: string };

  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Uppladdningen misslyckades.");
  }

  return { key: data.key, url: data.url };
}

function getEditableVideoSourceUrl(videoUrl: string) {
  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
    return `/api/video-proxy?url=${encodeURIComponent(videoUrl)}`;
  }

  return videoUrl;
}

function toSegmentFormData(segments: DanceSegment[]): SegmentFormData[] {
  return segments.map((segment, index) => ({
    name: segment.name,
    description: segment.description ?? "",
    start_time_str: `${Math.floor(segment.start_time / 60)}:${String(
      Math.floor(segment.start_time % 60)
    ).padStart(2, "0")}`,
    end_time_str: `${Math.floor(segment.end_time / 60)}:${String(
      Math.floor(segment.end_time % 60)
    ).padStart(2, "0")}`,
    sort_order: index,
  }));
}

interface EditDanceRequestFormProps {
  dance: Dance;
  segments: DanceSegment[];
}

export default function EditDanceRequestForm({ dance, segments }: EditDanceRequestFormProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const pendingThumbnailCaptureRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [hideLoading, setHideLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hideError, setHideError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [hideSuccess, setHideSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [hideIndefinitely, setHideIndefinitely] = useState(false);
  const [hideUntil, setHideUntil] = useState("");
  const [hideNote, setHideNote] = useState("");
  const [requesterNote, setRequesterNote] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [compressionPct, setCompressionPct] = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [frameTime, setFrameTime] = useState(0);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(dance.thumbnail_url);
  const videoSourceUrl = useMemo(
    () => getEditableVideoSourceUrl(dance.video_url),
    [dance.video_url]
  );
  const editableVideoUrl = videoPreviewUrl ?? videoSourceUrl;
  const [form, setForm] = useState({
    title: dance.title,
    section: dance.section,
    organization: dance.organization ?? "Nollningen",
    year: dance.year,
    song_title: dance.song_title,
    dancer_names: dance.dancer_names ?? "",
    artist: dance.artist ?? "",
    spotify_url: dance.spotify_url ?? "",
  });
  const [proposedSegments, setProposedSegments] = useState<SegmentFormData[]>(
    toSegmentFormData(segments)
  );

  const hasChanges = useMemo(() => {
    const currentDance = JSON.stringify({
      title: dance.title.trim(),
      section: dance.section,
      organization: dance.organization ?? "Nollningen",
      year: dance.year.trim(),
      song_title: dance.song_title.trim(),
      dancer_names: dance.dancer_names?.trim() ?? "",
      artist: dance.artist?.trim() ?? "",
      spotify_url: dance.spotify_url?.trim() ?? "",
    });

    const nextDance = JSON.stringify({
      title: form.title.trim(),
      section: form.section,
      organization: form.organization,
      year: form.year.trim(),
      song_title: form.title.trim(),
      dancer_names: form.dancer_names.trim(),
      artist: form.artist.trim(),
      spotify_url: form.spotify_url.trim(),
    });

    const currentSegments = JSON.stringify(
      segments.map((segment, index) => ({
        name: segment.name.trim(),
        description: segment.description?.trim() ?? "",
        start_time: segment.start_time,
        end_time: segment.end_time,
        sort_order: index,
      }))
    );

    const nextSegments = JSON.stringify(
      proposedSegments.map((segment, index) => ({
        name: segment.name.trim(),
        description: segment.description.trim(),
        start_time: parseTime(segment.start_time_str),
        end_time: parseTime(segment.end_time_str),
        sort_order: index,
      }))
    );

    return currentDance !== nextDance || currentSegments !== nextSegments;
  }, [dance, form, proposedSegments, segments]);

  const videoChanged = videoFile !== null;
  const thumbnailHasNewPreview = thumbnailPreviewUrl !== dance.thumbnail_url;
  const thumbnailChanged = thumbnailHasNewPreview || videoChanged;

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl && thumbnailPreviewUrl !== dance.thumbnail_url) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
    };
  }, [dance.thumbnail_url, thumbnailPreviewUrl]);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFrameTime(0);
    setVideoDuration(undefined);
    pendingThumbnailCaptureRef.current = false;

    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
    };
    video.src = url;
  };

  const resetVideo = () => {
    setVideoFile(null);
    setVideoDuration(undefined);
    setFrameTime(0);
    pendingThumbnailCaptureRef.current = false;
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const captureThumbnailAtCurrentTime = () => {
    const video = captureVideoRef.current;
    const canvas = frameCanvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return;

    try {
      context.drawImage(video, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          setError("Kunde inte skapa preview-bild. Prova en annan tidpunkt.");
          return;
        }

        setThumbnailBlob(blob);
        if (thumbnailPreviewUrl && thumbnailPreviewUrl !== dance.thumbnail_url) {
          URL.revokeObjectURL(thumbnailPreviewUrl);
        }
        setThumbnailPreviewUrl(URL.createObjectURL(blob));
      }, "image/jpeg", 0.82);
    } catch (captureErr) {
      console.error("[Thumbnail] capture failed:", captureErr);
      setError("Kunde inte skapa preview-bild från videon. Prova en annan frame.");
    }
  };

  const useCurrentFrameAsThumbnail = () => {
    const video = captureVideoRef.current;
    if (!video) return;

    const safeTime = Math.min(frameTime, Math.max(0, (video.duration || frameTime) - 0.1));

    if (Math.abs(video.currentTime - safeTime) > 0.05) {
      pendingThumbnailCaptureRef.current = true;
      video.currentTime = safeTime;
      return;
    }

    captureThumbnailAtCurrentTime();
  };

  const resetThumbnail = () => {
    pendingThumbnailCaptureRef.current = false;
    setThumbnailBlob(null);
    if (thumbnailPreviewUrl && thumbnailPreviewUrl !== dance.thumbnail_url) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
    }
    setThumbnailPreviewUrl(dance.thumbnail_url);
    setFrameTime(0);
  };

  const validate = () => {
    if (!form.title.trim()) return "Titel krävs";
    if (!form.dancer_names.trim()) return "Vilka dansar krävs";
    if (!form.year.trim()) return "År krävs";
    for (let i = 0; i < proposedSegments.length; i++) {
      const segment = proposedSegments[i];
      if (!segment.name.trim()) return `Del ${i + 1}: namn krävs`;
      const start = parseTime(segment.start_time_str);
      const end = parseTime(segment.end_time_str);
      if (isNaN(start)) return `Del ${i + 1}: ogiltig starttid`;
      if (isNaN(end)) return `Del ${i + 1}: ogiltig sluttid`;
      if (start >= end) return `Del ${i + 1}: starttid måste vara före sluttid`;
    }

    if (!hasChanges && !thumbnailChanged) return "Gör minst en ändring innan du skickar in förslaget.";

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setStatusMsg(null);
    setCompressionPct(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const requestId = crypto.randomUUID();
      let requestThumbnailUrl: string | null = dance.thumbnail_url;
      let requestVideoUrl = dance.video_url;

      if (videoFile) {
        let fileToUpload: File = videoFile;
        const handleCompressionProgress = (p: CompressionProgress) => {
          setStatusMsg(p.message);
          if (p.stage === "compressing" && p.percent !== undefined) {
            setCompressionPct(p.percent);
          } else {
            setCompressionPct(null);
          }
        };

        if (VIDEO_COMPRESSION_ENABLED) {
          try {
            fileToUpload = await compressVideo(
              videoFile,
              handleCompressionProgress,
              LIGHT_COMPRESSION_THRESHOLD_MB
            );
          } catch (compressionErr) {
            console.warn("Komprimering misslyckades:", compressionErr);
            throw new Error(
              "Komprimeringen misslyckades. Prova igen eller exportera videon med lägre bitrate/upplösning."
            );
          }

          const finalMB = fileToUpload.size / 1024 / 1024;
          if (finalMB > MAX_UPLOAD_MB) {
            throw new Error(
              `Filen är ${finalMB.toFixed(0)} MB efter komprimering, vilket överstiger gränsen på ${MAX_UPLOAD_MB} MB. Försök med en kortare video.`
            );
          }
        }

        setStatusMsg("Laddar upp video…");
        setCompressionPct(null);
        const uploadExt = fileToUpload.name.split(".").pop()?.toLowerCase() || "mp4";
        const videoUpload = await uploadFileToObjectStorage({
          file: fileToUpload,
          kind: "video",
          filename: `dance-edit-video.${uploadExt}`,
          danceId: dance.id,
          requestId,
        });
        requestVideoUrl = videoUpload.url;
      }

      if (thumbnailBlob) {
        setStatusMsg("Laddar upp thumbnail…");
        const thumbnailUpload = await uploadFileToObjectStorage({
          file: thumbnailBlob,
          kind: "thumbnail",
          filename: "dance-edit-thumbnail.jpg",
          danceId: dance.id,
          requestId,
        });
        requestThumbnailUrl = thumbnailUpload.url;
      }

      const response = await fetch("/api/dance-edit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          danceId: dance.id,
          requestType: "edit",
          title: form.title.trim(),
          section: form.section,
          organization: form.organization,
          year: form.year.trim(),
          songTitle: form.title.trim(),
          dancerNames: form.dancer_names.trim(),
          artist: form.artist.trim() || null,
          spotifyUrl: form.spotify_url.trim() || null,
          videoUrl: requestVideoUrl,
          thumbnailUrl: requestThumbnailUrl,
          requesterNote: requesterNote.trim() || null,
          segments: proposedSegments.map((segment, index) => ({
            name: segment.name.trim(),
            description: segment.description.trim() || null,
            startTime: parseTime(segment.start_time_str),
            endTime: parseTime(segment.end_time_str),
            sortOrder: index,
          })),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Kunde inte skicka förslaget.");
      }

      setSuccess(true);
      setOpen(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "";
      setError(message || "Kunde inte skicka förslaget.");
    } finally {
      setLoading(false);
      setStatusMsg(null);
      setCompressionPct(null);
    }
  };

  const handleDeleteRequest = async () => {
    setDeleteError(null);
    setError(null);
    setDeleteSuccess(false);

    if (!deleteConfirm) {
      setDeleteError("Kryssa i att du förstår att dansen tas bort om admin godkänner.");
      return;
    }

    setDeleteLoading(true);

    try {
      const response = await fetch("/api/dance-edit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          danceId: dance.id,
          requestType: "delete",
          title: dance.title,
          section: dance.section,
          organization: dance.organization ?? "Nollningen",
          year: dance.year,
          songTitle: dance.song_title,
          dancerNames: dance.dancer_names ?? "",
          artist: dance.artist,
          spotifyUrl: dance.spotify_url,
          videoUrl: dance.video_url,
          thumbnailUrl: dance.thumbnail_url,
          requesterNote: requesterNote.trim() || "Användaren vill ta bort dansen.",
          segments: [],
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Kunde inte skicka borttagningsbegäran.");
      }

      setDeleteSuccess(true);
      setOpen(false);
    } catch (deleteRequestError) {
      const message = deleteRequestError instanceof Error ? deleteRequestError.message : "";
      setDeleteError(message || "Kunde inte skicka borttagningsbegäran.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleHideRequest = async () => {
    setHideError(null);
    setError(null);
    setHideSuccess(false);

    if (!hideIndefinitely && !hideUntil) {
      setHideError("Välj ett datum då dansen ska visas igen, eller välj tills vidare.");
      return;
    }

    if (!hideNote.trim()) {
      setHideError("Skriv en kommentar till admin.");
      return;
    }

    setHideLoading(true);

    try {
      const response = await fetch("/api/dance-edit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          danceId: dance.id,
          requestType: "hide",
          title: dance.title,
          section: dance.section,
          organization: dance.organization ?? "Nollningen",
          year: dance.year,
          songTitle: dance.song_title,
          dancerNames: dance.dancer_names ?? "",
          artist: dance.artist,
          spotifyUrl: dance.spotify_url,
          videoUrl: dance.video_url,
          thumbnailUrl: dance.thumbnail_url,
          requesterNote: hideNote.trim(),
          hideUntil: hideIndefinitely ? null : hideUntil,
          hideIndefinitely,
          segments: [],
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Kunde inte skicka gömningsbegäran.");
      }

      setHideSuccess(true);
      setHideUntil("");
      setHideNote("");
      setHideIndefinitely(false);
      setOpen(false);
    } catch (hideRequestError) {
      const message = hideRequestError instanceof Error ? hideRequestError.message : "";
      setHideError(message || "Kunde inte skicka gömningsbegäran.");
    } finally {
      setHideLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-900">Föreslå en ändring</h2>
          <p className="text-sm text-gray-500 mt-1">
            Om något är fel i dansen eller indelningen kan du skicka in ett ändringsförslag.
            Admin måste godkänna det innan den publika versionen uppdateras.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 bg-brand-100 hover:bg-brand-200 text-brand-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <PencilLine className="w-4 h-4" />
          {open ? "Stäng" : "Redigera dans"}
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Ditt ändringsförslag är inskickat och väntar nu på granskning.
        </div>
      )}

      {deleteSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Din borttagningsbegäran är inskickad och väntar nu på granskning.
        </div>
      )}

      {hideSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Din gömningsbegäran är inskickad och väntar nu på granskning.
        </div>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">1. Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Dansnamn *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value, song_title: e.target.value })
                  }
                  placeholder="t.ex. D-sektionens nolledans 2023"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Vilka dansar *</label>
                <input
                  type="text"
                  value={form.dancer_names}
                  onChange={(e) => setForm({ ...form, dancer_names: e.target.value })}
                  placeholder="t.ex. Nollor, Phaddrar, Sexmästeriet"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:col-span-2">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Sektion *</label>
                  <select
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value as Section })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  >
                    {SORTED_SECTIONS.map((section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Tillhör *</label>
                  <select
                    value={form.organization}
                    onChange={(e) =>
                      setForm({ ...form, organization: e.target.value as DanceOrganization })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  >
                    {ORGANIZATIONS.map((organization) => (
                      <option key={organization} value={organization}>
                        {organization}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">År *</label>
                  <input
                    type="text"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    placeholder="t.ex. 23"
                    maxLength={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Artist</label>
                <input
                  type="text"
                  value={form.artist}
                  onChange={(e) => setForm({ ...form, artist: e.target.value })}
                  placeholder="t.ex. The Weeknd"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Spotify-länk</label>
                <input
                  type="url"
                  value={form.spotify_url}
                  onChange={(e) => setForm({ ...form, spotify_url: e.target.value })}
                  placeholder="https://open.spotify.com/track/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">2. Dansdelar (timestamps)</h2>
            <p className="text-sm text-gray-500">
              Dela upp dansen i övningsbara delar. Användare kan sedan välja och loopa valda delar.
            </p>
            <SegmentForm
              segments={proposedSegments}
              onChange={setProposedSegments}
              videoDuration={videoDuration}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-base font-semibold text-gray-900">3. Avancerat</h2>
              <button
                type="button"
                onClick={() => setAdvancedOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                {advancedOpen ? "Dölj avancerade inställningar" : "Visa avancerade inställningar"}
              </button>
            </div>

            {advancedOpen && (
              <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-900">Video</h3>
                  <video
                    src={editableVideoUrl}
                    controls
                    className="w-full max-h-56 rounded-lg bg-black"
                  />

                  <div
                    onClick={() => !loading && videoInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                      loading
                        ? "opacity-60 cursor-not-allowed"
                        : "cursor-pointer"
                    } ${
                      videoFile
                        ? "border-brand-400 bg-brand-50"
                        : "border-gray-300 hover:border-brand-400 bg-white"
                    }`}
                  >
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleVideoChange}
                      disabled={loading}
                    />
                    {videoFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-brand-700">{videoFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                          {videoDuration !== undefined &&
                            ` · ${Math.floor(videoDuration / 60)}:${String(
                              Math.floor(videoDuration % 60)
                            ).padStart(2, "0")}`}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="mx-auto w-7 h-7 text-gray-400" />
                        <p className="text-sm text-gray-600">Klicka för att välja ny videofil</p>
                        <p className="text-xs text-gray-400">
                          Nuvarande video behålls om du inte väljer en ny.
                        </p>
                      </div>
                    )}
                  </div>

                  {videoFile && (
                    <button
                      type="button"
                      onClick={resetVideo}
                      className="px-3 py-2 text-xs font-medium border border-gray-300 hover:border-gray-400 text-gray-700 rounded-md transition-colors"
                    >
                      Återställ till nuvarande video
                    </button>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-white">
                  <p className="text-sm font-medium text-gray-800">Välj preview-bild till startsidan</p>

                  <video
                    ref={captureVideoRef}
                    src={editableVideoUrl}
                    className="hidden"
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedMetadata={() => {
                      const v = captureVideoRef.current;
                      if (!v) return;
                      setVideoDuration(v.duration);
                      const safeTime = Math.min(frameTime, Math.max(0, (v.duration || 0) - 0.1));
                      v.currentTime = safeTime;
                    }}
                    onSeeked={() => {
                      if (!pendingThumbnailCaptureRef.current) return;
                      pendingThumbnailCaptureRef.current = false;
                      captureThumbnailAtCurrentTime();
                    }}
                  />

                  {videoDuration !== undefined && videoDuration > 0 && (
                    <div className="space-y-2">
                      <label className="block text-xs text-gray-600">
                        Tidpunkt: {Math.floor(frameTime / 60)}:{String(Math.floor(frameTime % 60)).padStart(2, "0")}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, Math.floor(videoDuration))}
                        step={1}
                        value={Math.min(frameTime, Math.max(0, Math.floor(videoDuration)))}
                        onChange={(e) => {
                          const t = Number(e.target.value);
                          setFrameTime(t);
                          const v = captureVideoRef.current;
                          if (v) {
                            const safeTime = Math.min(t, Math.max(0, (v.duration || t) - 0.1));
                            v.currentTime = safeTime;
                          }
                        }}
                        className="w-full"
                      />
                    </div>
                  )}

                  <canvas ref={frameCanvasRef} className="hidden" />

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={useCurrentFrameAsThumbnail}
                      className="px-3 py-2 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-md transition-colors"
                    >
                      Använd denna frame
                    </button>
                    {thumbnailHasNewPreview && (
                      <button
                        type="button"
                        onClick={resetThumbnail}
                        className="px-3 py-2 text-xs font-medium border border-gray-300 hover:border-gray-400 text-gray-700 rounded-md transition-colors"
                      >
                        Återställ till nuvarande thumbnail
                      </button>
                    )}
                    <span className="text-xs text-gray-500">
                      Nuvarande thumbnail behålls automatiskt om du inte väljer en ny frame.
                    </span>
                  </div>

                  {thumbnailPreviewUrl && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600">Vald preview:</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbnailPreviewUrl}
                        alt="Vald preview"
                        className="w-full max-h-40 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
          <section className="space-y-2">
            <label className="block text-sm text-gray-700">Kommentar till admin</label>
            <textarea
              value={requesterNote}
              onChange={(e) => setRequesterNote(e.target.value)}
              rows={3}
              placeholder="Beskriv gärna vad som borde ändras och varför."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {loading && compressionPct !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Komprimerar video…</span>
                <span>{compressionPct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${compressionPct}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="truncate">{statusMsg ?? "Skickar…"}</span>
              </>
            ) : (
              "Skicka ändringsförslag"
            )}
          </button>

        </form>
      )}

      <section className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <EyeOff className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-amber-800">Göm dans</h2>
            <p className="text-sm text-amber-800">
              Skicka en begäran till admin om att tillfälligt gömma den här dansen från hemsidan.
              Dansen göms först när admin godkänner begäran.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-amber-900">Visa igen</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              value={hideUntil}
              onChange={(e) => {
                setHideUntil(e.target.value);
                if (e.target.value) setHideIndefinitely(false);
              }}
              disabled={hideLoading || loading || hideIndefinitely}
              className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-amber-100/70"
            />
            <label className="flex items-center gap-2 text-sm text-amber-800 border border-amber-200 rounded-lg px-3 py-2 bg-white/70">
              <input
                type="checkbox"
                checked={hideIndefinitely}
                onChange={(e) => {
                  setHideIndefinitely(e.target.checked);
                  if (e.target.checked) setHideUntil("");
                }}
                disabled={hideLoading || loading}
                className="w-4 h-4 accent-amber-600"
              />
              Tills vidare
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-amber-900">Kommentar till admin *</label>
          <textarea
            value={hideNote}
            onChange={(e) => setHideNote(e.target.value)}
            rows={3}
            placeholder="Beskriv varför dansen bör gömmas."
            disabled={hideLoading || loading}
            className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {hideError && (
          <p className="text-sm text-amber-800 bg-white border border-amber-200 rounded-lg px-3 py-2">
            {hideError}
          </p>
        )}

        <button
          type="button"
          onClick={handleHideRequest}
          disabled={hideLoading || loading}
          className="w-full border border-amber-300 bg-white hover:bg-amber-100 disabled:opacity-60 text-amber-800 font-medium py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {hideLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Skickar gömningsbegäran...
            </>
          ) : (
            "Begär gömning"
          )}
        </button>
      </section>

      <section className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Trash2 className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-red-700">Ta bort dans</h2>
            <p className="text-sm text-red-700">
              Skicka en begäran till admin om att ta bort den här dansen från hemsidan.
              Dansen försvinner först när admin godkänner begäran.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-red-700">
          <input
            type="checkbox"
            checked={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.checked)}
            disabled={deleteLoading || loading}
            className="mt-1 w-4 h-4 accent-red-600"
          />
          Jag förstår att dansen tas bort från hemsidan om admin godkänner.
        </label>

        {deleteError && (
          <p className="text-sm text-red-700 bg-white border border-red-200 rounded-lg px-3 py-2">
            {deleteError}
          </p>
        )}

        <button
          type="button"
          onClick={handleDeleteRequest}
          disabled={deleteLoading || loading}
          className="w-full border border-red-300 bg-white hover:bg-red-100 disabled:opacity-60 text-red-700 font-medium py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {deleteLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Skickar borttagningsbegäran…
            </>
          ) : (
            "Begär borttagning"
          )}
        </button>
      </section>
    </div>
  );
}
