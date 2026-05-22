"use client";
import { cn, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ReactNode;
  color?: string;
  subtitle?: string;
  format?: "number" | "percent" | "currency" | "raw";
}

export function StatCard({ title, value, change, icon, color = "blue", subtitle, format = "number" }: StatCardProps) {
  const colors: Record<string, string> = {
    blue: "from-blue-600/20 to-blue-800/10 border-blue-500/20 text-blue-400",
    red: "from-red-600/20 to-red-800/10 border-red-500/20 text-red-400",
    green: "from-green-600/20 to-green-800/10 border-green-500/20 text-green-400",
    yellow: "from-yellow-600/20 to-yellow-800/10 border-yellow-500/20 text-yellow-400",
    purple: "from-purple-600/20 to-purple-800/10 border-purple-500/20 text-purple-400",
  };

  const display = typeof value === "number"
    ? format === "number" ? formatNumber(value)
    : format === "percent" ? value + "%"
    : format === "currency" ? "$" + value.toFixed(2)
    : String(value)
    : String(value);

  const c = colors[color] || colors.blue;

  return (
    <div className={cn("rounded-xl border bg-gradient-to-br p-3 sm:p-4 lg:p-5 transition-all hover:scale-[1.02]", c)}>
      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
        <p className="text-xs sm:text-sm text-gray-400 font-medium leading-tight">{title}</p>
        <div className="p-1.5 sm:p-2 rounded-lg bg-black/30 flex-shrink-0">{icon}</div>
      </div>
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 truncate">{display}</p>
      {subtitle && <p className="text-[10px] sm:text-xs text-gray-500 mb-1 sm:mb-2 truncate">{subtitle}</p>}
      {change !== undefined && (
        <div className={cn("flex items-center gap-1 text-[10px] sm:text-xs font-medium",
          change > 0 ? "text-green-400" : change < 0 ? "text-red-400" : "text-gray-400"
        )}>
          {change > 0 ? <TrendingUp size={10} /> : change < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
          <span className="truncate">{change > 0 ? "+" : ""}{change}% vs last month</span>
        </div>
      )}
    </div>
  );
}
