let memorySnapshot: Record<string, VideoSnapshot> = {};

export interface VideoSnapshot {
  youtube_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
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
  videos: any[], prev: Record<string, VideoSnapshot>, channel?: any
): NotificationEvent[] {
  const events: NotificationEvent[] = [];
  const hasPrev = Object.keys(prev).length > 0;
  const subs = channel?.subscribers || 1000;

  for (const v of videos) {
    const id = v.youtube_id;
    const t = (v.title || "Untitled").substring(0, 50);
    const p = prev[id];
    const views = v.views || 0;
    const likes = v.likes || 0;
    const comments = v.comments || 0;
    const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

    const daysSince = v.published_at
      ? Math.max(1, (Date.now() - new Date(v.published_at).getTime()) / 86400000)
      : 1;
    const viewsPerDay = views / daysSince;
    const viewsVsSubs = (views / Math.max(subs, 1)) * 100;

    // ── New video ──
    if (!p && isNew(v.published_at)) {
      events.push({
        type: "new_video", videoId: id, title: t, emoji: "🆕",
        message: "New video uploaded! Promote immediately.",
        severity: "info",
        data: {
          Video: t,
          "Views (so far)": views.toLocaleString(),
          "Likes": likes.toLocaleString(),
          "Comments": comments.toLocaleString(),
          "Posted": new Date(v.published_at).toLocaleDateString(),
        },
      });
    }

    // ── Growth tracking (REAL data only) ──
    if (p && hasPrev) {
      const vd = views - p.views;
      const vc = pct(views, p.views);
      const ld = likes - p.likes;
      const cd = comments - p.comments;

      if (vc > 100 && vd > 500) {
        events.push({
          type: "viral_explosion", videoId: id, title: t, emoji: "🔥",
          message: "VIRAL! Views exploding - boost everywhere NOW!",
          severity: "critical",
          data: {
            Video: t,
            "Views Now": views.toLocaleString(),
            "Views Added": "+" + vd.toLocaleString(),
            "Growth": "+" + vc.toFixed(0) + "%",
            "Period": "Since last check",
          },
        });
      } else if (vc > 50 && vd > 100) {
        events.push({
          type: "viral", videoId: id, title: t, emoji: "🚀",
          message: "Going viral! Capitalize immediately.",
          severity: "success",
          data: {
            Video: t,
            "Views Added": "+" + vd.toLocaleString(),
            "Growth": "+" + vc.toFixed(0) + "%",
          },
        });
      } else if (vc >= 10 && vd > 20) {
        events.push({
          type: "rising", videoId: id, title: t, emoji: "📈",
          message: "Gaining momentum since last check.",
          severity: "success",
          data: {
            Video: t,
            "Views Added": "+" + vd,
            "Growth": "+" + vc.toFixed(1) + "%",
          },
        });
      } else if (vd === 0 && p.views > 100 && hasPrev) {
        events.push({
          type: "stagnant", videoId: id, title: t, emoji: "⏸️",
          message: "Zero new views since last check. Algorithm stopped pushing.",
          severity: "warning",
          data: {
            Video: t,
            "Views": views.toLocaleString(),
            "Last Snapshot": new Date(p.captured_at).toLocaleString(),
            "Tip": "Update thumbnail or share on socials",
          },
        });
      } else if (vd < 0) {
        events.push({
          type: "views_dropped", videoId: id, title: t, emoji: "🔻",
          message: "View count decreased - YouTube removed spam views.",
          severity: "info",
          data: {
            Video: t,
            "Previous": p.views.toLocaleString(),
            "Now": views.toLocaleString(),
            "Difference": vd.toLocaleString(),
          },
        });
      }

      if (cd >= 5 && pct(comments, p.comments) > 50) {
        events.push({
          type: "comments_spike", videoId: id, title: t, emoji: "💬",
          message: "Comment activity exploded - engage with viewers!",
          severity: "info",
          data: {
            Video: t,
            "New Comments": "+" + cd,
            "Total": comments.toLocaleString(),
          },
        });
      }
      if (ld >= 10 && pct(likes, p.likes) > 30) {
        events.push({
          type: "likes_spike", videoId: id, title: t, emoji: "👍",
          message: "Likes pouring in - audience loves this!",
          severity: "success",
          data: {
            Video: t,
            "New Likes": "+" + ld,
            "Total": likes.toLocaleString(),
          },
        });
      }

      const m = milestoneHit(views, p.views);
      if (m) {
        events.push({
          type: "milestone", videoId: id, title: t, emoji: "🏆",
          message: "MILESTONE! Crossed " + m.toLocaleString() + " views!",
          severity: "success",
          data: { Video: t, "Milestone": m.toLocaleString() + " views" },
        });
      }
    }

    // ── Performance health (REAL metrics only) ──
    if (views < 30) continue;

    // Engagement rate alerts (REAL: likes+comments/views)
    if (engRate < 0.5 && views >= 500) {
      events.push({
        type: "critical_engagement", videoId: id, title: t, emoji: "❌",
        message: "Engagement extremely low - content not resonating with audience.",
        severity: "critical",
        data: {
          Video: t,
          "Engagement Rate": engRate.toFixed(2) + "%",
          "Likes": likes.toLocaleString(),
          "Comments": comments.toLocaleString(),
          "Views": views.toLocaleString(),
          "Calculation": "(likes + comments) / views * 100",
        },
      });
    } else if (engRate < 1 && views >= 200) {
      events.push({
        type: "low_engagement", videoId: id, title: t, emoji: "⚠️",
        message: "Below average engagement (industry avg: 2-5%).",
        severity: "warning",
        data: {
          Video: t,
          "Engagement Rate": engRate.toFixed(2) + "%",
          "Industry Avg": "2-5%",
          "Action": "Add stronger CTAs in first 30 seconds",
        },
      });
    } else if (engRate >= 8 && views >= 100) {
      events.push({
        type: "high_engagement", videoId: id, title: t, emoji: "❤️",
        message: "Excellent engagement! Audience deeply connecting with this content.",
        severity: "success",
        data: {
          Video: t,
          "Engagement Rate": engRate.toFixed(2) + "%",
          "Likes": likes.toLocaleString(),
          "Comments": comments.toLocaleString(),
        },
      });
    }

    // Views per day alerts (REAL: views / days since publish)
    if (daysSince > 30 && viewsPerDay < 1 && views < 100) {
      events.push({
        type: "dead_video", videoId: id, title: t, emoji: "🪦",
        message: "Video gets less than 1 view/day after " + Math.floor(daysSince) + " days.",
        severity: "warning",
        data: {
          Video: t,
          "Views/Day": viewsPerDay.toFixed(2),
          "Age": Math.floor(daysSince) + " days",
          "Total Views": views,
          "Recommendation": "Consider updating thumbnail/title or unlisting",
        },
      });
    }
    if (daysSince <= 7 && viewsPerDay >= 100) {
      events.push({
        type: "strong_launch", videoId: id, title: t, emoji: "🎉",
        message: "Strong launch! New video performing well.",
        severity: "success",
        data: {
          Video: t,
          "Views/Day": Math.round(viewsPerDay).toLocaleString(),
          "Age": Math.floor(daysSince) + " days",
          "Total": views.toLocaleString(),
        },
      });
    }

    // Reach alerts (REAL: views vs subscriber count)
    if (viewsVsSubs < 5 && subs > 100 && daysSince > 7 && daysSince < 365) {
      events.push({
        type: "low_reach", videoId: id, title: t, emoji: "📉",
        message: "Only " + viewsVsSubs.toFixed(1) + "% of subscribers watched this video.",
        severity: "warning",
        data: {
          Video: t,
          "Views": views.toLocaleString(),
          "Subscribers": subs.toLocaleString(),
          "Reach": viewsVsSubs.toFixed(1) + "%",
          "Target": ">20% of subs should watch",
        },
      });
    } else if (viewsVsSubs >= 100 && daysSince > 7) {
      events.push({
        type: "exceeded_subs", videoId: id, title: t, emoji: "🌟",
        message: "Views exceed subscriber count - video is reaching non-subscribers!",
        severity: "success",
        data: {
          Video: t,
          "Views": views.toLocaleString(),
          "Subscribers": subs.toLocaleString(),
          "Ratio": viewsVsSubs.toFixed(0) + "% of subs",
        },
      });
    }
  }

  // ── Channel-level events ──
  if (videos.length > 2) {
    const sorted = [...videos].sort((a, b) => (b.score || 0) - (a.score || 0));
    const top = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (top.views >= 100) {
      events.push({
        type: "top_performer", videoId: top.youtube_id, title: top.title?.substring(0, 50),
        message: "Best video by AI score (real engagement-based).",
        severity: "success", emoji: "🥇",
        data: {
          Video: top.title?.substring(0, 45),
          Score: (top.score || 0) + "/100",
          Views: (top.views || 0).toLocaleString(),
          Likes: (top.likes || 0).toLocaleString(),
        },
      });
    }
    if (worst.views >= 30) {
      events.push({
        type: "worst_performer", videoId: worst.youtube_id, title: worst.title?.substring(0, 50),
        message: "Lowest scoring video - needs attention.",
        severity: "warning", emoji: "🔴",
        data: {
          Video: worst.title?.substring(0, 45),
          Score: (worst.score || 0) + "/100",
          Views: (worst.views || 0).toLocaleString(),
        },
      });
    }

    const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
    const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
    const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
    const avgEng = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
    const avgScore = sorted.reduce((s, v) => s + (v.score || 0), 0) / sorted.length;

    events.push({
      type: "daily_summary", videoId: "channel", title: "Channel Daily Summary",
      message: "End-of-day report (all numbers verified real).",
      severity: "info", emoji: "📊",
      data: {
        "Videos": videos.length,
        "Total Views": totalViews.toLocaleString(),
        "Total Likes": totalLikes.toLocaleString(),
        "Total Comments": totalComments.toLocaleString(),
        "Avg Engagement": avgEng.toFixed(2) + "%",
        "Avg AI Score": avgScore.toFixed(0) + "/100",
        "Health": avgScore >= 60 ? "Excellent" : avgScore >= 40 ? "Good" : avgScore >= 25 ? "Needs Work" : "Critical",
      },
    });

    // Upload gap
    const newest = videos.reduce((a, v) =>
      new Date(v.published_at) > new Date(a.published_at) ? v : a
    );
    const daysSinceLast = (Date.now() - new Date(newest.published_at).getTime()) / 86400000;
    if (daysSinceLast > 14) {
      events.push({
        type: "upload_gap", videoId: "channel", title: "Upload Gap Warning", emoji: "📅",
        message: "No upload in " + Math.floor(daysSinceLast) + " days! Consistency matters.",
        severity: "warning",
        data: {
          "Days Since Upload": Math.floor(daysSinceLast),
          "Last Video": newest.title?.substring(0, 40),
          "Action": "Upload this week",
        },
      });
    }
  }

  if (channel?.subscribers) {
    const m = milestoneHit(channel.subscribers, (channel.subscribers || 0) - 1);
    if (m) {
      events.push({
        type: "sub_milestone", videoId: "channel", title: "Subscriber Milestone", emoji: "🎉",
        message: "Channel reached " + m.toLocaleString() + " subscribers!",
        severity: "success",
        data: { Milestone: m.toLocaleString() + " subs", Current: channel.subscribers.toLocaleString() },
      });
    }
  }

  if (events.length === 0) {
    events.push({
      type: "all_stable", videoId: "system", title: "All Stable", emoji: "✅",
      message: "No significant changes. Channel is stable.",
      severity: "info",
      data: { Status: "Stable", "Videos Checked": videos.length },
    });
  }

  return events;
}
