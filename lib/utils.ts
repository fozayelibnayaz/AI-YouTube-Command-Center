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
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return m + ":" + String(s).padStart(2, "0");
}

// Engagement rate ratings (based on REAL likes+comments/views)
export function getEngagementRating(rate: number) {
  if (rate >= 8) return { label: "Excellent", color: "text-green-400", description: "Top 5% of creators" };
  if (rate >= 5) return { label: "Very Good", color: "text-blue-400", description: "Strong engagement" };
  if (rate >= 3) return { label: "Good", color: "text-cyan-400", description: "Above average" };
  if (rate >= 1.5) return { label: "Average", color: "text-yellow-400", description: "Industry average" };
  if (rate >= 0.5) return { label: "Below Avg", color: "text-orange-400", description: "Needs improvement" };
  return { label: "Low", color: "text-red-400", description: "Audience not engaging" };
}

// Views-per-day rating (based on REAL views and age)
export function getViewsPerDayRating(viewsPerDay: number) {
  if (viewsPerDay >= 1000) return { label: "Viral", color: "text-green-400" };
  if (viewsPerDay >= 100) return { label: "Strong", color: "text-blue-400" };
  if (viewsPerDay >= 20) return { label: "Steady", color: "text-cyan-400" };
  if (viewsPerDay >= 5) return { label: "Slow", color: "text-yellow-400" };
  if (viewsPerDay >= 1) return { label: "Stagnant", color: "text-orange-400" };
  return { label: "Dead", color: "text-red-400" };
}

// Calculate score based on REAL metrics only
// - Views per day (lifetime velocity): 40 points
// - Engagement rate (likes+comments/views): 40 points
// - Total views relative to channel size: 20 points
export function calculatePerformanceScore(a: {
  views: number;
  likes: number;
  comments: number;
  publishedAt?: string;
  channelSubscribers?: number;
}): number {
  const views = a.views || 0;
  const likes = a.likes || 0;
  const comments = a.comments || 0;
  const subs = a.channelSubscribers || 1000;

  // Days since publish
  let daysSince = 1;
  if (a.publishedAt) {
    daysSince = Math.max(1, (Date.now() - new Date(a.publishedAt).getTime()) / 86400000);
  }

  const viewsPerDay = views / daysSince;
  const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const viewsVsSubs = (views / Math.max(subs, 1)) * 100;

  // Views per day score (logarithmic - rewards velocity)
  let vpdScore = 0;
  if (viewsPerDay >= 1000) vpdScore = 40;
  else if (viewsPerDay >= 100) vpdScore = 30 + ((viewsPerDay - 100) / 900) * 10;
  else if (viewsPerDay >= 20) vpdScore = 20 + ((viewsPerDay - 20) / 80) * 10;
  else if (viewsPerDay >= 5) vpdScore = 10 + ((viewsPerDay - 5) / 15) * 10;
  else if (viewsPerDay >= 1) vpdScore = 5 + ((viewsPerDay - 1) / 4) * 5;
  else vpdScore = viewsPerDay * 5;

  // Engagement score
  let engScore = 0;
  if (engagementRate >= 8) engScore = 40;
  else if (engagementRate >= 5) engScore = 30 + ((engagementRate - 5) / 3) * 10;
  else if (engagementRate >= 3) engScore = 20 + ((engagementRate - 3) / 2) * 10;
  else if (engagementRate >= 1.5) engScore = 10 + ((engagementRate - 1.5) / 1.5) * 10;
  else if (engagementRate >= 0.5) engScore = 5 + ((engagementRate - 0.5) / 1) * 5;
  else engScore = engagementRate * 10;

  // Views vs subscribers (how well it reaches/exceeds subscriber base)
  let reachScore = 0;
  if (viewsVsSubs >= 100) reachScore = 20;
  else if (viewsVsSubs >= 50) reachScore = 15 + ((viewsVsSubs - 50) / 50) * 5;
  else if (viewsVsSubs >= 20) reachScore = 10 + ((viewsVsSubs - 20) / 30) * 5;
  else if (viewsVsSubs >= 10) reachScore = 5 + ((viewsVsSubs - 10) / 10) * 5;
  else reachScore = (viewsVsSubs / 10) * 5;

  return Math.round(vpdScore + engScore + reachScore);
}

