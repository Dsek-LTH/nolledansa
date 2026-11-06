import { isAdmin } from "@/lib/auth-helpers";
import { Dance, DanceSegment } from "@/lib/types";
import { sectionLabel, formatTime } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";
import { approveDance, rejectDance } from "../actions";
import { Music, ExternalLink, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getDanceById, getDanceSegments } from "@/lib/store";

export const metadata: Metadata = { title: "Granska dans – NolleDansa" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminDancePage({ params }: PageProps) {
  const admin = await isAdmin();
  if (!admin) redirect("/admin");

  const { id } = await params;
  const [dance, segments] = await Promise.all([getDanceById(id), getDanceSegments(id)]);

  if (!dance) notFound();

  const statusLabel: Record<string, string> = {
    pending: "Väntar",
    approved: "Godkänd",
    rejected: "Nekad",
  };
  const statusColors: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Tillbaka till admin
      </Link>

      {/* Dance info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-brand-100 text-brand-700 text-sm font-bold px-2.5 py-1 rounded-md">
                {sectionLabel(dance.section, dance.year)}
              </span>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full border ${
                  statusColors[dance.status] ?? ""
                }`}
              >
                {statusLabel[dance.status] ?? dance.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{dance.title}</h1>
            {dance.dancer_names && (
              <p className="text-gray-600 text-sm mt-0.5">{dance.dancer_names}</p>
            )}
            <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1">
              <Music className="w-4 h-4" />
              {dance.song_title}
              {dance.artist && ` · ${dance.artist}`}
            </p>
          </div>

          {dance.spotify_url && (
            <a
              href={dance.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 underline"
            >
              Spotify <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Video */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Video</p>
          <video
            src={dance.video_url}
            controls
            className="w-full rounded-lg max-h-72 bg-black"
          />
        </div>

        {/* Segments */}
        {segments.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Dansdelar ({segments.length} st)
            </p>
            <div className="space-y-1">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50"
                >
                  <div>
                    <span className="font-medium text-gray-800">{seg.name}</span>
                    {seg.description && (
                      <span className="text-gray-400 ml-2 text-xs">{seg.description}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {formatTime(seg.start_time)} – {formatTime(seg.end_time)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions – only show for pending */}
      {dance.status === "pending" && (
        <div className="flex gap-3">
          <form
            action={async () => {
              "use server";
              await approveDance(id);
            }}
            className="flex-1"
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Godkänn – publicera dansen
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await rejectDance(id);
            }}
            className="flex-1"
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium py-3 rounded-xl text-sm transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Neka
            </button>
          </form>
        </div>
      )}

      {dance.status === "approved" && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-700">
          Den här dansen är godkänd och visas publikt.{" "}
          <Link href={`/dance/${dance.id}`} className="underline">
            Visa publik sida
          </Link>
        </div>
      )}

      {dance.status === "rejected" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          Den här dansen är nekad och visas inte publikt.
        </div>
      )}
    </div>
  );
}
