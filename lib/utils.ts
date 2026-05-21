import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return m + ":" + String(s).padStart(2, "0");
}

export function getCTRRating(ctr: number) {
  if (ctr >= 10) return { label: "Excellent", color: "text-green-400", description: "Top 5% of channels" };
  if (ctr >= 7) return { label: "Good", color: "text-blue-400", description: "Above average" };
  if (ctr >= 4) return { label: "Average", color: "text-yellow-400", description: "YouTube average" };
  if (ctr >= 2) return { label: "Below Avg", color: "text-orange-400", description: "Needs improvement" };
  return { label: "Poor", color: "text-red-400", description: "Critical - fix thumbnail" };
}

export function getRetentionRating(pct: number) {
  if (pct >= 50) return { label: "Excellent", color: "text-green-400", description: "Top creator level" };
  if (pct >= 40) return { label: "Good", color: "text-blue-400", description: "Above average" };
  if (pct >= 30) return { label: "Average", color: "text-yellow-400", description: "YouTube average" };
  if (pct >= 20) return { label: "Below Avg", color: "text-orange-400", description: "Hook needs work" };
  return { label: "Poor", color: "text-red-400", description: "Critical retention issues" };
}

export function calculatePerformanceScore(a: {
  ctr: number; avg_view_percentage: number; likes: number; views: number; comments: number;
}): number {
  const ctrScore = Math.min((a.ctr / 10) * 40, 40);
  const retentionScore = Math.min((a.avg_view_percentage / 50) * 35, 35);
  const engagementRate = ((a.likes + a.comments) / Math.max(a.views, 1)) * 100;
  const engagementScore = Math.min((engagementRate / 5) * 25, 25);
  return Math.round(ctrScore + retentionScore + engagementScore);
}

export function diagnoseVideo(a: {
  ctr: number; avg_view_percentage: number; views: number; impressions: number;
}): Array<{ issue: string; severity: "critical"|"warning"|"minor"; fix: string }> {
  const issues = [];
  if (a.ctr < 2) {
    issues.push({
      issue: "CTR critically low under 2 percent",
      severity: "critical" as const,
      fix: "Thumbnail needs complete redesign. Brighter colors, clearer face, larger text.",
    });
  } else if (a.ctr < 4) {
    issues.push({
      issue: "CTR below average 2 to 4 percent",
      severity: "warning" as const,
      fix: "Try A/B testing thumbnails with more curiosity-gap titles.",
    });
  }
  if (a.avg_view_percentage < 20) {
    issues.push({
      issue: "Retention critically low - viewers leave in first 20 percent",
      severity: "critical" as const,
      fix: "Hook is broken. First 30 seconds must hook harder.",
    });
  } else if (a.avg_view_percentage < 30) {
    issues.push({
      issue: "Retention below average",
      severity: "warning" as const,
      fix: "Pacing is slow. Cut unnecessary intro. Add pattern interrupts every 60 to 90 seconds.",
    });
  }
  if (a.impressions > 5000 && a.ctr < 3) {
    issues.push({
      issue: "High impressions but low CTR = thumbnail problem",
      severity: "critical" as const,
      fix: "People see video but do not click. Thumbnail is not compelling.",
    });
  }
  return issues;
}
