// ═══════════════════════════════════════════════════════════════════
// SMART NOTIFICATIONS v4.0 — Professional YouTube Analytics Engine
// Eagle 3D Streaming — All alert types, zero spam
// ═══════════════════════════════════════════════════════════════════

// ─── MEMORY SNAPSHOT (fallback when no Supabase) ────────────────
let memorySnapshot: Record<string, VideoSnapshot> = {};

// ─── INTERFACES ─────────────────────────────────────────────────
export interface VideoSnapshot {
  youtube_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  ctr: number | null;
  avg_view_percentage: number | null;
  watch_time_minutes: number | null;
  subscribers_gained: number;
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
  priority: number;
}

// ─── SUPABASE (optional) ────────────────────────────────────────
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
    const a = v.analytics || {};
    snapshot[v.youtube_id] = {
      youtube_id: v.youtube_id,
      title: v.title || "",
      views: v.views || 0,
      likes: v.likes || 0,
      comments: v.comments || 0,
      shares: a.shares || v.shares || 0,
      ctr: a.ctr ?? null,
      avg_view_percentage: a.avg_view_percentage ?? null,
      watch_time_minutes: a.watch_time_minutes ?? null,
      subscribers_gained: a.subscribers_gained || v.subscribers_gained || 0,
      published_at: v.published_at || "",
      captured_at: now,
    };
  }
  memorySnapshot = snapshot;
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from("snapshots").upsert({ id: "latest", snapshot, updated_at: now });
    } catch {}
  }
}

// ─── HELPERS ────────────────────────────────────────────────────
function pct(now: number, prev: number): number {
  if (prev === 0) return now > 0 ? 100 : 0;
  return ((now - prev) / prev) * 100;
}

function ageDays(publishedAt: string): number {
  if (!publishedAt) return 999;
  return Math.max(0.001, (Date.now() - new Date(publishedAt).getTime()) / 86400000);
}

function isNew(publishedAt: string): boolean {
  return ageDays(publishedAt) <= 2;
}

function engRate(likes: number, comments: number, views: number): number {
  if (views === 0) return 0;
  return ((likes + comments) / views) * 100;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function shortTitle(t: string, len = 50): string {
  return (t || "Untitled").substring(0, len);
}

// Milestone checker — returns the milestone crossed or null
function milestoneHit(value: number, prev: number, milestones: number[]): number | null {
  for (const m of milestones) {
    if (value >= m && prev < m) return m;
  }
  return null;
}

const VIEW_MILESTONES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
const SUB_MILESTONES  = [100, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 500000, 1000000];
const WATCH_MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000]; // watch hours

// ─── RETENTION REAL-DATA GUARD ──────────────────────────────────
// YouTube API returns 0 or null for videos with no Analytics access
// OR returns garbage <1% for API artifact — filter these out
function isRealRetention(pct: number | null | undefined, views: number, hasReal: boolean): boolean {
  if (!hasReal) return false;
  if (pct == null || pct === 0) return false;
  if (pct < 1.0) return false;     // API artifact — no human leaves in <1%
  if (views < 100) return false;   // too few views for meaningful data
  return true;
}

// ─── MAX PER TYPE (anti-spam) ────────────────────────────────────
const MAX_PER_TYPE: Record<string, number> = {
  critical_retention:   3,
  critical_engagement:  3,
  dead_video:           3,
  excellent_retention:  0,  // DISABLED — removed completely
  rising:               5,
  views_dropped:        3,
  likes_spike:          3,
  comments_spike:       3,
  shares_spike:         3,
  watch_time_milestone: 2,
  new_video:            5,
  strong_launch:        3,
  consistency_warning:  1,
  momentum_loss:        3,
  hidden_gem:           3,
  high_ctr_low_views:   3,
  low_ctr_warning:      3,
  re_engagement:        2,
};