// Diagnose video using REAL metrics
export function diagnoseVideo(a: {
  views: number;
  likes: number;
  comments: number;
  publishedAt?: string;
  channelSubscribers?: number;
}): Array<{ issue: string; severity: "critical"|"warning"|"minor"; fix: string }> {
  const issues = [];
  const views = a.views || 0;
  const likes = a.likes || 0;
  const comments = a.comments || 0;
  const subs = a.channelSubscribers || 1000;

  let daysSince = 1;
  if (a.publishedAt) {
    daysSince = Math.max(1, (Date.now() - new Date(a.publishedAt).getTime()) / 86400000);
  }
  const viewsPerDay = views / daysSince;
  const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const viewsVsSubs = (views / Math.max(subs, 1)) * 100;

  if (daysSince > 30 && viewsPerDay < 1) {
    issues.push({
      issue: "Video gets less than 1 view per day after " + Math.floor(daysSince) + " days",
      severity: "critical" as const,
      fix: "Video is dead. Either: (1) Update thumbnail to revive, (2) Make a follow-up, or (3) Unlist it.",
    });
  } else if (daysSince > 14 && viewsPerDay < 5) {
    issues.push({
      issue: "Low velocity: only " + viewsPerDay.toFixed(1) + " views/day",
      severity: "warning" as const,
      fix: "Algorithm stopped pushing this video. Try updating thumbnail or sharing on social media.",
    });
  }

  if (engagementRate < 1 && views >= 100) {
    issues.push({
      issue: "Low engagement rate: " + engagementRate.toFixed(2) + "% (target: >2%)",
      severity: "warning" as const,
      fix: "Audience watches but doesn't engage. Add stronger CTAs - ask viewers to like and comment in first 30 seconds.",
    });
  } else if (engagementRate < 0.3 && views >= 500) {
    issues.push({
      issue: "Critically low engagement: " + engagementRate.toFixed(2) + "%",
      severity: "critical" as const,
      fix: "Content isn't resonating. Consider that viewers may be skipping past it without engaging.",
    });
  }

  if (viewsVsSubs < 5 && subs > 100 && daysSince > 7) {
    issues.push({
      issue: "Only " + viewsVsSubs.toFixed(1) + "% of subscribers watched (target: >20%)",
      severity: "warning" as const,
      fix: "Your own subscribers aren't watching. Thumbnail/title may not appeal to your existing audience.",
    });
  }

  return issues;
}

// Legacy compatibility (returns honest "N/A" labels)
export function getCTRRating(ctr: number | null) {
  if (ctr === null || ctr === undefined) {
    return { label: "N/A", color: "text-gray-500", description: "Requires YouTube Analytics API (OAuth)" };
  }
  if (ctr >= 10) return { label: "Excellent", color: "text-green-400", description: "Top 5% of channels" };
  if (ctr >= 7) return { label: "Good", color: "text-blue-400", description: "Above average" };
  if (ctr >= 4) return { label: "Average", color: "text-yellow-400", description: "YouTube average" };
  if (ctr >= 2) return { label: "Below Avg", color: "text-orange-400", description: "Needs improvement" };
  return { label: "Poor", color: "text-red-400", description: "Critical - fix thumbnail" };
}

export function getRetentionRating(pct: number | null) {
  if (pct === null || pct === undefined) {
    return { label: "N/A", color: "text-gray-500", description: "Requires YouTube Analytics API (OAuth)" };
  }
  if (pct >= 50) return { label: "Excellent", color: "text-green-400", description: "Top creator level" };
  if (pct >= 40) return { label: "Good", color: "text-blue-400", description: "Above average" };
  if (pct >= 30) return { label: "Average", color: "text-yellow-400", description: "YouTube average" };
  if (pct >= 20) return { label: "Below Avg", color: "text-orange-400", description: "Hook needs work" };
  return { label: "Poor", color: "text-red-400", description: "Critical retention issues" };
}
