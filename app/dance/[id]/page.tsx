import { notFound } from "next/navigation";
import { Dance, DanceSegment } from "@/lib/types";
import { sectionLabel, sectionLabelWithOrganization } from "@/lib/utils";
import DanceClient from "@/components/DanceClient";
import { ExternalLink, Music } from "lucide-react";
import type { Metadata } from "next";
import { getApprovedDanceById, getDanceMetadata, getDanceSegments } from "@/lib/store";

interface PageProps {
  params: Promise<{ id: string }>;
}
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getDanceMetadata(id);
  if (!data) return { title: "Dans – NolleDansa" };
  return { title: `${data.title} (${sectionLabel(data.section, data.year)}) – NolleDansa` };
}

export default async function DancePage({ params }: PageProps) {
  const { id } = await params;
  const [dance, segments] = await Promise.all([
    getApprovedDanceById(id),
    getDanceSegments(id),
  ]);

  if (!dance) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-brand-100 text-brand-700 text-sm font-bold px-2.5 py-1 rounded-md">
              {sectionLabelWithOrganization(dance.section, dance.year, dance.organization)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{dance.title}</h1>
          {dance.dancer_names && (
            <p className="text-gray-600 mt-1">{dance.dancer_names}</p>
          )}
          <p className="text-gray-500 mt-1 flex items-center gap-1">
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
            className="shrink-0 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
          >
            {/* Spotify icon (simplified) */}
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Öppna i Spotify
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Player + segment selector */}
      <DanceClient
        dance={dance}
        danceId={dance.id}
        videoUrl={dance.video_url}
        segments={segments}
      />
    </div>
  );
}
