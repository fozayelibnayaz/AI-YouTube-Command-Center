"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface Props {
  title: string;
  current: number;
  previous: number;
  format?: "number" | "percent" | "currency";
  icon: React.ReactNode;
  color?: string;
}

export function ComparisonCard({ title, current, previous, format = "number", icon, color = "blue" }: Props) {
  const colors: Record<string, string> = {
    blue: "from-blue-600/20 to-blue-800/10 border-blue-500/20 text-blue-400",
    green: "from-green-600/20 to-green-800/10 border-green-500/20 text-green-400",
    red: "from-red-600/20 to-red-800/10 border-red-500/20 text-red-400",
    purple: "from-purple-600/20 to-purple-800/10 border-purple-500/20 text-purple-400",
    yellow: "from-yellow-600/20 to-yellow-800/10 border-yellow-500/20 text-yellow-400",
    cyan: "from-cyan-600/20 to-cyan-800/10 border-cyan-500/20 text-cyan-400",
  };

  function fmt(n: number) {
    if (format === "percent") return n.toFixed(2) + "%";
    if (format === "currency") return "$" + n.toFixed(2);
    return formatNumber(n);
  }

  const diff = current - previous;
  const pct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  const isUp = diff > 0;
  const isDown = diff < 0;
  const isFlat = diff === 0;

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 sm:p-4 ${colors[color] || colors.blue}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs sm:text-sm text-gray-400 font-medium">{title}</p>
        <div className="p-1.5 rounded-lg bg-black/30 flex-shrink-0">{icon}</div>
      </div>
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">{fmt(current)}</p>
      <p className="text-[10px] sm:text-xs text-gray-500 mb-2">Previous: {fmt(previous)}</p>
      <div className={`flex items-center gap-1 text-xs font-medium ${
        isUp ? "text-green-400" : isDown ? "text-red-400" : "text-gray-400"
      }`}>
        {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : <Minus size={12} />}
        <span>
          {isUp ? "+" : ""}{pct.toFixed(1)}%
        </span>
        <span className="text-gray-500 text-[10px]">
          ({isUp ? "+" : ""}{fmt(Math.abs(diff))})
        </span>
      </div>
    </div>
  );
}
