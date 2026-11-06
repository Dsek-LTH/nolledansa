import { Suspense } from "react";
import Link from "next/link";
import { Dance, TrendingDance } from "@/lib/types";
import {
  getLatestYearDances as getLatestYearDancesFromStore,
  getRandomApprovedDances,
  getTrendingDances as getTrendingDancesFromStore,
  searchApprovedDances,
} from "@/lib/store";
import SearchBar from "@/components/SearchBar";
import TrendingSection from "@/components/TrendingSection";
import DanceCard from "@/components/DanceCard";
import { Music2 } from "lucide-react";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export const dynamic = "force-dynamic";

async function getTrendingDances(): Promise<TrendingDance[]> {
  return getTrendingDancesFromStore();
}

async function searchDances(query: string): Promise<Dance[]> {
  return searchApprovedDances(query);
}

async function getRandomDances(): Promise<Dance[]> {
  return getRandomApprovedDances(12);
}

async function getLatestYearDances(): Promise<Dance[]> {
  return getLatestYearDancesFromStore();
}

export default async function HomePage({ searchParams }: HomeProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [trending, yearlyDances, dances] = await Promise.all([
    getTrendingDances(),
    query ? Promise.resolve([] as Dance[]) : getLatestYearDances(),
    query ? searchDances(query) : getRandomDances(),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <section className="text-center space-y-4 py-8">
        <div className="flex items-center justify-center gap-3">
          <Music2 className="w-10 h-10 text-brand-600" />
          <h1 className="text-4xl font-bold text-gray-900">NolleDansa</h1>
        </div>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          Träna nolledanser från LTH:s sektioner. Välj delar och loopa dem tills du kan dem.
        </p>
        <div className="flex justify-center">
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>
      </section>

      {!query ? (
        <>
          <TrendingSection dances={trending} />

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Årets danser</h2>
            {yearlyDances.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-xl">
                <Music2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Inga godkända danser ännu.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {yearlyDances.map((dance) => (
                  <DanceCard key={`year-${dance.id}`} dance={dance} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Alla danser</h2>
            {dances.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Music2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inga danser uppladdade ännu.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {dances.map((dance) => (
                    <DanceCard key={dance.id} dance={dance} />
                  ))}
                </div>
                <div className="flex justify-center">
                  <Link
                    href="/danser"
                    className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                  >
                    Visa alla danser
                  </Link>
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">{`Resultat för "${query}"`}</h2>
          {dances.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Music2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Inga danser matchade sökningen.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {dances.map((dance) => (
                <DanceCard key={dance.id} dance={dance} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
