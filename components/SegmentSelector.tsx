"use client";

import { DanceSegment } from "@/lib/types";
import { formatTime } from "@/lib/utils";

interface SegmentSelectorProps {
  segments: DanceSegment[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export default function SegmentSelector({
  segments,
  selectedIds,
  onToggle,
}: SegmentSelectorProps) {
  if (segments.length === 0) {
    return (
      <p className="text-sm text-gray-500">Den här dansen har inga sparade delar ännu.</p>
    );
  }

  const handleSelectAll = () => {
    segments.forEach((s) => {
      if (!selectedIds.has(s.id)) onToggle(s.id);
    });
  };

  const handleDeselectAll = () => {
    segments.forEach((s) => {
      if (selectedIds.has(s.id)) onToggle(s.id);
    });
  };

  const allSelected = segments.every((s) => selectedIds.has(s.id));
  const noneSelected = segments.every((s) => !selectedIds.has(s.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={allSelected ? handleDeselectAll : handleSelectAll}
          className="text-xs text-brand-600 hover:text-brand-800 underline"
        >
          {allSelected ? "Avmarkera alla" : "Markera alla"}
        </button>
        {noneSelected && (
          <span className="text-xs text-amber-600">Välj minst en del för att loopa</span>
        )}
      </div>

      <div className="grid gap-2">
        {segments.map((seg) => {
          const checked = selectedIds.has(seg.id);
          return (
            <label
              key={seg.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                checked
                  ? "border-brand-400 bg-brand-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(seg.id)}
                className="w-4 h-4 accent-brand-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{seg.name}</p>
                {seg.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{seg.description}</p>
                )}
              </div>
              <span className="text-xs tabular-nums text-gray-500 shrink-0">
                {formatTime(seg.start_time)} – {formatTime(seg.end_time)}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
