import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpDown, Filter, Music2, X } from "lucide-react";
import DanceCard from "@/components/DanceCard";
import { Dance, DanceOrganization, Section } from "@/lib/types";
import { getApprovedDancesByFilters, getAvailableApprovedYears } from "@/lib/store";

export const metadata: Metadata = {
  title: "Danser - NolleDansa",
};
export const dynamic = "force-dynamic";

const SECTIONS: Section[] = ["A", "D", "E", "F", "I", "ING", "K", "M", "V", "W"];
const ORGANIZATIONS: DanceOrganization[] = [
  "Nollningen",
  "Sexmästeriet",
  "Phusk",
];
const SORT_OPTIONS = [
  { value: "section", label: "Sektion" },
  { value: "newest", label: "Nya först" },
  { value: "oldest", label: "Äldst först" },
  { value: "popular", label: "Populärast" },
] as const;

type DanceSort = (typeof SORT_OPTIONS)[number]["value"];

interface DancesPageProps {
  searchParams: Promise<{
    section?: string | string[];
    year?: string | string[];
    organization?: string | string[];
    sort?: string | string[];
  }>;
}

function isSection(value: string): value is Section {
  return !!value && SECTIONS.includes(value as Section);
}

function isOrganization(value: string): value is DanceOrganization {
  return !!value && ORGANIZATIONS.includes(value as DanceOrganization);
}

function getParamValues(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => item.trim()).filter(Boolean);
}

function isDanceSort(value: string): value is DanceSort {
  return SORT_OPTIONS.some((option) => option.value === value);
}

async function getDances(filters: {
  sections: Section[];
  years: string[];
  organizations: DanceOrganization[];
  sort: DanceSort;
}): Promise<Dance[]> {
  return getApprovedDancesByFilters(filters);
}

async function getAvailableYears(): Promise<string[]> {
  return getAvailableApprovedYears();
}

export default async function DancesPage({ searchParams }: DancesPageProps) {
  const params = await searchParams;
  const selectedSections = getParamValues(params.section).filter(isSection);
  const selectedYears = getParamValues(params.year);
  const selectedOrganizations = getParamValues(params.organization).filter(isOrganization);
  const requestedSort = getParamValues(params.sort)[0];
  const selectedSort: DanceSort = isDanceSort(requestedSort) ? requestedSort : "newest";

  const [dances, years] = await Promise.all([
    getDances({
      sections: selectedSections,
      years: selectedYears,
      organizations: selectedOrganizations,
      sort: selectedSort,
    }),
    getAvailableYears(),
  ]);

  const hasFilters =
    selectedSections.length > 0 ||
    selectedYears.length > 0 ||
    selectedOrganizations.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Danser</h1>
          <p className="text-gray-500 mt-1">
            Bläddra bland alla godkända danser och filtrera efter sektion, år och typ.
          </p>
        </div>
        {hasFilters && (
          <Link
            href="/danser"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-700 transition-colors"
          >
            <X className="w-4 h-4" />
            Rensa
          </Link>
        )}
      </div>

      <form className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-gray-900">Filter</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-4">
          <div>
            <p className="block text-xs text-gray-500 mb-2">Sektion</p>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((section) => (
                <label
                  key={section}
                  className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-white"
                >
                  <input
                    type="checkbox"
                    name="section"
                    value={section}
                    defaultChecked={selectedSections.includes(section)}
                    className="w-4 h-4 accent-brand-600"
                  />
                  {section}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="block text-xs text-gray-500 mb-2">År</p>
            <div className="flex flex-wrap gap-2">
              {years.map((year) => (
                <label
                  key={year}
                  className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-white"
                >
                  <input
                    type="checkbox"
                    name="year"
                    value={year}
                    defaultChecked={selectedYears.includes(year)}
                    className="w-4 h-4 accent-brand-600"
                  />
                  {year}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="block text-xs text-gray-500 mb-2">Typ</p>
            <div className="flex flex-wrap gap-2">
              {ORGANIZATIONS.map((organization) => (
                <label
                  key={organization}
                  className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-white"
                >
                  <input
                    type="checkbox"
                    name="organization"
                    value={organization}
                    defaultChecked={selectedOrganizations.includes(organization)}
                    className="w-4 h-4 accent-brand-600"
                  />
                  {organization}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sortera
            </p>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-white"
                >
                  <input
                    type="radio"
                    name="sort"
                    value={option.value}
                    defaultChecked={selectedSort === option.value}
                    className="w-4 h-4 accent-brand-600"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="w-full lg:w-auto bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Filtrera
            </button>
            {hasFilters && (
              <Link
                href="/danser"
                className="sm:hidden border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-2 rounded-lg transition-colors"
                aria-label="Rensa filter"
              >
                <X className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </form>

      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-gray-900">Alla danser</h2>
          <span className="text-sm text-gray-500">
            {dances.length} resultat
          </span>
        </div>

        {dances.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-xl">
            <Music2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Inga danser matchade filtren.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {dances.map((dance) => (
              <DanceCard
                key={dance.id}
                dance={dance}
                showTrending={selectedSort === "popular"}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