// ─── MAIN: detectEvents ─────────────────────────────────────────
export function detectEvents(
  videos: any[],
  prev: Record<string, VideoSnapshot>,
  channel?: any
): NotificationEvent[] {

  const events: NotificationEvent[] = [];
  const typeCounts: Record<string, number> = {};
  const hasPrev = Object.keys(prev).length > 0;
  const activeVideos = videos.filter(v => (v.views || 0) > 0);

  // ── Helper: add event with per-type cap ──
  function add(e: NotificationEvent) {
    const max = MAX_PER_TYPE[e.type];
    if (max === 0) return; // disabled type
    const count = typeCounts[e.type] || 0;
    if (max !== undefined && count >= max) return;
    typeCounts[e.type] = count + 1;
    events.push(e);
  }

  // ════════════════════════════════════════
  // PER-VIDEO LOOP
  // ════════════════════════════════════════
  for (const v of videos) {
    const id    = v.youtube_id;
    const title = shortTitle(v.title, 60);
    const p     = prev[id]; // previous snapshot

    const views    = v.views    || 0;
    const likes    = v.likes    || 0;
    const comments = v.comments || 0;
    const a        = v.analytics || {};
    const shares   = a.shares || v.shares || 0;
    const ctr      = a.ctr ?? null;
    const retention= a.avg_view_percentage ?? null;
    const watchMin = a.watch_time_minutes ?? null;
    const subsGained = a.subscribers_gained || 0;
    const hasReal  = v.has_real_analytics === true;
    const er       = engRate(likes, comments, views);
    const age      = ageDays(v.published_at);
    const vpd      = views / age; // views per day

    // ── 1. NEW VIDEO (< 48h) ──────────────────────────────────
    if (isNew(v.published_at)) {
      add({
        type: "new_video", videoId: id, title, emoji: "🆕", priority: 4,
        message: `"${shortTitle(title, 45)}" is live — push in first 24h for algorithm boost`,
        severity: "info",
        data: {
          Video: title, "Hours Live": Math.floor(age * 24) + "h",
          Views: views, Likes: likes, Comments: comments,
          Posted: new Date(v.published_at).toLocaleDateString("en-US"),
        },
      });
      continue; // skip other checks for brand new videos
    }

    if (views === 0) continue;

    // ── 2. SNAPSHOT-BASED ALERTS (need previous data) ─────────
    if (p && hasPrev) {
      const vDelta  = views    - (p.views    || 0);
      const lDelta  = likes    - (p.likes    || 0);
      const cDelta  = comments - (p.comments || 0);
      const sDelta  = shares   - (p.shares   || 0);
      const subDelta = subsGained - (p.subscribers_gained || 0);

      const vPct = pct(views,    p.views    || 0);
      const lPct = pct(likes,    p.likes    || 0);
      const cPct = pct(comments, p.comments || 0);

      // 🔥 VIRAL EXPLOSION
      if (vPct >= 200 && vDelta >= 1000) {
        add({
          type: "viral_explosion", videoId: id, title, emoji: "🔥", priority: 1,
          message: `VIRAL EXPLOSION! +${fmt(vDelta)} views (${vPct.toFixed(0)}% surge)`,
          severity: "critical",
          data: {
            Video: title, "New Views": "+" + fmt(vDelta),
            "Growth %": "+" + vPct.toFixed(0) + "%",
            "Total Views": fmt(views), Likes: likes, Comments: comments,
          },
        });
      }
      // 🚀 VIRAL
      else if (vPct >= 100 && vDelta >= 500) {
        add({
          type: "viral", videoId: id, title, emoji: "🚀", priority: 2,
          message: `Going viral! +${fmt(vDelta)} views (${vPct.toFixed(0)}% growth) — promote NOW`,
          severity: "critical",
          data: {
            Video: title, "New Views": "+" + fmt(vDelta),
            "Growth %": "+" + vPct.toFixed(0) + "%", "Total Views": fmt(views),
          },
        });
      }
      // 📈 RISING
      else if (vPct >= 30 && vDelta >= 50) {
        add({
          type: "rising", videoId: id, title, emoji: "📈", priority: 7,
          message: `Rising! +${fmt(vDelta)} views (${vPct.toFixed(0)}% growth)`,
          severity: "success",
          data: {
            Video: title, "New Views": "+" + fmt(vDelta),
            "Growth %": "+" + vPct.toFixed(0) + "%", "Total Views": fmt(views),
          },
        });
      }

      // 📉 VIEW DROP
      if (vDelta < 0 && Math.abs(vDelta) >= 100 && Math.abs(vPct) >= 40) {
        add({
          type: "views_dropped", videoId: id, title, emoji: "📉", priority: 3,
          message: `Views dropped ${Math.abs(vPct).toFixed(0)}% — lost ${fmt(Math.abs(vDelta))} views`,
          severity: "warning",
          data: {
            Video: title, "Views Lost": fmt(Math.abs(vDelta)),
            "Drop %": "-" + Math.abs(vPct).toFixed(0) + "%",
            "Current Views": fmt(views),
          },
        });
      }

      // 👍 LIKES SPIKE
      if (lDelta >= 10 && lPct >= 50) {
        add({
          type: "likes_spike", videoId: id, title, emoji: "👍", priority: 6,
          message: `Likes spiking! +${lDelta} likes (${lPct.toFixed(0)}% increase)`,
          severity: "success",
          data: {
            Video: title, "New Likes": "+" + lDelta,
            "Growth %": "+" + lPct.toFixed(0) + "%", "Total Likes": fmt(likes),
          },
        });
      }

      // 💬 COMMENTS SPIKE
      if (cDelta >= 3 && cPct >= 50) {
        add({
          type: "comments_spike", videoId: id, title, emoji: "💬", priority: 5,
          message: `Comments spiking! +${cDelta} comments — reply fast for algo boost`,
          severity: "info",
          data: {
            Video: title, "New Comments": "+" + cDelta,
            "Growth %": "+" + cPct.toFixed(0) + "%", "Total Comments": fmt(comments),
          },
        });
      }

      // 🔗 SHARES SPIKE
      if (sDelta >= 5) {
        add({
          type: "shares_spike", videoId: id, title, emoji: "🔗", priority: 5,
          message: `+${sDelta} new shares — people are spreading this content!`,
          severity: "success",
          data: {
            Video: title, "New Shares": "+" + sDelta,
            "Total Shares": fmt(shares),
          },
        });
      }

      // 👥 SUBSCRIBER SPIKE FROM VIDEO
      if (subDelta >= 10) {
        add({
          type: "subscriber_gained", videoId: id, title, emoji: "👥", priority: 4,
          message: `+${subDelta} subscribers from this video — it's a growth driver!`,
          severity: "success",
          data: {
            Video: title, "New Subs": "+" + subDelta,
            "Total Gained": fmt(subsGained),
          },
        });
      }

      // 🏆 VIEW MILESTONE
      const vm = milestoneHit(views, p.views || 0, VIEW_MILESTONES);
      if (vm) {
        add({
          type: "milestone", videoId: id, title, emoji: "🏆", priority: 2,
          message: `Crossed ${fmt(vm)} views! 🎊`,
          severity: "success",
          data: { Video: title, Milestone: fmt(vm) + " views", "Total Views": fmt(views) },
        });
      }

      // ⏱️ WATCH TIME MILESTONE (if data available)
      if (watchMin && watchMin > 0) {
        const watchHours = watchMin / 60;
        const prevWatchHours = (p.watch_time_minutes || 0) / 60;
        const wm = milestoneHit(watchHours, prevWatchHours, WATCH_MILESTONES);
        if (wm) {
          add({
            type: "watch_time_milestone", videoId: id, title, emoji: "⌚", priority: 5,
            message: `${fmt(wm)} watch hours milestone hit!`,
            severity: "success",
            data: { Video: title, "Watch Hours": fmt(wm), "Total Minutes": fmt(watchMin) },
          });
        }
      }

      // 📉 MOMENTUM LOSS (was rising, now stalling)
      if (vPct < -10 && vDelta < -20 && age > 7 && age < 60) {
        add({
          type: "momentum_loss", videoId: id, title, emoji: "📉", priority: 8,
          message: `Momentum slowing: ${vPct.toFixed(0)}% view change — consider promoting`,
          severity: "warning",
          data: {
            Video: title, "View Change": vPct.toFixed(0) + "%",
            "Days Old": Math.floor(age).toString(),
          },
        });
      }
    }

    // ── 3. NON-SNAPSHOT ALERTS (fire every run with caps) ─────

    // 🎉 STRONG LAUNCH (<7 days, 100+ views/day)
    if (age > 1 && age <= 7 && vpd >= 100) {
      add({
        type: "strong_launch", videoId: id, title, emoji: "🎉", priority: 3,
        message: `Strong launch! ${Math.round(vpd)} views/day in first ${Math.floor(age)} days`,
        severity: "success",
        data: {
          Video: title, "Views/Day": Math.round(vpd).toString(),
          "Days Live": Math.floor(age).toString(), "Total Views": fmt(views),
        },
      });
    }

    // ⏱️ CRITICAL RETENTION (real data only, pct > 1%, 100+ views)
    if (isRealRetention(retention, views, hasReal) && (retention as number) < 15) {
      add({
        type: "critical_retention", videoId: id, title, emoji: "⏱️", priority: 9,
        message: `Critical retention: ${(retention as number).toFixed(1)}% — viewers leaving immediately`,
        severity: "critical",
        data: {
          Video: title,
          Retention: (retention as number).toFixed(1) + "%",
          "Skipped Away": (100 - (retention as number)).toFixed(1) + "%",
          Views: fmt(views),
        },
      });
    }

    // ❌ CRITICAL ENGAGEMENT (<0.5% ER, 500+ views)
    if (er < 0.5 && er > 0 && views >= 500) {
      add({
        type: "critical_engagement", videoId: id, title, emoji: "❌", priority: 10,
        message: `Critical engagement: ${er.toFixed(2)}% — add CTA or refresh thumbnail`,
        severity: "critical",
        data: {
          Video: title, "Engagement Rate": er.toFixed(2) + "%",
          Likes: likes, Comments: comments, Views: fmt(views),
        },
      });
    }

    // 🪦 DEAD VIDEO (30+ days, <1 view/day, capped at 3)
    if (age >= 30 && vpd < 1 && views > 0) {
      add({
        type: "dead_video", videoId: id, title, emoji: "🪦", priority: 14,
        message: `Dead video: ${vpd.toFixed(2)} views/day after ${Math.floor(age)} days`,
        severity: "warning",
        data: {
          Video: title, "Views/Day": vpd.toFixed(2),
          Age: Math.floor(age) + " days", Views: fmt(views),
        },
      });
    }

    // 💎 HIDDEN GEM (high retention, low views — needs promotion)
    if (
      isRealRetention(retention, views, hasReal) &&
      (retention as number) >= 50 && views < 500 && age > 7
    ) {
      add({
        type: "hidden_gem", videoId: id, title, emoji: "💎", priority: 8,
        message: `Hidden gem! ${(retention as number).toFixed(0)}% retention but only ${fmt(views)} views — promote this!`,
        severity: "info",
        data: {
          Video: title, Retention: (retention as number).toFixed(1) + "%",
          Views: fmt(views), "Action": "Boost with community post or Shorts clip",
        },
      });
    }

    // 🎯 HIGH CTR LOW VIEWS (CTR good, views low — title/thumb working but distribution bad)
    if (ctr !== null && ctr >= 8 && views < 300 && age > 3) {
      add({
        type: "high_ctr_low_views", videoId: id, title, emoji: "🎯", priority: 8,
        message: `High CTR (${ctr.toFixed(1)}%) but only ${fmt(views)} views — YouTube isn't pushing it yet`,
        severity: "info",
        data: {
          Video: title, CTR: ctr.toFixed(1) + "%", Views: fmt(views),
          "Action": "Share externally to trigger algorithm",
        },
      });
    }

    // 📊 LOW CTR WARNING (CTR < 2%, 1000+ impressions signal available)
    if (ctr !== null && ctr < 2 && views >= 200) {
      add({
        type: "low_ctr_warning", videoId: id, title, emoji: "📊", priority: 9,
        message: `Low CTR: ${ctr.toFixed(1)}% — thumbnail or title needs improvement`,
        severity: "warning",
        data: {
          Video: title, CTR: ctr.toFixed(1) + "%",
          Views: fmt(views), "Action": "A/B test new thumbnail",
        },
      });
    }

    // 🔄 RE-ENGAGEMENT SPIKE (old video suddenly active again, 60+ days old)
    if (hasPrev && p && age >= 60) {
      const vDelta = views - (p.views || 0);
      const vPctOld = pct(views, p.views || 0);
      if (vDelta >= 200 && vPctOld >= 20) {
        add({
          type: "re_engagement", videoId: id, title, emoji: "��", priority: 6,
          message: `Old video resurging! +${fmt(vDelta)} views on a ${Math.floor(age)}-day-old video`,
          severity: "success",
          data: {
            Video: title, "New Views": "+" + fmt(vDelta),
            "Video Age": Math.floor(age) + " days", "Total Views": fmt(views),
          },
        });
      }
    }

    // ⚡ CONSISTENCY MILESTONE (videos with 10K+ views = proven content)
    if (views >= 10000 && age <= 365) {
      // Only fire once — check if prev was below 10K
      if (hasPrev && p && (p.views || 0) < 10000 && views >= 10000) {
        add({
          type: "consistency_milestone", videoId: id, title, emoji: "⚡", priority: 5,
          message: `"${shortTitle(title, 40)}" crossed 10K — your best content benchmark`,
          severity: "success",
          data: { Video: title, Views: fmt(views), Age: Math.floor(age) + " days" },
        });
      }
    }
  }

  // ════════════════════════════════════════
  // CHANNEL-WIDE ALERTS
  // ════════════════════════════════════════

  if (activeVideos.length > 2) {
    const sortedByScore = [...activeVideos].sort((a, b) => (b.score || b.views || 0) - (a.score || a.views || 0));
    const top   = sortedByScore[0];
    const worst = sortedByScore[sortedByScore.length - 1];

    // ── Channel totals ──
    const totalViews    = videos.reduce((s, v) => s + (v.views    || 0), 0);
    const totalLikes    = videos.reduce((s, v) => s + (v.likes    || 0), 0);
    const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
    const totalShares   = videos.reduce((s, v) => s + ((v.analytics?.shares || v.shares) || 0), 0);
    const totalWatchMin = videos.reduce((s, v) => s + ((v.analytics?.watch_time_minutes) || 0), 0);
    const totalSubsGained = videos.reduce((s, v) => s + ((v.analytics?.subscribers_gained) || 0), 0);
    const avgEng        = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
    const avgScore      = activeVideos.reduce((s, v) => s + (v.score || 0), 0) / activeVideos.length;

    const realVids      = videos.filter(v => v.has_real_analytics && v.analytics?.avg_view_percentage != null);
    const avgRetention  = realVids.length > 0
      ? realVids.reduce((s, v) => s + (v.analytics?.avg_view_percentage || 0), 0) / realVids.length
      : null;

    const now = Date.now();
    const dayVids   = videos.filter(v => new Date(v.published_at).getTime() > now - 86400000);
    const weekVids  = videos.filter(v => new Date(v.published_at).getTime() > now - 7  * 86400000);
    const monthVids = videos.filter(v => new Date(v.published_at).getTime() > now - 30 * 86400000);

    const mostEngaged = [...videos].sort((a, b) =>
      ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0))
    )[0];

    const health = avgScore >= 60 ? "🟢 Excellent"
                 : avgScore >= 40 ? "🟡 Good"
                 : avgScore >= 25 ? "🟠 Needs Work"
                 : "🔴 Critical";

    // 🥇 TOP PERFORMER
    if (top && top.views >= 100) {
      events.push({
        type: "top_performer", videoId: top.youtube_id,
        title: shortTitle(top.title, 60), emoji: "🥇", priority: 11,
        message: `Top performing video by AI score`,
        severity: "success",
        data: {
          Video: shortTitle(top.title, 50),
          Score: (top.score || 0) + "/100",
          Views: fmt(top.views), Likes: top.likes, Comments: top.comments,
          "Engagement": engRate(top.likes, top.comments, top.views).toFixed(2) + "%",
        },
      });
    }

    // 🔴 WORST PERFORMER (only if real gap exists)
    if (worst && (worst.score || 0) < (top?.score || 100) - 30 && worst.views >= 50 && worst.youtube_id !== top?.youtube_id) {
      events.push({
        type: "worst_performer", videoId: worst.youtube_id,
        title: shortTitle(worst.title, 60), emoji: "🔴", priority: 12,
        message: `Lowest scoring active video — consider refreshing title/thumbnail`,
        severity: "warning",
        data: {
          Video: shortTitle(worst.title, 50),
          Score: (worst.score || 0) + "/100",
          Views: fmt(worst.views),
          "Gap from Top": fmt((top?.views || 0) - worst.views),
        },
      });
    }

    // 📊 DAILY SUMMARY (always fires, channel-wide)
    const summaryData: Record<string, string | number> = {
      "Total Videos":   videos.length,
      "Active Videos":  activeVideos.length,
      "Total Views":    fmt(totalViews),
      "Total Likes":    fmt(totalLikes),
      "Total Comments": fmt(totalComments),
      "Total Shares":   fmt(totalShares),
      "Avg Engagement": avgEng.toFixed(2) + "%",
      "Avg AI Score":   avgScore.toFixed(0) + "/100",
      "Channel Health": health,
      "Uploads (24h)":  dayVids.length,
      "Uploads (7d)":   weekVids.length,
      "Uploads (30d)":  monthVids.length,
    };
    if (avgRetention !== null) summaryData["Avg Retention"] = avgRetention.toFixed(1) + "%";
    if (totalWatchMin > 0)     summaryData["Watch Hours"]   = fmt(Math.round(totalWatchMin / 60));
    if (totalSubsGained > 0)   summaryData["Subs Gained"]   = fmt(totalSubsGained);
    if (mostEngaged)           summaryData["Most Engaged"]  = shortTitle(mostEngaged.title, 40);

    events.push({
      type: "daily_summary", videoId: "channel",
      title: "Channel Daily Summary", emoji: "📊", priority: 15,
      message: "Full channel snapshot",
      severity: "info",
      data: summaryData,
    });

    // 📅 UPLOAD GAP WARNING (14+ days)
    const newest = videos.reduce((a: any, v: any) =>
      new Date(v.published_at) > new Date(a.published_at) ? v : a
    );
    const gapDays = ageDays(newest.published_at);
    if (gapDays > 14) {
      events.push({
        type: "upload_gap", videoId: "channel",
        title: "Upload Gap Warning", emoji: "📅", priority: 13,
        message: `No upload in ${Math.floor(gapDays)} days — algorithm is cooling down`,
        severity: "warning",
        data: {
          "Days Since Upload": Math.floor(gapDays).toString(),
          "Last Video": shortTitle(newest.title, 45),
          "Last Upload": new Date(newest.published_at).toLocaleDateString("en-US"),
        },
      });
    }

    // 🔥 UPLOAD STREAK CELEBRATION (uploaded 7+ days in a row)
    const last7 = weekVids.length;
    if (last7 >= 7) {
      events.push({
        type: "upload_streak", videoId: "channel",
        title: "Upload Streak!", emoji: "🔥", priority: 6,
        message: `${last7} uploads this week — algorithm will reward consistency!`,
        severity: "success",
        data: { "Uploads This Week": last7, "Keep Going": "Stay consistent!" },
      });
    }

    // 📉 CHANNEL ENGAGEMENT DROP (avg ER < 0.3%)
    if (avgEng < 0.3 && totalViews > 1000) {
      events.push({
        type: "channel_engagement_drop", videoId: "channel",
        title: "Channel Engagement Low", emoji: "📉", priority: 10,
        message: `Channel avg engagement ${avgEng.toFixed(2)}% — below healthy threshold`,
        severity: "critical",
        data: {
          "Avg Engagement": avgEng.toFixed(2) + "%",
          "Total Views": fmt(totalViews),
          "Recommended": "Add CTAs to top 5 videos",
        },
      });
    }

    // ⚠️ CONSISTENCY WARNING (uploaded <2 videos this month)
    if (monthVids.length < 2 && gapDays > 7) {
      events.push({
        type: "consistency_warning", videoId: "channel",
        title: "Low Upload Frequency", emoji: "⚠️", priority: 13,
        message: `Only ${monthVids.length} upload(s) this month — consistency is key for growth`,
        severity: "warning",
        data: {
          "Uploads This Month": monthVids.length,
          "Days Since Last": Math.floor(gapDays).toString(),
          "Recommended": "Upload at least 4x per month",
        },
      });
    }
  }

  // ── CHANNEL SUBSCRIBER MILESTONE ──
  if (channel?.subscribers) {
    const m = milestoneHit(channel.subscribers, Math.max(0, channel.subscribers - 50), SUB_MILESTONES);
    if (m) {
      events.push({
        type: "sub_milestone", videoId: "channel",
        title: "Subscriber Milestone!", emoji: "🎉", priority: 3,
        message: `${fmt(m)} subscribers reached! Incredible milestone! 🎊`,
        severity: "success",
        data: {
          Milestone: fmt(m) + " subscribers",
          "Current Subs": fmt(channel.subscribers),
        },
      });
    }

    // 👥 SUBSCRIBER RATE WARNING (if channel growing <1%/month estimated)
    if (channel.subscribers < 1100 && channel.subscribers >= 900) {
      events.push({
        type: "approaching_1k", videoId: "channel",
        title: "Almost 1K Subscribers!", emoji: "🎯", priority: 4,
        message: `${fmt(channel.subscribers)} subscribers — ${1000 - channel.subscribers} to go for 1K!`,
        severity: "info",
        data: {
          Current: fmt(channel.subscribers),
          "To Go": fmt(1000 - channel.subscribers),
          "Action": "Post subscriber-focused content",
        },
      });
    }
  }

  // ── FIRST SYNC ──
  if (!hasPrev) {
    events.push({
      type: "first_sync", videoId: "system",
      title: "Baseline Saved", emoji: "✅", priority: 99,
      message: "Snapshot saved — next sync will detect real changes",
      severity: "info",
      data: {
        "Videos Tracked": videos.length,
        "Active Videos": activeVideos.length,
        "Next Check": "In 6 hours",
      },
    });
  }

  // ════════════════════════════════════════
  // DEDUPLICATE + SORT + CAP
  // ════════════════════════════════════════
  const seen = new Set<string>();
  const unique: NotificationEvent[] = [];
  for (const e of events) {
    const key = e.type + ":" + e.videoId;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(e);
    }
  }

  unique.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

  // Final cap: max 15 realtime alerts
  return unique.slice(0, 15);
}

