import { isAdmin } from "@/lib/auth-helpers";
import { Dance, DanceEditRequest, SectionChant } from "@/lib/types";
import { sectionLabel } from "@/lib/utils";
import Link from "next/link";
import AdminLoginForm from "@/components/AdminLoginForm";
import { approveSectionChant, rejectSectionChant, restoreHiddenDance } from "./actions";
import { ShieldCheck, Clock, Eye, EyeOff, Music, PencilLine, MessageSquareText, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getAdminOverviewData, getDancesByIds } from "@/lib/store";

export const metadata: Metadata = {
  title: "Admin – NolleDansa",
};

// Tvinga dynamic rendering (ingen caching)
export const dynamic = "force-dynamic";

interface AdminPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await isAdmin();

  if (!admin) {
    return <AdminLoginForm />;
  }

  const params = await searchParams;
  const activeTab = params?.tab === "hidden" ? "hidden" : "pending";

  const { dances, editRequests, sectionChants, hiddenDances: hidden } = await getAdminOverviewData();

  const danceIdsForRequests = [...new Set(editRequests.map((r) => r.dance_id))];
  const requestDances = await getDancesByIds(danceIdsForRequests);

  const requestDanceMap = new Map(requestDances.map((dance) => [dance.id, dance]));
  const hasPendingItems = dances.length > 0 || editRequests.length > 0 || sectionChants.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-brand-600" />
        <h1 className="text-2xl font-bold text-gray-900">Admin-panel</h1>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <Link
          href="/admin"
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "pending"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          Ärenden
        </Link>
        <Link
          href="/admin?tab=hidden"
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "hidden"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <EyeOff className="w-4 h-4" />
          Gömda danser
        </Link>
      </div>

      {activeTab === "hidden" ? (
        hidden.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              {hidden.length} gömd{hidden.length !== 1 ? "a" : ""} dans{hidden.length !== 1 ? "er" : ""}.
            </p>
            <div className="space-y-3">
              {hidden.map((dance) => (
                <div
                  key={dance.id}
                  className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <EyeOff className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-gray-900 truncate">{dance.title}</p>
                        <p className="text-xs text-gray-500">
                          {sectionLabel(dance.section, dance.year)} · {dance.song_title}
                          {dance.artist ? ` · ${dance.artist}` : ""}
                        </p>
                        <p className="text-xs text-gray-500">
                          Visa igen: {dance.hidden_until ? new Date(dance.hidden_until).toLocaleDateString("sv-SE") : "Tills vidare"}
                          {dance.hidden_at ? ` · Gömd ${new Date(dance.hidden_at).toLocaleDateString("sv-SE")}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full shrink-0">
                      Gömd
                    </span>
                  </div>

                  {dance.hidden_note && (
                    <p className="whitespace-pre-line text-sm leading-6 text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      {dance.hidden_note}
                    </p>
                  )}

                  <form action={restoreHiddenDance.bind(null, dance.id)}>
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Visa dans igen
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
            <EyeOff className="mx-auto w-10 h-10 mb-3 opacity-50" />
            <p>Inga danser är gömda.</p>
          </div>
        )
      ) : hasPendingItems ? (
        <div className="space-y-8">
          {dances.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                {dances.length} ny{dances.length !== 1 ? "a" : ""} dans{dances.length !== 1 ? "er" : ""} väntar på granskning.
              </p>
              <div className="space-y-2">
                {dances.map((dance) => (
                  <Link
                    key={dance.id}
                    href={`/admin/${dance.id}`}
                    className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Music className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{dance.title}</p>
                        <p className="text-xs text-gray-500">
                          {sectionLabel(dance.section, dance.year)} · {dance.song_title}
                          {dance.artist ? ` · ${dance.artist}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                        Ny dans
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(dance.created_at).toLocaleDateString("sv-SE")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {editRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                {editRequests.length} ändringsförslag väntar på granskning.
              </p>
              <div className="space-y-2">
                {editRequests.map((request) => {
                  const targetDance = requestDanceMap.get(request.dance_id);
                  const requestType = request.request_type ?? "edit";
                  const isDeleteRequest = requestType === "delete";
                  const isHideRequest = requestType === "hide";
                  const RequestIcon = isDeleteRequest ? Trash2 : isHideRequest ? EyeOff : PencilLine;
                  const requestLabel = isDeleteRequest
                    ? "Borttagningsbegäran"
                    : isHideRequest
                      ? "Gömningsbegäran"
                      : "Ändringsförslag";
                  return (
                    <Link
                      key={request.id}
                      href={`/admin/edits/${request.id}`}
                      className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-brand-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <RequestIcon className="w-5 h-5 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {targetDance?.title ?? request.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(targetDance
                              ? sectionLabel(targetDance.section, targetDance.year)
                              : sectionLabel(request.section, request.year)) +
                              ` · ${requestLabel}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs border px-2 py-1 rounded-full ${
                            isDeleteRequest
                              ? "text-red-700 bg-red-50 border-red-200"
                              : isHideRequest
                                ? "text-amber-700 bg-amber-50 border-amber-200"
                              : "text-blue-700 bg-blue-50 border-blue-200"
                          }`}
                        >
                          {isDeleteRequest ? "Borttagning" : isHideRequest ? "Gömning" : "Ändring"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(request.created_at).toLocaleDateString("sv-SE")}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {sectionChants.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                {sectionChants.length} sektionsrams{sectionChants.length !== 1 ? "or" : "a"} väntar på granskning.
              </p>
              <div className="space-y-3">
                {sectionChants.map((chant) => (
                  <div
                    key={chant.id}
                    className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <MessageSquareText className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-gray-900 truncate">{chant.name}</p>
                          <p className="text-xs text-gray-500">
                            {chant.section} - Sektionen · Melodi: {chant.melody}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full shrink-0">
                        Ny ramsa
                      </span>
                    </div>

                    <p className="whitespace-pre-line text-sm leading-6 text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      {chant.lyrics}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <form action={approveSectionChant.bind(null, chant.id)} className="flex-1">
                        <button
                          type="submit"
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                        >
                          Godkänn ramsa
                        </button>
                      </form>
                      <form action={rejectSectionChant.bind(null, chant.id)} className="flex-1">
                        <button
                          type="submit"
                          className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-medium py-2.5 rounded-lg text-sm transition-colors"
                        >
                          Neka ramsa
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          <Clock className="mx-auto w-10 h-10 mb-3 opacity-50" />
          <p>Inga ärenden väntar på granskning.</p>
        </div>
      )}
    </div>
  );
}
