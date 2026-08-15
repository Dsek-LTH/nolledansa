import { TrendingUp } from "lucide-react";
import { TrendingDance } from "@/lib/types";
import DanceCard from "./DanceCard";

interface TrendingSectionProps {
  dances: TrendingDance[];
}

export default function TrendingSection({ dances }: TrendingSectionProps) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
        <TrendingUp className="w-5 h-5 text-purple-600" />
        Trendar just nu
        <span className="text-xs font-normal text-gray-400">(senaste 7 dagarna)</span>
      </h2>
      {dances.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>Inga klick registrerade senaste veckan ännu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {dances.slice(0, 10).map((dance) => (
            <DanceCard key={dance.id} dance={dance} showTrending />
          ))}
        </div>
      )}
    </section>
  );
}
