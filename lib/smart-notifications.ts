// V15.2 Smart Notifications - backwards-compatible API
let memorySnapshot: Record<string, VideoSnapshot> = {};

export interface VideoSnapshot {
  youtube_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  ctr: number | null;
  avg_view_percentage: number | null;
  watch_time_minutes: number | null;
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
  } catch { return null; }
}

export async function loadSnapshot(): Promise<Record<string, VideoSnapshot>> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data } = await sb.from("snapshots").select("snapshot").eq("id", "latest").maybeSingle();
      if (data?.snapshot && typeof data.snapshot === "object") return data.snapshot;
    } catch {}
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
      ctr: v.ctr ?? null,
      avg_view_percentage: v.avg_view_percentage ?? null,
      watch_time_minutes: v.watch_time_minutes ?? null,
      published_at: v.published_at || "", captured_at: now,
    };
  }
  memorySnapshot = snapshot;
  const sb = getSupabase();
  if (sb) {
    try { await sb.from("snapshots").upsert({ id: "latest", snapshot, updated_at: now }); } catch {}
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
  videos: any[],
  prev: Record<string, VideoSnapshot>,
  channel?: any
): NotificationEvent[] {
  const events: NotificationEvent[] = [];
  const hasPrev = Object.keys(prev).length > 0;
  const activeVideos = videos.filter(v => (v.views || 0) > 0);

  for (const v of videos) {
    const id = v.youtube_id;
    const t = (v.title || "Untitled").substring(0, 60);
    const p = prev[id];
    const views = v.views || 0;
    const likes = v.likes || 0;
    const comments = v.comments || 0;
    const retention = v.avg_view_percentage;
    const hasReal = v.has_real_analytics;

    const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
    const daysSince = v.published_at
      ? Math.max(1, (Date.now() - new Date(v.published_at).getTime()) / 86400000)
      : 1;
    const viewsPerDay = views / daysSince;

    if (isNew(v.published_at)) {
      events.push({
        type: "new_video", videoId: id, title: t, emoji: "🆕",
        message: "New video uploaded - promote in first 24h for algorithm boost",
        severity: "info",
        data: { Video: t, Views: views, Likes: likes, Comments: comments,
                Posted: new Date(v.published_at).toLocaleDateString() },
      });
      continue;
    }

    if (views === 0) continue;

    if (p && hasPrev) {
      const vd = views - p.views;
      const vc = pct(views, p.views);
      const ld = likes - p.likes;
      const cd = comments - p.comments;

      if (vc > 100 && vd > 500) {
        events.push({
          type: "viral_explosion", videoId: id, title: t, emoji: "🔥",
          message: "VIRAL! Views exploding!",
          severity: "critical",
          data: { Video: t, "Views Now": views.toLocaleString(),
                  Added: "+" + vd.toLocaleString(), Growth: "+" + vc.toFixed(0) + "%" },
        });
      } else if (vc > 50 && vd > 100) {
        events.push({
          type: "viral", videoId: id, title: t, emoji: "🚀",
          message: "Going viral - pin a comment & promote NOW",
          severity: "critical",
          data: { Video: t, Added: "+" + vd.toLocaleString(), Growth: "+" + vc.toFixed(0) + "%" },
        });
      } else if (vc >= 10 && vd > 20) {
        events.push({
          type: "rising", videoId: id, title: t, emoji: "📈",
          message: "Gaining momentum",
          severity: "success",
          data: { Video: t, Added: "+" + vd, Growth: "+" + vc.toFixed(1) + "%" },
        });
      }

      if (cd >= 5 && pct(comments, p.comments) > 50) {
        events.push({
          type: "comments_spike", videoId: id, title: t, emoji: "💬",
          message: "Comments spiked - reply fast for algo boost",
          severity: "info",
          data: { Video: t, "New Comments": "+" + cd },
        });
      }

      if (ld >= 10 && pct(likes, p.likes) > 30) {
        events.push({
          type: "likes_spike", videoId: id, title: t, emoji: "👍",
          message: "Likes pouring in!",
          severity: "success",
          data: { Video: t, "New Likes": "+" + ld },
        });
      }

      const m = milestoneHit(views, p.views);
      if (m) {
        events.push({
          type: "milestone", videoId: id, title: t, emoji: "🏆",
          message: "Crossed " + m.toLocaleString() + " views!",
          severity: "success",
          data: { Video: t, Milestone: m.toLocaleString() },
        });
      }
    }

    if (engRate < 0.3 && views >= 500) {
      events.push({
        type: "critical_engagement", videoId: id, title: t, emoji: "❌",
        message: "Critical engagement: " + engRate.toFixed(2) + "%",
        severity: "critical",
        data: { Video: t, "Engagement Rate": engRate.toFixed(2) + "%",
                Likes: likes, Comments: comments, Views: views.toLocaleString() },
      });
    }

    if (hasReal && retention != null && retention < 15 && views >= 100) {
      events.push({
        type: "critical_retention", videoId: id, title: t, emoji: "⏱️",
        message: "Critical retention: " + retention.toFixed(1) + "% - rewrite first 15 seconds",
        severity: "critical",
        data: { Video: t, Retention: retention.toFixed(1) + "%",
                "Skipped Away": (100 - retention).toFixed(1) + "%" },
      });
    }

    if (daysSince > 30 && viewsPerDay < 1 && views < 100) {
      if (!p || (p.views || 0) === views) {
        events.push({
          type: "dead_video", videoId: id, title: t, emoji: "🪦",
          message: "Dead video: " + viewsPerDay.toFixed(2) + " views/day after " + Math.floor(daysSince) + " days",
          severity: "warning",
          data: { Video: t, "Views/Day": viewsPerDay.toFixed(2),
                  Age: Math.floor(daysSince) + "d", Views: views },
        });
      }
    }

    if (daysSince <= 7 && viewsPerDay >= 100) {
      events.push({
        type: "strong_launch", videoId: id, title: t, emoji: "🎉",
        message: "Strong launch! " + Math.round(viewsPerDay) + " views/day",
        severity: "success",
        data: { Video: t, "Views/Day": Math.round(viewsPerDay), Total: views },
      });
    }
  }

  if (activeVideos.length > 2) {
    const sorted = [...activeVideos].sort((a, b) => (b.score || 0) - (a.score || 0));
    const top = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (top && top.views >= 100) {
      events.push({
        type: "top_performer", videoId: top.youtube_id,
        title: top.title?.substring(0, 60), emoji: "🥇",
        message: "Top video by AI score",
        severity: "success",
        data: { Video: top.title?.substring(0, 50), Score: (top.score || 0) + "/100",
                Views: top.views.toLocaleString(), Likes: top.likes, Comments: top.comments },
      });
    }

    if (worst && (worst.score || 0) < (top?.score || 100) - 30 && worst.views >= 50) {
      events.push({
        type: "worst_performer", videoId: worst.youtube_id,
        title: worst.title?.substring(0, 60), emoji: "🔴",
        message: "Lowest scoring active video - consider refresh",
        severity: "warning",
        data: { Video: worst.title?.substring(0, 50),
                Score: (worst.score || 0) + "/100", Views: worst.views.toLocaleString() },
      });
    }

    const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
    const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
    const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
    const totalShares = videos.reduce((s, v) => s + (v.shares || 0), 0);
    const totalWatchTime = videos.reduce((s, v) => s + (v.watch_time_minutes || 0), 0);
    const totalSubsGained = videos.reduce((s, v) => s + (v.subscribers_gained || 0), 0);
    const avgEng = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
    const avgScore = activeVideos.reduce((s, v) => s + (v.score || 0), 0) / activeVideos.length;
    const realVids = videos.filter(v => v.avg_view_percentage != null);
    const avgRetention = realVids.length > 0
      ? realVids.reduce((s, v) => s + v.avg_view_percentage, 0) / realVids.length : null;

    const now = Date.now();
    const dayAgo = now - 86400000;
    const weekAgo = now - 7 * 86400000;
    const monthAgo = now - 30 * 86400000;

    const dayVids = videos.filter(v => new Date(v.published_at).getTime() > dayAgo);
    const weekVids = videos.filter(v => new Date(v.published_at).getTime() > weekAgo);
    const monthVids = videos.filter(v => new Date(v.published_at).getTime() > monthAgo);

    const mostEngagedVideo = [...videos].sort((a, b) =>
      ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0))
    )[0];

    const summaryData: any = {
      "Total Videos": videos.length,
      "Active Videos": activeVideos.length,
      "Total Views": totalViews.toLocaleString(),
      "Total Likes": totalLikes.toLocaleString(),
      "Total Comments": totalComments.toLocaleString(),
      "Total Shares": totalShares.toLocaleString(),
      "Avg Engagement": avgEng.toFixed(2) + "%",
      "Avg AI Score": avgScore.toFixed(0) + "/100",
      "Uploads (24h)": dayVids.length,
      "Uploads (7d)": weekVids.length,
      "Uploads (30d)": monthVids.length,
    };
    if (avgRetention !== null) summaryData["Avg Retention"] = avgRetention.toFixed(1) + "%";
    if (totalWatchTime > 0) summaryData["Watch Hours"] = Math.round(totalWatchTime / 60).toLocaleString();
    if (totalSubsGained > 0) summaryData["Subs Gained"] = totalSubsGained.toLocaleString();
    if (mostEngagedVideo) summaryData["Most Engaged"] = (mostEngagedVideo.title || "").substring(0, 40);
    summaryData["Health"] = avgScore >= 60 ? "Excellent" : avgScore >= 40 ? "Good" :
                            avgScore >= 25 ? "Needs Work" : "Critical";

    events.push({
      type: "daily_summary", videoId: "channel", title: "Channel Daily Summary",
      message: "Full breakdown for today",
      severity: "info", emoji: "📊",
      data: summaryData,
    });

    const newest = videos.reduce((a, v) =>
      new Date(v.published_at) > new Date(a.published_at) ? v : a
    );
    const daysSinceLast = (Date.now() - new Date(newest.published_at).getTime()) / 86400000;
    if (daysSinceLast > 14) {
      events.push({
        type: "upload_gap", videoId: "channel", title: "Upload Gap Warning", emoji: "📅",
        message: "No upload in " + Math.floor(daysSinceLast) + " days - algorithm cooling down",
        severity: "warning",
        data: { Days: Math.floor(daysSinceLast),
                "Last Video": newest.title?.substring(0, 40) },
      });
    }
  }

  if (channel?.subscribers) {
    const m = milestoneHit(channel.subscribers, channel.subscribers - 1);
    if (m) {
      events.push({
        type: "sub_milestone", videoId: "channel", title: "Subscriber Milestone", emoji: "🎉",
        message: m.toLocaleString() + " subscribers reached!",
        severity: "success",
        data: { Milestone: m.toLocaleString() },
      });
    }
  }

  if (!hasPrev) {
    events.push({
      type: "first_sync", videoId: "system", title: "First Sync",
      message: "Baseline snapshot saved - future syncs will detect REAL changes",
      severity: "info", emoji: "✅",
      data: { "Videos Tracked": videos.length, "Active Videos": activeVideos.length },
    });
  }

  const seen = new Set<string>();
  const unique: NotificationEvent[] = [];
  for (const e of events) {
    const key = e.type + ":" + e.videoId;
    if (!seen.has(key)) { seen.add(key); unique.push(e); }
  }

  const priority: Record<string, number> = {
    viral_explosion: 0, viral: 1, milestone: 2, sub_milestone: 3,
    new_video: 4, comments_spike: 5, likes_spike: 6, rising: 7,
    strong_launch: 8, critical_retention: 9, critical_engagement: 10,
    top_performer: 11, worst_performer: 12, upload_gap: 13,
    dead_video: 14, daily_summary: 15, first_sync: 99,
  };
  unique.sort((a, b) => (priority[a.type] ?? 50) - (priority[b.type] ?? 50));
  return unique.slice(0, 15);
}

