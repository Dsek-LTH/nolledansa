"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { SegmentFormData } from "@/lib/types";
import { formatTime, parseTime } from "@/lib/utils";

interface SegmentFormProps {
  segments: SegmentFormData[];
  onChange: (segments: SegmentFormData[]) => void;
  videoDuration?: number; // seconds
}

const emptySegment = (): SegmentFormData => ({
  name: "",
  description: "",
  start_time_str: "0:00",
  end_time_str: "0:00",
  sort_order: 0,
});

function validateSegment(
  seg: SegmentFormData,
  videoDuration?: number
): string | null {
  if (!seg.name.trim()) return "Namn krävs";
  const start = parseTime(seg.start_time_str);
  const end = parseTime(seg.end_time_str);
  if (isNaN(start)) return "Ogiltig starttid (använd mm:ss)";
  if (isNaN(end)) return "Ogiltig sluttid (använd mm:ss)";
  if (start >= end) return "Starttid måste vara mindre än sluttid";
  if (videoDuration !== undefined) {
    if (end > videoDuration)
      return `Sluttid (${formatTime(end)}) överstiger videons längd (${formatTime(videoDuration)})`;
  }
  return null;
}

export default function SegmentForm({
  segments,
  onChange,
  videoDuration,
}: SegmentFormProps) {
  const [errors, setErrors] = useState<Record<number, string>>({});

  const add = () => {
    const last = segments[segments.length - 1];
    const newSeg = emptySegment();
    newSeg.sort_order = segments.length;
    if (last) {
      // Pre-fill both times with the previous segment's end time
      newSeg.start_time_str = last.end_time_str;
      newSeg.end_time_str = last.end_time_str;
    }
    onChange([...segments, newSeg]);
  };

  const remove = (index: number) => {
    const updated = segments
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, sort_order: i }));
    onChange(updated);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= segments.length) return;

    const updated = [...segments];
    const [moved] = updated.splice(index, 1);
    updated.splice(target, 0, moved);

    const normalized = updated.map((segment, i) => ({
      ...segment,
      sort_order: i,
    }));

    onChange(normalized);
  };

  const update = (index: number, field: keyof SegmentFormData, value: string | number) => {
    const updated = segments.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    onChange(updated);

    // Validate inline
    const err = validateSegment(updated[index], videoDuration);
    setErrors((prev) => ({ ...prev, [index]: err ?? "" }));
  };

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Del {i + 1}</span>
              <span className="text-xs text-gray-400">(ordning {seg.sort_order + 1})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
                title="Flytta upp"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === segments.length - 1}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
                title="Flytta ned"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                title="Ta bort"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Namn *</label>
              <input
                type="text"
                value={seg.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder="t.ex. Intro, Refräng, Vers 1"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Beskrivning</label>
              <input
                type="text"
                value={seg.description}
                onChange={(e) => update(i, "description", e.target.value)}
                placeholder="Valfri beskrivning"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Starttid (mm:ss) *</label>
              <input
                type="text"
                value={seg.start_time_str}
                onChange={(e) => update(i, "start_time_str", e.target.value)}
                placeholder="0:00"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sluttid (mm:ss) *</label>
              <input
                type="text"
                value={seg.end_time_str}
                onChange={(e) => update(i, "end_time_str", e.target.value)}
                placeholder="0:30"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>

          {errors[i] && (
            <p className="text-xs text-red-500">{errors[i]}</p>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-800 border border-dashed border-brand-300 hover:border-brand-500 px-4 py-2 rounded-lg w-full justify-center transition-colors"
      >
        <Plus className="w-4 h-4" />
        Lägg till del
      </button>
    </div>
  );
}
