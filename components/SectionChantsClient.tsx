"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle, ChevronDown, Loader2, Plus } from "lucide-react";
import { Section, SectionChant } from "@/lib/types";
import { getSectionTheme } from "@/lib/utils";

const SECTIONS: Section[] = ["A", "D", "E", "F", "I", "ING", "K", "M", "V", "W"];

function getChantSectionStyle(section: Section) {
  const theme = getSectionTheme(section);

  if (section === "E") {
    return {
      backgroundColor: "#FFFFFF",
      borderColor: "#111827",
      labelColor: "#111827",
      itemBorderColor: "#111827",
    };
  }

  if (section === "K") {
    return {
      backgroundColor: theme.tint,
      borderColor: theme.border,
      labelColor: "#111827",
      itemBorderColor: "#FFFFFF",
    };
  }

  return {
    backgroundColor: theme.tint,
    borderColor: theme.border,
    labelColor: theme.labelColor,
    itemBorderColor: "#FFFFFF",
  };
}

interface SectionChantsClientProps {
  initialChants: SectionChant[];
}

export default function SectionChantsClient({ initialChants }: SectionChantsClientProps) {
  const [section, setSection] = useState<Section>("D");
  const [name, setName] = useState("");
  const [melody, setMelody] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const groupedChants = useMemo(() => {
    return SECTIONS.map((sectionName) => ({
      section: sectionName,
      chants: initialChants
        .filter((chant) => chant.section === sectionName)
        .sort((a, b) => a.name.localeCompare(b.name, "sv")),
    }));
  }, [initialChants]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedName = name.trim();
    const trimmedMelody = melody.trim();
    const trimmedLyrics = lyrics.trim();

    if (!trimmedName) {
      setError("Ramsans namn krävs.");
      return;
    }

    if (!trimmedMelody) {
      setError("Melodi krävs.");
      return;
    }

    if (!trimmedLyrics) {
      setError("Ramsa krävs.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/section-chants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section,
        name: trimmedName,
        melody: trimmedMelody,
        lyrics: trimmedLyrics,
      }),
    });

    const payload = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Kunde inte skicka ramsan.");
      return;
    }

    setName("");
    setMelody("");
    setLyrics("");
    setSuccess(true);
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="order-2 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Plus className="w-5 h-5 text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Ladda upp ramsa</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Sektion</label>
              <select
                value={section}
                onChange={(event) => setSection(event.target.value as Section)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                disabled={loading}
              >
                {SECTIONS.map((sectionName) => (
                  <option key={sectionName} value={sectionName}>
                    {sectionName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Ramsans namn</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="t.ex. Störst och bäst i Skåne"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                disabled={loading}
              />
            </div>
          </div>

          <div>
              <label className="block text-sm text-gray-700 mb-1">Melodi</label>
              <input
                type="text"
                value={melody}
                onChange={(event) => setMelody(event.target.value)}
                placeholder="t.ex. Melodi: Hej tomtegubbar"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                disabled={loading}
              />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Ramsa</label>
            <textarea
              value={lyrics}
              onChange={(event) => setLyrics(event.target.value)}
              placeholder="Skriv hela ramsan här..."
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-y"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {success && (
            <p className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Ramsan är skickad och väntar på godkännande.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Laddar upp...
              </>
            ) : (
              "Ladda upp ramsa"
            )}
          </button>
        </form>
      </section>

      <section className="order-1 space-y-5">
        <h2 className="text-2xl font-bold text-gray-900">Sektionsramsor</h2>

        {groupedChants.map(({ section: sectionName, chants: sectionChants }) => {
          const sectionStyle = getChantSectionStyle(sectionName);

          return (
            <div
              key={sectionName}
              className="border rounded-2xl p-4 sm:p-5"
              style={{
                backgroundColor: sectionStyle.backgroundColor,
                borderColor: sectionStyle.borderColor,
              }}
            >
              <h3
                className="text-lg font-bold mb-4"
                style={{ color: sectionStyle.labelColor }}
              >
                {sectionName} - Sektionen
              </h3>

              {sectionChants.length === 0 ? (
                <p
                  className="text-sm text-gray-600 bg-white/70 border rounded-lg px-4 py-3"
                  style={{ borderColor: sectionStyle.itemBorderColor }}
                >
                  Inga ramsor uppladdade ännu.
                </p>
              ) : (
                <div className="space-y-3">
                  {sectionChants.map((chant) => {
                    const isOpen = openId === chant.id;

                    return (
                      <article
                        key={chant.id}
                        className="bg-white/90 border rounded-xl shadow-sm overflow-hidden"
                        style={{ borderColor: sectionStyle.itemBorderColor }}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenId(isOpen ? null : chant.id)}
                          className="w-full min-h-14 px-4 py-3 flex items-center justify-between gap-4 text-left hover:bg-white transition-colors"
                          aria-expanded={isOpen}
                        >
                          <span className="font-semibold text-gray-950 break-words">
                            {chant.name}
                          </span>
                          <ChevronDown
                            className={`w-5 h-5 text-gray-600 shrink-0 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                            <p className="text-sm text-gray-800">
                              <span className="font-semibold text-gray-950">Melodi: </span>
                              {chant.melody}
                            </p>
                            <p className="whitespace-pre-line text-sm leading-6 text-gray-800">
                              {chant.lyrics}
                            </p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
