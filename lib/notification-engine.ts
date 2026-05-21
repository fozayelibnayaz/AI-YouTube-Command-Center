// Smart Notification Engine - works on Vercel (no filesystem)
// Uses Supabase if available, falls back to in-memory cache

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function hasSupabase(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_KEY && !SUPABASE_URL.includes("your_");
}

function sb() {
  if (!hasSupabase()) return null;
  return createClient(SUPABASE_URL!, SUPABASE_KEY!);
}

// In-memory fallback (lost on cold start, but works for testing)
let memorySnapshot: Record<string, VideoSnapshot> = {};

export interface VideoSnapshot {
  youtube_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  ctr: number;
  avg_view_percentage: number;
  published_at: string;
  captured_at: string;
}

export interface NotificationEvent {
  type: string;
  videoId: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "critical";
  data: Record<string, string | number>;
  emoji: string;
}

export async function loadSnapshot(): Promise<Record<string, VideoSnapshot>> {
  const client = sb();
  if (client) {
    try {
      const { data, error } = await client.from("snapshots").select("*").eq("id", "latest").single();
      if (!error && data?.snapshot) return data.snapshot;
    } catch (e) {
      console.error("loadSnapshot supabase error:", e);
    }
  }
  return memorySnapshot;
}

export async function saveSnapshot(videos: any[]): Promise<void> {
  const snapshot: Record<string, VideoSnapshot> = {};
  const now = new Date().toISOString();
  for (const v of videos) {
    snapshot[v.youtube_id] = {
      youtube_id: v.youtube_id,
      title: v.title,
      views: v.views || 0,
      likes: v.likes || 0,
      comments: v.comments || 0,
      ctr: v.ctr || 0,
      avg_view_percentage: v.avg_view_percentage || 0,
      published_at: v.published_at,
      captured_at: now,
    };
  }
  memorySnapshot = snapshot;

  const client = sb();
  if (client) {
    try {
      await client.from("snapshots").upsert({ id: "latest", snapshot, updated_at: now });
    } catch (e) {
      console.error("saveSnapshot supabase error:", e);
    }
  }
}

function pctChange(now: number, prev: number): number {
  if (prev === 0) return now > 0 ? 100 : 0;
  return ((now - prev) / prev) * 100;
}

function isNewVideo(publishedAt: string): boolean {
  const hours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
  return hours <= 48;
}

function hitMilestone(value: number): number | null {
  const milestones = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
  for (const m of milestones) {
    if (value >= m && value < m * 1.05) return m;
  }
  return null;
}