export function generateDailyDigest(channel: any, videos: any[]) {
  const dayAgo = Date.now() - 86400000;
  const todayUploads = videos.filter(v => new Date(v.published_at).getTime() > dayAgo);
  const top = [...videos].sort((a, b) => b.views - a.views)[0];
  const worstRecent = videos.filter(v => {
    const age = (Date.now() - new Date(v.published_at).getTime()) / 86400000;
    return age <= 7 && v.views >= 50;
  }).sort((a, b) => (a.engagement_rate || 0) - (b.engagement_rate || 0))[0];

  const data: Record<string, string | number> = {
    Date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    Subscribers: (channel.subscribers || 0).toLocaleString(),
    "Total Views": (channel.totalViews || 0).toLocaleString(),
    "Videos Total": videos.length,
    "Uploaded Today": todayUploads.length,
  };
  if (top) {
    data["Top Video"] = top.title?.substring(0, 50);
    data["Top Views"] = top.views.toLocaleString();
  }
  if (worstRecent) {
    data["Needs Help"] = worstRecent.title?.substring(0, 50);
    data["Engagement"] = (worstRecent.engagement_rate || 0) + "%";
  }

  return {
    title: "Daily Digest - " + (channel.title || "Channel"),
    message: "Your channel snapshot for today",
    data,
  };
}

