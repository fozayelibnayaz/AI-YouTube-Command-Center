// In-memory snapshot - persists within same function instance
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

function getSupabase(): any {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !key || url.includes("your_") || key.length < 20) return null;
    const { createClient } = require("@supabase/supabase-js");
    return createClient(url, key);
  } catch {
    return null;
  }
}

export async function loadSnapshot(): Promise<Record<string, VideoSnapshot>> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data } = await sb.from("snapshots").select("snapshot").eq("id", "latest").single();
      if (data?.snapshot && typeof data.snapshot === "object") return data.snapshot;
    } catch (e) {
      console.log("Supabase load failed:", String(e));
    }
  }
  return { ...memorySnapshot };
}

export async function saveSnapshot(videos: any[]): Promise<void> {
  const snapshot: Record<string, VideoSnapshot> = {};
  const now = new Date().toISOString();
  for (const v of videos) {
    snapshot[v.youtube_id] = {
      youtube_id: v.youtube_id, title: v.title || "",
      views: v.views || 0, likes: v.likes || 0, comments: v.comments || 0,
      ctr: v.ctr || 0, avg_view_percentage: v.avg_view_percentage || 0,
      published_at: v.published_at || "", captured_at: now,
    };
  }
  memorySnapshot = snapshot;

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from("snapshots").upsert({ id: "latest", snapshot, updated_at: now });
    } catch (e) {
      console.log("Supabase save failed:", String(e));
    }
  }
}

function pct(now: number, prev: number): number {
  if (prev === 0) return now > 0 ? 100 : 0;
  return ((now - prev) / prev) * 100;
}

function isNew(publishedAt: string): boolean {
  return (Date.now() - new Date(publishedAt).getTime()) / 3600000 <= 48;
}

function milestoneHit(value: number, prev: number): number | null {
  const ms = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  for (const m of ms) { if (value >= m && prev < m) return m; }
  return null;
}

