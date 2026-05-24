// Comprehensive date range utilities

export interface DateRange {
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  days: number;
  type: "preset" | "custom" | "comparison";
  comparison?: DateRange; // Previous period for comparison
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.ceil(ms / 86400000) + 1;
}

const now = () => new Date();
const today = () => fmt(now());

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function subYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

// ─── PRESET RANGES ───────────────────────────────────────────────
export function getPresetRanges(): DateRange[] {
  const n = now();
  const t = today();

  return [
    {
      label: "Today",
      startDate: t,
      endDate: t,
      days: 1,
      type: "preset",
    },
    {
      label: "Yesterday",
      startDate: fmt(subDays(n, 1)),
      endDate: fmt(subDays(n, 1)),
      days: 1,
      type: "preset",
    },
    {
      label: "Last 7 Days",
      startDate: fmt(subDays(n, 7)),
      endDate: t,
      days: 7,
      type: "preset",
    },
    {
      label: "Last 28 Days",
      startDate: fmt(subDays(n, 28)),
      endDate: t,
      days: 28,
      type: "preset",
    },
    {
      label: "Last 30 Days",
      startDate: fmt(subDays(n, 30)),
      endDate: t,
      days: 30,
      type: "preset",
    },
    {
      label: "This Month",
      startDate: fmt(startOfMonth(n)),
      endDate: t,
      days: n.getDate(),
      type: "preset",
    },
    {
      label: "Last Month",
      startDate: fmt(startOfMonth(subMonths(n, 1))),
      endDate: fmt(endOfMonth(subMonths(n, 1))),
      days: endOfMonth(subMonths(n, 1)).getDate(),
      type: "preset",
    },
    {
      label: "Last 3 Months",
      startDate: fmt(subDays(n, 90)),
      endDate: t,
      days: 90,
      type: "preset",
    },
    {
      label: "Last 6 Months",
      startDate: fmt(subDays(n, 180)),
      endDate: t,
      days: 180,
      type: "preset",
    },
    {
      label: "This Year",
      startDate: fmt(startOfYear(n)),
      endDate: t,
      days: Math.ceil((n.getTime() - startOfYear(n).getTime()) / 86400000) + 1,
      type: "preset",
    },
    {
      label: "Last Year",
      startDate: fmt(startOfYear(subYears(n, 1))),
      endDate: fmt(endOfYear(subYears(n, 1))),
      days: 365,
      type: "preset",
    },
    {
      label: "Last 12 Months",
      startDate: fmt(subDays(n, 365)),
      endDate: t,
      days: 365,
      type: "preset",
    },
    {
      label: "All Time",
      startDate: "2005-01-01",
      endDate: t,
      days: 7300,
      type: "preset",
    },
  ];
}

