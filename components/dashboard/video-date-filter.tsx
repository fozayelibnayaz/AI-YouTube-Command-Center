"use client";
import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "28d", days: 28 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
  { label: "1y", days: 365 },
  { label: "All", days: 3650 },
];

interface Props {
  selected: number;
  onChange: (days: number) => void;
}

export function VideoDateFilter({ selected, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Calendar size={10} className="text-gray-500" />
      {RANGES.map(r => (
        <button
          key={r.days}
          onClick={() => onChange(r.days)}
          className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
            selected === r.days
              ? "bg-blue-600 text-white"
              : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