// ════════════════════════════════════════════════════════════════
// DIGEST GENERATORS
// ════════════════════════════════════════════════════════════════

// ── DAILY DIGEST ────────────────────────────────────────────────
export function generateDailyDigest(channel: any, videos: any[]) {
  const now    = Date.now();
  const dayAgo = now - 86400000;

  const todayUploads = videos.filter(v => new Date(v.published_at).getTime() > dayAgo);
  const allActive    = videos.filter(v => (v.views || 0) > 0);

  const byViews      = [...allActive].sort((a, b) => b.views - a.views);
  const byVelocity   = [...allActive].sort((a, b) => {
    const vpda = b.views / Math.max(1, ageDays(b.published_at));
    const vpdb = a.views / Math.max(1, ageDays(a.published_at));
    return vpda - vpdb;
  });

  const totalViews    = videos.reduce((s, v) => s + (v.views    || 0), 0);
  const totalLikes    = videos.reduce((s, v) => s + (v.likes    || 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
  const avgEng        = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

  const needsHelp = allActive.filter(v => {
    const age = ageDays(v.published_at);
    const er  = engRate(v.likes, v.comments, v.views);
    return age <= 14 && v.views >= 50 && er < 1.0;
  }).sort((a, b) => engRate(a.likes, a.comments, a.views) - engRate(b.likes, b.comments, b.views))[0];

  const top         = byViews[0];
  const fastest     = byVelocity[0];
  const dayOfWeek   = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const data: Record<string, string | number> = {
    "📅 Date": new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    "👥 Subscribers": fmt(channel?.subscribers || 0),
    "👁️ Total Views": fmt(totalViews),
    "👍 Total Likes": fmt(totalLikes),
    "💬 Total Comments": fmt(totalComments),
    "📊 Avg Engagement": avgEng.toFixed(2) + "%",
    "📹 Total Videos": videos.length,
    "🆕 Uploaded Today": todayUploads.length,
  };

  if (top) {
    data["🥇 Top Video"]    = shortTitle(top.title, 45);
    data["🥇 Top Views"]   = fmt(top.views);
    data["🥇 Top Likes"]   = top.likes;
  }

  if (fastest && fastest.youtube_id !== top?.youtube_id) {
    const vpd = fastest.views / Math.max(1, ageDays(fastest.published_at));
    data["🚀 Fastest Growing"] = shortTitle(fastest.title, 40);
    data["🚀 Views/Day"]       = Math.round(vpd).toString();
  }

  if (needsHelp) {
    data["⚠️ Needs Attention"] = shortTitle(needsHelp.title, 40);
    data["⚠️ Engagement"]      = engRate(needsHelp.likes, needsHelp.comments, needsHelp.views).toFixed(2) + "%";
  }

  const gapDays = ageDays(
    videos.reduce((a: any, v: any) =>
      new Date(v.published_at) > new Date(a.published_at) ? v : a
    ).published_at
  );
  data["📅 Days Since Upload"] = Math.floor(gapDays).toString();

  return {
    title: `📊 Daily Digest — ${dayOfWeek}`,
    message: "Your channel snapshot for today",
    data,
  };
}

// ── WEEKLY DIGEST ───────────────────────────────────────────────
export function generateWeeklyDigest(channel: any, videos: any[]) {
  const now     = Date.now();
  const weekAgo = now - 7 * 86400000;

  const weekUploads   = videos.filter(v => new Date(v.published_at).getTime() > weekAgo);
  const allActive     = videos.filter(v => (v.views || 0) > 0);

  const totalViews    = videos.reduce((s, v) => s + (v.views    || 0), 0);
  const totalLikes    = videos.reduce((s, v) => s + (v.likes    || 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
  const totalShares   = videos.reduce((s, v) => s + ((v.analytics?.shares || v.shares) || 0), 0);
  const totalWatch    = videos.reduce((s, v) => s + ((v.analytics?.watch_time_minutes) || 0), 0);
  const avgEng        = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
  const avgScore      = allActive.reduce((s, v) => s + (v.score || 0), 0) / Math.max(1, allActive.length);

  const topWeek       = [...weekUploads].sort((a, b) => b.views - a.views).slice(0, 3);
  const mostLiked     = [...videos].sort((a, b) => b.likes - a.likes)[0];
  const mostCommented = [...videos].sort((a, b) => b.comments - a.comments)[0];
  const mostShared    = [...videos].sort((a, b) =>
    ((b.analytics?.shares || b.shares) || 0) - ((a.analytics?.shares || a.shares) || 0)
  )[0];

  const deadCount     = videos.filter(v => ageDays(v.published_at) >= 30 && v.views / Math.max(1, ageDays(v.published_at)) < 1).length;
  const lowEngCount   = allActive.filter(v => engRate(v.likes, v.comments, v.views) < 0.5 && v.views >= 200).length;

  const realVids      = videos.filter(v => v.has_real_analytics && v.analytics?.avg_view_percentage != null);
  const avgRetention  = realVids.length > 0
    ? realVids.reduce((s, v) => s + (v.analytics?.avg_view_percentage || 0), 0) / realVids.length
    : null;

  const health = avgScore >= 60 ? "🟢 Excellent" : avgScore >= 40 ? "🟡 Good" : avgScore >= 25 ? "🟠 Needs Work" : "🔴 Critical";

  const data: Record<string, string | number> = {
    "📅 Period": new Date(weekAgo).toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " → " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    "👥 Subscribers": fmt(channel?.subscribers || 0),
    "👁️ Total Views": fmt(totalViews),
    "👍 Total Likes": fmt(totalLikes),
    "💬 Total Comments": fmt(totalComments),
    "🔗 Total Shares": fmt(totalShares),
    "📊 Avg Engagement": avgEng.toFixed(2) + "%",
    "⭐ Avg AI Score": avgScore.toFixed(0) + "/100",
    "🏥 Channel Health": health,
    "🆕 Uploads This Week": weekUploads.length,
    "🪦 Dead Videos": deadCount,
    "❌ Low Engagement Videos": lowEngCount,
  };

  if (avgRetention !== null) data["⏱️ Avg Retention"] = avgRetention.toFixed(1) + "%";
  if (totalWatch > 0)        data["⌚ Watch Hours"]    = fmt(Math.round(totalWatch / 60));

  topWeek.forEach((v, i) => {
    data[`🏆 Top ${i + 1} This Week`] = shortTitle(v.title, 38) + ` (${fmt(v.views)} views)`;
  });

  if (weekUploads.length === 0) {
    data["⚠️ No Uploads"] = "Consider uploading this week for algorithm visibility";
  }

  if (mostLiked)     data["👍 Most Liked"]     = shortTitle(mostLiked.title, 38) + ` (${fmt(mostLiked.likes)} likes)`;
  if (mostCommented) data["💬 Most Discussed"] = shortTitle(mostCommented.title, 38) + ` (${fmt(mostCommented.comments)} comments)`;
  if (mostShared && (mostShared.analytics?.shares || mostShared.shares)) {
    data["🔗 Most Shared"] = shortTitle(mostShared.title, 38) + ` (${mostShared.analytics?.shares || mostShared.shares || 0} shares)`;
  }

  // Recommendation
  let rec = "";
  if (weekUploads.length === 0)      rec = "Upload at least 1 video to stay visible";
  else if (avgEng < 0.5)             rec = "Add CTAs to boost engagement across videos";
  else if (deadCount > 10)           rec = "Refresh thumbnails on dead videos to revive them";
  else if (avgRetention && avgRetention < 20) rec = "Work on stronger hooks in first 15 seconds";
  else                               rec = "Keep uploading consistently — momentum is building!";
  data["💡 Top Recommendation"] = rec;

  return {
    title: `📅 Weekly Report — Eagle 3D Streaming`,
    message: "This week in review",
    data,
  };
}

// ── MONTHLY DIGEST ──────────────────────────────────────────────
export function generateMonthlyDigest(channel: any, videos: any[]) {
  const now      = Date.now();
  const monthAgo = now - 30 * 86400000;

  const monthVids     = videos.filter(v => new Date(v.published_at).getTime() > monthAgo);
  const allActive     = videos.filter(v => (v.views || 0) > 0);

  const totalViews    = videos.reduce((s, v) => s + (v.views    || 0), 0);
  const totalLikes    = videos.reduce((s, v) => s + (v.likes    || 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
  const totalShares   = videos.reduce((s, v) => s + ((v.analytics?.shares || v.shares) || 0), 0);
  const totalWatch    = videos.reduce((s, v) => s + ((v.analytics?.watch_time_minutes) || 0), 0);
  const totalSubsG    = videos.reduce((s, v) => s + ((v.analytics?.subscribers_gained) || 0), 0);

  const monthViews    = monthVids.reduce((s, v) => s + (v.views    || 0), 0);
  const monthLikes    = monthVids.reduce((s, v) => s + (v.likes    || 0), 0);
  const monthComments = monthVids.reduce((s, v) => s + (v.comments || 0), 0);

  const avgEng        = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
  const monthEng      = monthViews > 0 ? ((monthLikes + monthComments) / monthViews) * 100 : 0;
  const avgScore      = allActive.reduce((s, v) => s + (v.score || 0), 0) / Math.max(1, allActive.length);

  const topMonth      = [...monthVids].sort((a, b) => b.views - a.views).slice(0, 5);
  const topAllTime    = [...videos].sort((a, b) => b.views - a.views).slice(0, 3);
  const worstVids     = [...allActive]
    .filter(v => ageDays(v.published_at) > 30)
    .sort((a, b) => engRate(a.likes, a.comments, a.views) - engRate(b.likes, b.comments, b.views))
    .slice(0, 3);

  const deadVids      = videos.filter(v => ageDays(v.published_at) >= 30 && v.views / Math.max(1, ageDays(v.published_at)) < 1);
  const hiddenGems    = videos.filter(v => {
    const ret = v.analytics?.avg_view_percentage;
    return v.has_real_analytics && ret >= 50 && v.views < 500 && ageDays(v.published_at) > 7;
  });

  const realVids      = videos.filter(v => v.has_real_analytics && v.analytics?.avg_view_percentage != null);
  const avgRetention  = realVids.length > 0
    ? realVids.reduce((s, v) => s + (v.analytics?.avg_view_percentage || 0), 0) / realVids.length
    : null;

  const health = avgScore >= 60 ? "🟢 Excellent" : avgScore >= 40 ? "🟡 Good" : avgScore >= 25 ? "🟠 Needs Work" : "🔴 Critical";

  // Estimated revenue (rough: $1–4 RPM for tech/B2B)
  const estRevLow  = Math.round((totalWatch / 60) * 1.0);  // $1 RPM
  const estRevHigh = Math.round((totalWatch / 60) * 4.0);  // $4 RPM

  const data: Record<string, string | number> = {
    "📅 Period": new Date(monthAgo).toLocaleDateString("en-US", { month: "long", day: "numeric" }) +
      " → " + new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),

    // Channel overview
    "👥 Subscribers":          fmt(channel?.subscribers || 0),
    "📹 Total Videos":          videos.length,
    "👁️ Channel Total Views":   fmt(totalViews),
    "👍 Channel Total Likes":   fmt(totalLikes),
    "💬 Channel Total Comments":fmt(totalComments),
    "🔗 Channel Total Shares":  fmt(totalShares),
    "📊 Channel Avg Engagement":avgEng.toFixed(2) + "%",
    "⭐ Channel Avg AI Score":  avgScore.toFixed(0) + "/100",
    "🏥 Channel Health":        health,

    // This month
    "🆕 Uploads This Month":   monthVids.length,
    "👁️ Views This Month":     fmt(monthViews),
    "👍 Likes This Month":     fmt(monthLikes),
    "📊 Month Engagement":     monthEng.toFixed(2) + "%",

    // Watch time
    "⌚ Total Watch Hours":    fmt(Math.round(totalWatch / 60)),
  };

  if (avgRetention !== null) data["⏱️ Avg Retention"]     = avgRetention.toFixed(1) + "%";
  if (totalSubsG > 0)        data["👥 Subs Gained (Est)"] = fmt(totalSubsG);
  if (totalWatch > 0)        data["💰 Est. Revenue"]      = `$${estRevLow}–$${estRevHigh}`;

  // Top videos this month
  topMonth.forEach((v, i) => {
    data[`🏆 Top ${i + 1} Month`] = shortTitle(v.title, 35) + ` (${fmt(v.views)})`;
  });

  // All-time top
  topAllTime.forEach((v, i) => {
    data[`⭐ All-Time #${i + 1}`] = shortTitle(v.title, 35) + ` (${fmt(v.views)})`;
  });

  // Problems
  data["🪦 Dead Videos"]         = deadVids.length + " videos (<1 view/day)";
  data["💎 Hidden Gems"]         = hiddenGems.length + " videos (high retention, low views)";
  data["❌ Low Engagement Vids"] = allActive.filter(v => engRate(v.likes, v.comments, v.views) < 0.5 && v.views >= 200).length.toString();

  // Worst engagement
  if (worstVids.length > 0) {
    worstVids.forEach((v, i) => {
      data[`⚠️ Needs Work ${i + 1}`] = shortTitle(v.title, 35) + ` (${engRate(v.likes, v.comments, v.views).toFixed(2)}% ER)`;
    });
  }

  // Recommendations
  const recs: string[] = [];
  if (monthVids.length < 4)              recs.push("Upload more consistently — aim 4+ videos/month");
  if (avgEng < 0.5)                       recs.push("Add stronger CTAs — engagement is below target");
  if (deadVids.length > 5)               recs.push("Refresh thumbnails on " + deadVids.length + " dead videos");
  if (hiddenGems.length > 0)             recs.push("Promote " + hiddenGems.length + " hidden gems with community posts");
  if (avgRetention && avgRetention < 20) recs.push("Improve first 30s hooks — avg retention is low");
  if (recs.length === 0)                 recs.push("Great month! Keep the consistency going.");

  recs.forEach((r, i) => {
    data[`💡 Action ${i + 1}`] = r;
  });

  return {
    title: `🗓️ Monthly Report — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
    message: "Full month performance for Eagle 3D Streaming",
    data,
  };
}