export function generateWeeklyDigest(channel: any, videos: any[]) {
  const weekAgo = Date.now() - 7 * 86400000;
  const weekUploads = videos.filter(v => new Date(v.published_at).getTime() > weekAgo);
  const topWeek = [...weekUploads].sort((a, b) => b.views - a.views).slice(0, 3);
  const mostLiked = [...videos].sort((a, b) => b.likes - a.likes)[0];
  const mostCommented = [...videos].sort((a, b) => b.comments - a.comments)[0];

  const data: Record<string, string | number> = {
    Period: new Date(weekAgo).toLocaleDateString() + " to " + new Date().toLocaleDateString(),
    "Videos Uploaded": weekUploads.length,
    "Weekly Views": weekUploads.reduce((s, v) => s + v.views, 0).toLocaleString(),
  };
  topWeek.forEach((v, i) => {
    data["Top " + (i + 1)] = (v.title?.substring(0, 40) || "") + " (" + v.views.toLocaleString() + ")";
  });
  if (mostLiked) data["Most Liked"] = (mostLiked.title?.substring(0, 40) || "") + " (" + mostLiked.likes + " likes)";
  if (mostCommented) data["Most Discussed"] = (mostCommented.title?.substring(0, 40) || "") + " (" + mostCommented.comments + " comments)";

  return {
    title: "Weekly Report - " + (channel.title || "Channel"),
    message: "This week in review",
    data,
  };
}