export function detectEvents(
  videos: any[], prev: Record<string, VideoSnapshot>, channel?: any
): NotificationEvent[] {
  const events: NotificationEvent[] = [];
  const hasPrev = Object.keys(prev).length > 0;

  for (const v of videos) {
    const id = v.youtube_id;
    const t = (v.title || "Untitled").substring(0, 50);
    const p = prev[id];
    const views = v.views || 0;
    const likes = v.likes || 0;
    const comments = v.comments || 0;
    const ctr = v.ctr || 0;
    const ret = v.avg_view_percentage || 0;
    const engRate = ((likes + comments) / Math.max(views, 1)) * 100;

    // ── New video ──
    if (!p && isNew(v.published_at)) {
      events.push({ type: "new_video", videoId: id, title: t, emoji: "🆕",
        message: "New video uploaded! Promote immediately.", severity: "info",
        data: { Video: t, Views: views, Posted: new Date(v.published_at).toLocaleDateString() } });
    }

    // ── Growth detection (only if we have prior snapshot) ──
    if (p && hasPrev) {
      const vd = views - p.views;
      const vc = pct(views, p.views);
      const ld = likes - p.likes;
      const cd = comments - p.comments;

      if (vc > 100 && vd > 500) {
        events.push({ type: "viral_explosion", videoId: id, title: t, emoji: "🔥",
          message: "VIRAL! Views exploding - boost everywhere NOW!", severity: "critical",
          data: { Video: t, "Views Added": "+" + vd.toLocaleString(), Growth: "+" + vc.toFixed(0) + "%" } });
      } else if (vc > 50 && vd > 100) {
        events.push({ type: "viral", videoId: id, title: t, emoji: "🚀",
          message: "Going viral! Capitalize immediately.", severity: "success",
          data: { Video: t, "Views Added": "+" + vd.toLocaleString(), Growth: "+" + vc.toFixed(0) + "%" } });
      } else if (vc >= 10 && vd > 20) {
        events.push({ type: "rising", videoId: id, title: t, emoji: "📈",
          message: "Gaining momentum - keep promoting!", severity: "success",
          data: { Video: t, "Views Added": "+" + vd, Growth: "+" + vc.toFixed(1) + "%" } });
      } else if (vc > 0 && vc < 1 && p.views > 200) {
        events.push({ type: "slowing", videoId: id, title: t, emoji: "📉",
          message: "Growth stalling - needs a push.", severity: "warning",
          data: { Video: t, Growth: "+" + vc.toFixed(2) + "%", Tip: "Share on socials or make a Short" } });
      } else if (vd === 0 && p.views > 100) {
        events.push({ type: "stagnant", videoId: id, title: t, emoji: "⏸️",
          message: "Zero new views - algorithm stopped pushing.", severity: "warning",
          data: { Video: t, Views: views.toLocaleString(), Tip: "Change thumbnail or title" } });
      } else if (vd < 0) {
        events.push({ type: "views_dropped", videoId: id, title: t, emoji: "��",
          message: "Views decreased (removed views or error).", severity: "critical",
          data: { Video: t, "Views Lost": vd.toLocaleString() } });
      }

      if (cd >= 5 && pct(comments, p.comments) > 50) {
        events.push({ type: "comments_spike", videoId: id, title: t, emoji: "��",
          message: "Comments exploded - join the conversation!", severity: "info",
          data: { Video: t, "New Comments": "+" + cd } });
      }
      if (ld >= 10 && pct(likes, p.likes) > 30) {
        events.push({ type: "likes_spike", videoId: id, title: t, emoji: "👍",
          message: "Likes pouring in - audience loves this!", severity: "success",
          data: { Video: t, "New Likes": "+" + ld } });
      }

      const m = milestoneHit(views, p.views);
      if (m) {
        events.push({ type: "milestone", videoId: id, title: t, emoji: "🏆",
          message: "MILESTONE! Crossed " + m.toLocaleString() + " views!", severity: "success",
          data: { Video: t, Milestone: m.toLocaleString() + " views" } });
      }
    }

    // ── Performance health checks (always run) ──
    if (views < 30) continue;

    if (ctr < 2) {
      events.push({ type: "critical_ctr", videoId: id, title: t, emoji: "❌",
        message: "Thumbnail failing badly - redesign URGENTLY.", severity: "critical",
        data: { Video: t, CTR: ctr.toFixed(2) + "%", Target: ">4%", "Skip Rate": (100 - ctr).toFixed(1) + "% saw but didn't click" } });
    } else if (ctr < 4) {
      events.push({ type: "low_ctr", videoId: id, title: t, emoji: "⚠️",
        message: "Below average CTR - thumbnail needs improvement.", severity: "warning",
        data: { Video: t, CTR: ctr.toFixed(2) + "%", "Skipped By": (100 - ctr).toFixed(1) + "%" } });
    } else if (ctr >= 8) {
      events.push({ type: "excellent_ctr", videoId: id, title: t, emoji: "🎯",
        message: "Thumbnail crushing it! Replicate this style.", severity: "success",
        data: { Video: t, CTR: ctr.toFixed(2) + "%", "Click Rate": "Top 5% performance" } });
    }

    if (ret < 20) {
      events.push({ type: "critical_retention", videoId: id, title: t, emoji: "⏱️",
        message: "Viewers leave almost immediately. Hook is broken.", severity: "critical",
        data: { Video: t, Watched: ret.toFixed(1) + "%", "Skipped Away": (100 - ret).toFixed(1) + "%", Fix: "Re-edit first 30 seconds" } });
    } else if (ret < 30) {
      events.push({ type: "low_retention", videoId: id, title: t, emoji: "⏳",
        message: "Below average retention - pacing needs work.", severity: "warning",
        data: { Video: t, Watched: ret.toFixed(1) + "%", "Left Early": (100 - ret).toFixed(1) + "%" } });
    } else if (ret >= 50) {
      events.push({ type: "excellent_retention", videoId: id, title: t, emoji: "🎬",
        message: "Amazing retention! Audience watches to the end.", severity: "success",
        data: { Video: t, Watched: ret.toFixed(1) + "%", Action: "Make Part 2 same style" } });
    }

    if (engRate < 1 && views >= 500) {
      events.push({ type: "low_engagement", videoId: id, title: t, emoji: "👎",
        message: "Low engagement - content not resonating.", severity: "warning",
        data: { Video: t, "Engagement Rate": engRate.toFixed(2) + "%", "Likes/Views": ((likes / Math.max(views, 1)) * 100).toFixed(2) + "%" } });
    } else if (engRate >= 8) {
      events.push({ type: "high_engagement", videoId: id, title: t, emoji: "❤️",
        message: "Incredible engagement! Audience loves this.", severity: "success",
        data: { Video: t, "Engagement Rate": engRate.toFixed(2) + "%" } });
    }

    if (ctr < 3 && ret < 25 && views >= 100) {
      events.push({ type: "needs_rescue", videoId: id, title: t, emoji: "🆘",
        message: "Both CTR AND retention critical. Full rework needed.", severity: "critical",
        data: { Video: t, CTR: ctr.toFixed(2) + "%", Retention: ret.toFixed(1) + "%", Action: "New thumbnail + re-edit hook" } });
    }

    if (ctr >= 6 && ret >= 40 && engRate >= 3) {
      events.push({ type: "star_performer", videoId: id, title: t, emoji: "⭐",
        message: "Star video! Everything working perfectly.", severity: "success",
        data: { Video: t, CTR: ctr.toFixed(2) + "%", Retention: ret.toFixed(1) + "%", Engagement: engRate.toFixed(2) + "%" } });
    }

    // Upload age analysis
    const daysSince = (Date.now() - new Date(v.published_at).getTime()) / 86400000;
    const viewsPerDay = views / Math.max(daysSince, 1);
    if (daysSince > 30 && viewsPerDay < 1 && views < 200) {
      events.push({ type: "dead_video", videoId: id, title: t, emoji: "🪦",
        message: "Video is dead - less than 1 view/day. Consider deleting or re-uploading.", severity: "warning",
        data: { Video: t, "Views/Day": viewsPerDay.toFixed(2), Age: Math.floor(daysSince) + " days", Total: views } });
    }
    if (daysSince <= 7 && viewsPerDay >= 50) {
      events.push({ type: "strong_launch", videoId: id, title: t, emoji: "🎉",
        message: "Strong launch! New video performing well.", severity: "success",
        data: { Video: t, "Views/Day": Math.round(viewsPerDay).toLocaleString(), Age: Math.floor(daysSince) + " days" } });
    }
  }

  // ── Channel-level events ──
  if (videos.length > 2) {
    const sorted = [...videos].sort((a, b) => (b.score || 0) - (a.score || 0));
    events.push({ type: "top_performer", videoId: sorted[0].youtube_id, title: sorted[0].title?.substring(0, 50),
      message: "Best video overall by AI score.", severity: "success", emoji: "🥇",
      data: { Video: sorted[0].title?.substring(0, 45), Score: (sorted[0].score || 0) + "/100", Views: (sorted[0].views || 0).toLocaleString() } });
    events.push({ type: "worst_performer", videoId: sorted[sorted.length - 1].youtube_id, title: sorted[sorted.length - 1].title?.substring(0, 50),
      message: "Lowest scoring video - needs attention.", severity: "warning", emoji: "🔴",
      data: { Video: sorted[sorted.length - 1].title?.substring(0, 45), Score: (sorted[sorted.length - 1].score || 0) + "/100" } });

    const avgScore = sorted.reduce((s, v) => s + (v.score || 0), 0) / sorted.length;
    const avgCTR = videos.reduce((s, v) => s + (v.ctr || 0), 0) / videos.length;
    const avgRet = videos.reduce((s, v) => s + (v.avg_view_percentage || 0), 0) / videos.length;
    const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
    const totalEng = videos.reduce((s, v) => s + (v.likes || 0) + (v.comments || 0), 0);

    events.push({ type: "daily_summary", videoId: "channel", title: "Channel Daily Summary",
      message: "End-of-day channel performance report.", severity: "info", emoji: "📊",
      data: {
        "Total Videos": videos.length, "Total Views": totalViews.toLocaleString(),
        "Total Engagement": totalEng.toLocaleString(),
        "Avg CTR": avgCTR.toFixed(2) + "%", "Avg Retention": avgRet.toFixed(1) + "%",
        "Avg AI Score": avgScore.toFixed(0) + "/100",
        "Channel Health": avgScore >= 60 ? "Excellent" : avgScore >= 40 ? "Good" : avgScore >= 25 ? "Needs Work" : "Critical",
      } });

    // Upload gap check
    const newest = videos.reduce((a, v) => new Date(v.published_at) > new Date(a.published_at) ? v : a);
    const daysSinceLast = (Date.now() - new Date(newest.published_at).getTime()) / 86400000;
    if (daysSinceLast > 14) {
      events.push({ type: "upload_gap", videoId: "channel", title: "Upload Gap Warning", emoji: "📅",
        message: "No upload in " + Math.floor(daysSinceLast) + " days! Consistency is key.", severity: "warning",
        data: { "Days Since Upload": Math.floor(daysSinceLast), "Last Video": newest.title?.substring(0, 40), Action: "Upload this week" } });
    }
  }

  if (channel?.subscribers) {
    const m = milestoneHit(channel.subscribers, (channel.subscribers || 0) - 1);
    if (m) {
      events.push({ type: "sub_milestone", videoId: "channel", title: "Subscriber Milestone", emoji: "🎉",
        message: "Channel reached " + m.toLocaleString() + " subscribers!", severity: "success",
        data: { Milestone: m.toLocaleString() + " subs", Current: channel.subscribers.toLocaleString() } });
    }
  }

  if (events.length === 0) {
    events.push({ type: "all_stable", videoId: "system", title: "All Stable", emoji: "✅",
      message: "No significant changes. Channel is stable.", severity: "info",
      data: { Status: "Stable", "Videos Checked": videos.length } });
  }

  return events;
}