// ─── COMPARISON RANGES ───────────────────────────────────────────
export function getComparisonRanges(): DateRange[] {
  const n = now();
  const t = today();

  return [
    {
      label: "This Month vs Last Month",
      startDate: fmt(startOfMonth(n)),
      endDate: t,
      days: n.getDate(),
      type: "comparison",
      comparison: {
        label: "Last Month (same days)",
        startDate: fmt(startOfMonth(subMonths(n, 1))),
        endDate: fmt(new Date(subMonths(n, 1).getFullYear(), subMonths(n, 1).getMonth(), n.getDate())),
        days: n.getDate(),
        type: "preset",
      },
    },
    {
      label: "Last 7 Days vs Previous 7 Days",
      startDate: fmt(subDays(n, 7)),
      endDate: t,
      days: 7,
      type: "comparison",
      comparison: {
        label: "Previous 7 Days",
        startDate: fmt(subDays(n, 14)),
        endDate: fmt(subDays(n, 7)),
        days: 7,
        type: "preset",
      },
    },
    {
      label: "Last 28 Days vs Previous 28 Days",
      startDate: fmt(subDays(n, 28)),
      endDate: t,
      days: 28,
      type: "comparison",
      comparison: {
        label: "Previous 28 Days",
        startDate: fmt(subDays(n, 56)),
        endDate: fmt(subDays(n, 28)),
        days: 28,
        type: "preset",
      },
    },
    {
      label: "Last 30 Days vs Previous 30 Days",
      startDate: fmt(subDays(n, 30)),
      endDate: t,
      days: 30,
      type: "comparison",
      comparison: {
        label: "Previous 30 Days",
        startDate: fmt(subDays(n, 60)),
        endDate: fmt(subDays(n, 30)),
        days: 30,
        type: "preset",
      },
    },
    {
      label: "Last 3 Months vs Previous 3 Months",
      startDate: fmt(subDays(n, 90)),
      endDate: t,
      days: 90,
      type: "comparison",
      comparison: {
        label: "Previous 3 Months",
        startDate: fmt(subDays(n, 180)),
        endDate: fmt(subDays(n, 90)),
        days: 90,
        type: "preset",
      },
    },
    {
      label: "Last 3 Months YoY (vs Last Year)",
      startDate: fmt(subDays(n, 90)),
      endDate: t,
      days: 90,
      type: "comparison",
      comparison: {
        label: "Same Period Last Year",
        startDate: fmt(subDays(subYears(n, 1), 90)),
        endDate: fmt(subYears(n, 1)),
        days: 90,
        type: "preset",
      },
    },
    {
      label: "Last 6 Months vs Previous 6 Months",
      startDate: fmt(subDays(n, 180)),
      endDate: t,
      days: 180,
      type: "comparison",
      comparison: {
        label: "Previous 6 Months",
        startDate: fmt(subDays(n, 360)),
        endDate: fmt(subDays(n, 180)),
        days: 180,
        type: "preset",
      },
    },
    {
      label: "This Year vs Last Year",
      startDate: fmt(startOfYear(n)),
      endDate: t,
      days: Math.ceil((n.getTime() - startOfYear(n).getTime()) / 86400000) + 1,
      type: "comparison",
      comparison: {
        label: "Last Year (same period)",
        startDate: fmt(startOfYear(subYears(n, 1))),
        endDate: fmt(new Date(subYears(n, 1).getFullYear(), n.getMonth(), n.getDate())),
        days: Math.ceil((n.getTime() - startOfYear(n).getTime()) / 86400000) + 1,
        type: "preset",
      },
    },
    {
      label: "This Month YoY (vs Same Month Last Year)",
      startDate: fmt(startOfMonth(n)),
      endDate: t,
      days: n.getDate(),
      type: "comparison",
      comparison: {
        label: "Same Month Last Year",
        startDate: fmt(startOfMonth(subYears(n, 1))),
        endDate: fmt(new Date(subYears(n, 1).getFullYear(), n.getMonth(), n.getDate())),
        days: n.getDate(),
        type: "preset",
      },
    },
  ];
}

// ─── CUSTOM RANGE ────────────────────────────────────────────────
export function makeCustomRange(startDate: string, endDate: string): DateRange {
  return {
    label: "Custom: " + startDate + " to " + endDate,
    startDate,
    endDate,
    days: daysBetween(startDate, endDate),
    type: "custom",
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────
export function rangeToDaysBack(range: DateRange): number {
  // For backward compat: return days back from today
  const end = new Date(range.endDate);
  const today = new Date();
  if (fmt(end) === fmt(today)) return range.days;
  // For historical ranges (ending before today), calculate days back from today to start
  return Math.ceil((today.getTime() - new Date(range.startDate).getTime()) / 86400000);
}

export function formatRangeLabel(range: DateRange): string {
  if (range.type === "custom") return range.label;
  return range.label + " (" + range.startDate + " → " + range.endDate + ")";
}

export function getPercentChange(current: number, previous: number): { value: number; positive: boolean } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, positive: current >= 0 };
  const change = ((current - previous) / previous) * 100;
  return { value: Math.abs(change), positive: change >= 0 };
}