export function detectEvents(
  currentVideos: any[],
  previousSnapshot: Record<string, VideoSnapshot>,
  channel?: { subscribers: number; totalViews: number }
): NotificationEvent[] {
  const events: NotificationEvent[] = [];

  for (const v of currentVideos) {
    const prev = previousSnapshot[v.youtube_id];
    const title = v.title || "Untitled";
    const videoId = v.youtube_id;

    if (!prev && isNewVideo(v.published_at)) {
      events.push({
        type: "new_video", videoId, title,
        message: "New video just uploaded! Time to promote.",
        severity: "info", emoji: "🆕",
        data: { Title: title.substring(0, 45), "Initial Views": v.views || 0, "Posted At": new Date(v.published_at).toLocaleString() },
      });
      continue;
    }
    if (!prev) continue;

    const viewsChange = pctChange(v.views || 0, prev.views);
    const likesChange = pctChange(v.likes || 0, prev.likes);
    const commentsChange = pctChange(v.comments || 0, prev.comments);
    const viewsDelta = (v.views || 0) - prev.views;

    if (viewsChange > 50 && viewsDelta > 100) {
      events.push({ type: "viral", videoId, title, message: "🔥 VIRAL! This video is exploding right now!", severity: "success", emoji: "🔥", data: { Video: title.substring(0, 45), "Views Now": (v.views || 0).toLocaleString(), "Views Added": "+" + viewsDelta.toLocaleString(), Growth: "+" + viewsChange.toFixed(1) + "%", Action: "Boost everywhere NOW" } });
    } else if (viewsChange >= 10 && viewsDelta > 20) {
      events.push({ type: "rising", videoId, title, message: "📈 Video is gaining momentum - keep promoting!", severity: "success", emoji: "📈", data: { Video: title.substring(0, 45), "Views Added": "+" + viewsDelta.toLocaleString(), Growth: "+" + viewsChange.toFixed(1) + "%" } });
    } else if (viewsChange > 0 && viewsChange < 2 && prev.views > 100) {
      events.push({ type: "slowing", videoId, title, message: "📉 Growth is slowing down - needs a push.", severity: "warning", emoji: "📉", data: { Video: title.substring(0, 45), Growth: "+" + viewsChange.toFixed(2) + "%", Suggestion: "Share on socials / make a Short" } });
    } else if (viewsDelta === 0 && prev.views > 50) {
      events.push({ type: "stagnant", videoId, title, message: "⏸️ Zero new views - algorithm killed it.", severity: "warning", emoji: "⏸️", data: { Video: title.substring(0, 45), "Current Views": (v.views || 0).toLocaleString(), Suggestion: "Update thumbnail or title to revive" } });
    } else if (viewsDelta < 0) {
      events.push({ type: "declining", videoId, title, message: "⚠️ Views dropped (possibly removed views).", severity: "critical", emoji: "⚠️", data: { Video: title.substring(0, 45), "Views Lost": viewsDelta.toLocaleString(), "Now At": (v.views || 0).toLocaleString() } });
    }

    if (commentsChange > 100 && (v.comments || 0) - prev.comments >= 5) {
      events.push({ type: "comments_spike", videoId, title, message: "💬 Comment activity exploded - join the conversation!", severity: "info", emoji: "💬", data: { Video: title.substring(0, 45), "New Comments": "+" + ((v.comments || 0) - prev.comments), Growth: "+" + commentsChange.toFixed(0) + "%" } });
    }
    if (likesChange > 50 && (v.likes || 0) - prev.likes >= 10) {
      events.push({ type: "likes_spike", videoId, title, message: "👍 Likes are pouring in - audience loves this!", severity: "success", emoji: "👍", data: { Video: title.substring(0, 45), "New Likes": "+" + ((v.likes || 0) - prev.likes), Growth: "+" + likesChange.toFixed(0) + "%" } });
    }

    const milestone = hitMilestone(v.views || 0);
    if (milestone && prev.views < milestone) {
      events.push({ type: "milestone_views", videoId, title, message: "🏆 MILESTONE! Video crossed " + milestone.toLocaleString() + " views!", severity: "success", emoji: "🏆", data: { Video: title.substring(0, 45), Milestone: milestone.toLocaleString() + " views" } });
    }
  }

  for (const v of currentVideos) {
    if ((v.views || 0) < 50) continue;
    const ctr = v.ctr || 0;
    const retention = v.avg_view_percentage || 0;
    const likeRate = ((v.likes || 0) / Math.max(v.views || 1, 1)) * 100;

    if (ctr < 2) {
      events.push({ type: "low_ctr", videoId: v.youtube_id, title: v.title, message: "Thumbnail is failing - viewers are not clicking.", severity: "critical", emoji: "❌", data: { Video: v.title.substring(0, 45), "Current CTR": ctr.toFixed(2) + "%", Target: "above 4%", Action: "Redesign thumbnail urgently" } });
    } else if (ctr >= 8) {
      events.push({ type: "high_ctr", videoId: v.youtube_id, title: v.title, message: "�� Thumbnail is crushing it - replicate this style!", severity: "success", emoji: "🎯", data: { Video: v.title.substring(0, 45), CTR: ctr.toFixed(2) + "%", Action: "Use this thumbnail style on future videos" } });
    }
    if (retention < 25 && (v.views || 0) >= 100) {
      events.push({ type: "low_retention", videoId: v.youtube_id, title: v.title, message: "Viewers leaving early - hook is broken.", severity: "critical", emoji: "⏱️", data: { Video: v.title.substring(0, 45), Retention: retention.toFixed(1) + "%", "Skipped Away": (100 - retention).toFixed(1) + "%", Action: "Re-edit first 30 seconds" } });
    } else if (retention >= 50) {
      events.push({ type: "high_retention", videoId: v.youtube_id, title: v.title, message: "🎬 People are watching to the end - amazing content!", severity: "success", emoji: "🎬", data: { Video: v.title.substring(0, 45), Retention: retention.toFixed(1) + "%", Action: "Make a Part 2 in same style" } });
    }
    if (likeRate < 1 && (v.views || 0) >= 500) {
      events.push({ type: "low_engagement", videoId: v.youtube_id, title: v.title, message: "Low like ratio - content not resonating.", severity: "warning", emoji: "👎", data: { Video: v.title.substring(0, 45), "Like Rate": likeRate.toFixed(2) + "%", Action: "Ask for likes in next intro" } });
    } else if (likeRate >= 5) {
      events.push({ type: "high_engagement", videoId: v.youtube_id, title: v.title, message: "❤️ Audience is in love - very high engagement!", severity: "success", emoji: "❤️", data: { Video: v.title.substring(0, 45), "Like Rate": likeRate.toFixed(2) + "%" } });
    }
  }

  if (currentVideos.length > 1) {
    const sorted = [...currentVideos].sort((a, b) => (b.views || 0) - (a.views || 0));
    const top = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (top && top.views >= 100) {
      events.push({ type: "top_performer", videoId: top.youtube_id, title: top.title, message: "🥇 Top performing video right now.", severity: "success", emoji: "🥇", data: { Video: top.title.substring(0, 45), Views: (top.views || 0).toLocaleString(), CTR: (top.ctr || 0).toFixed(2) + "%" } });
    }
    if (worst && worst.views < 50 && currentVideos.length > 5) {
      events.push({ type: "underperformer", videoId: worst.youtube_id, title: worst.title, message: "🪦 Lowest performer - consider removing.", severity: "warning", emoji: "🪦", data: { Video: worst.title.substring(0, 45), Views: (worst.views || 0).toLocaleString() } });
    }
  }

  if (channel) {
    const subMilestone = hitMilestone(channel.subscribers);
    if (subMilestone) {
      events.push({ type: "milestone_subs", videoId: "channel", title: "Channel Milestone", message: "🎉 Channel reached " + subMilestone.toLocaleString() + " subscribers!", severity: "success", emoji: "🎉", data: { Milestone: subMilestone.toLocaleString() + " subscribers", "Current Total": channel.subscribers.toLocaleString() } });
    }
  }

  if (events.length === 0 && Object.keys(previousSnapshot).length > 0) {
    events.push({ type: "no_change", videoId: "system", title: "Daily Status", message: "📊 No significant changes since last check. Channel is stable.", severity: "info", emoji: "📊", data: { "Videos Tracked": currentVideos.length, Status: "Stable - no major events" } });
  }

  return events;
}
