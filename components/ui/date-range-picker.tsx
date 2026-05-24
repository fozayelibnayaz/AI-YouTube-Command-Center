"use client";
import { useState } from "react";
import { Calendar, ChevronDown, X, GitCompareArrows } from "lucide-react";
import { DateRange, getPresetRanges, getComparisonRanges, makeCustomRange } from "@/lib/date-ranges";

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"presets" | "comparison" | "custom">("presets");
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);

  const presets = getPresetRanges();
  const comparisons = getComparisonRanges();

  function applyCustom() {
    if (!customStart || !customEnd) return;
    if (new Date(customStart) > new Date(customEnd)) {
      alert("Start date must be before end date");
      return;
    }
    onChange(makeCustomRange(customStart, customEnd));
    setOpen(false);
  }

  function selectRange(r: DateRange) {
    onChange(r);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs sm:text-sm transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          {value.type === "comparison" ? (
            <GitCompareArrows size={14} className="text-purple-400 flex-shrink-0" />
          ) : (
            <Calendar size={14} className="text-blue-400 flex-shrink-0" />
          )}
          <span className="truncate font-medium">{value.label}</span>
        </div>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 bg-gray-900 shadow-2xl z-50 max-h-[80vh] overflow-hidden flex flex-col min-w-[320px] sm:min-w-[500px]">
            <div className="flex border-b border-white/10">
              <TabBtn active={tab === "presets"} onClick={() => setTab("presets")} icon={<Calendar size={12} />} label="Presets" />
              <TabBtn active={tab === "comparison"} onClick={() => setTab("comparison")} icon={<GitCompareArrows size={12} />} label="Compare" />
              <TabBtn active={tab === "custom"} onClick={() => setTab("custom")} icon={<Calendar size={12} />} label="Custom" />
              <button onClick={() => setOpen(false)} className="ml-auto px-3 text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            </div>

            <div className="overflow-y-auto p-3 flex-1">
              {tab === "presets" && (
                <div className="space-y-1">
                  {presets.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => selectRange(r)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${
                        value.label === r.label
                          ? "bg-blue-600 text-white"
                          : "text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium">{r.label}</span>
                        <span className="text-[10px] text-gray-500">
                          {r.startDate} → {r.endDate} ({r.days}d)
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {tab === "comparison" && (
                <div className="space-y-1">
                  <p className="text-xs text-purple-400 mb-2 px-2">Compare two time periods side-by-side</p>
                  {comparisons.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => selectRange(r)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-all ${
                        value.label === r.label
                          ? "bg-purple-600 text-white"
                          : "text-gray-300 hover:bg-white/10 border border-purple-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <GitCompareArrows size={12} className="text-purple-400" />
                        <span className="font-medium">{r.label}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 pl-5">
                        <div>Current: {r.startDate} → {r.endDate}</div>
                        {r.comparison && <div>vs Previous: {r.comparison.startDate} → {r.comparison.endDate}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {tab === "custom" && (
                <div className="space-y-3 p-2">
                  <p className="text-xs text-gray-400">Pick any custom date range</p>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      max={customEnd || undefined}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">End Date</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      min={customStart || undefined}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <button
                    onClick={applyCustom}
                    disabled={!customStart || !customEnd}
                    className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
                  >
                    Apply Custom Range
                  </button>
                  <div className="text-[10px] text-gray-600 space-y-1 pt-2 border-t border-white/5">
                    <p>Quick custom presets:</p>
                    <div className="flex flex-wrap gap-1">
                      <QuickBtn label="Last 14 days" onClick={() => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 14); setCustomStart(s.toISOString().split("T")[0]); setCustomEnd(e.toISOString().split("T")[0]); }} />
                      <QuickBtn label="Last 60 days" onClick={() => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 60); setCustomStart(s.toISOString().split("T")[0]); setCustomEnd(e.toISOString().split("T")[0]); }} />
                      <QuickBtn label="Last 2 years" onClick={() => { const e = new Date(); const s = new Date(); s.setFullYear(s.getFullYear() - 2); setCustomStart(s.toISOString().split("T")[0]); setCustomEnd(e.toISOString().split("T")[0]); }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-medium transition-all border-b-2 ${
        active
          ? "border-blue-500 text-white bg-white/5"
          : "border-transparent text-gray-400 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function QuickBtn({ label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 rounded text-[10px] bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10"
    >
      {label}
    </button>
  );
}