export function generateMonthlyDigest(channel: any, videos: any[]) {
  const monthAgo = Date.now() - 30 * 86400000;
  const monthVids = videos.filter(v => new Date(v.published_at).getTime() > monthAgo);
  const topMonth = [...monthVids].sort((a, b) => b.views - a.views).slice(0, 5);
  const totalViews = monthVids.reduce((s, v) => s + v.views, 0);
  const totalLikes = monthVids.reduce((s, v) => s + v.likes, 0);
  const avgEng = monthVids.length > 0
    ? monthVids.reduce((s, v) => s + (v.engagement_rate || 0), 0) / monthVids.length : 0;

  const data: Record<string, string | number> = {
    Period: new Date(monthAgo).toLocaleDateString() + " to " + new Date().toLocaleDateString(),
    "Videos Uploaded": monthVids.length,
    "Monthly Views": totalViews.toLocaleString(),
    "Monthly Likes": totalLikes.toLocaleString(),
    "Avg Engagement": avgEng.toFixed(2) + "%",
  };
  topMonth.forEach((v, i) => {
    data["Top " + (i + 1)] = (v.title?.substring(0, 40) || "") + " (" + v.views.toLocaleString() + ")";
  });

  return {
    title: "Monthly Report - " + (channel.title || "Channel"),
    message: "Full month performance",
    data,
  };
}
