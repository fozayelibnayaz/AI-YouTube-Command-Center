// smart-notifications.ts v4.0 — Professional YouTube Alert Engine
// Eagle 3D Streaming — 25 alert types, zero spam

let memorySnapshot: Record<string, VideoSnapshot> = {};

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

// ─── SUPABASE ────────────────────────────────────────────────
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
      subscribers_gained: a.subscribers_gained || 0,
      published_at: v.published_at || "",
      captured_at: now,
    };
  }
  memorySnapshot = snapshot;
  const sb = getSupabase();
  if (sb) {
    try { await sb.from("snapshots").upsert({ id: "latest", snapshot, updated_at: now }); } catch {}
  }
}

// ─── HELPERS ─────────────────────────────────────────────────
function ageDays(publishedAt: string): number {
  if (!publishedAt) return 999;
  return Math.max(0.001, (Date.now() - new Date(publishedAt).getTime()) / 86400000);
}

function pct(now: number, prev: number): number {
  if (prev === 0) return now > 0 ? 100 : 0;
  return ((now - prev) / prev) * 100;
}

function engRate(likes: number, comments: number, views: number): number {
  if (views === 0) return 0;
  return ((likes + comments) / views) * 100;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function st(t: string, len = 50): string {
  return (t || "Untitled").substring(0, len);
}

function isNew(publishedAt: string): boolean {
  return ageDays(publishedAt) <= 2;
}

function milestoneHit(value: number, prev: number, milestones: number[]): number | null {
  for (const m of milestones) {
    if (value >= m && prev < m) return m;
  }
  return null;
}

const VIEW_MS  = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
const SUB_MS   = [100, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 500000, 1000000];
const WATCH_MS = [100, 500, 1000, 5000, 10000, 50000, 100000];

// RETENTION GUARD — filters API artifacts
// YouTube returns 0 or garbage <1% for videos with no Analytics OAuth
// Real humans NEVER leave in <1% — that is a pure API artifact
function isRealRetention(r: number | null | undefined, views: number, hasReal: boolean): boolean {
  if (!hasReal) return false;
  if (r == null || r === 0) return false;
  if (r < 1.5) return false;   // API artifact threshold
  if (views < 100) return false;
  return true;
}

// ─── PER-TYPE CAPS (anti-spam) ───────────────────────────────
const MAX_PER_TYPE: Record<string, number> = {
  critical_retention:    3,
  critical_engagement:   3,
  dead_video:            3,
  excellent_retention:   0,   // PERMANENTLY DISABLED
  rising:                4,
  views_dropped:         3,
  likes_spike:           3,
  comments_spike:        3,
  shares_spike:          3,
  watch_time_milestone:  2,
  new_video:             5,
  strong_launch:         3,
  hidden_gem:            3,
  high_ctr_low_views:    3,
  low_ctr_warning:       3,
  re_engagement:         2,
  momentum_loss:         3,
  consistency_warning:   1,
  channel_engagement_drop: 1,
  upload_streak:         1,
};

// ─── MAIN detectEvents ───────────────────────────────────────
export function detectEvents(
  videos: any[],
  prev: Record<string, VideoSnapshot>,
  channel?: any
): NotificationEvent[] {

  const events: NotificationEvent[] = [];
  const typeCounts: Record<string, number> = {};
  const hasPrev = Object.keys(prev).length > 0;
  const activeVideos = videos.filter(v => (v.views || 0) > 0);

  function add(e: NotificationEvent) {
    const max = MAX_PER_TYPE[e.type];
    if (max === 0) return;
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
    const title = st(v.title, 60);
    const p     = prev[id];

    const views    = v.views    || 0;
    const likes    = v.likes    || 0;
    const comments = v.comments || 0;
    const a        = v.analytics || {};
    const shares   = a.shares || v.shares || 0;
    const ctr      = a.ctr ?? null;
    const retention= a.avg_view_percentage ?? null;
    const watchMin = a.watch_time_minutes ?? null;
    const subsG    = a.subscribers_gained || 0;
    const hasReal  = v.has_real_analytics === true;
    const er       = engRate(likes, comments, views);
    const age      = ageDays(v.published_at);
    const vpd      = views / age;

    // ── NEW VIDEO <48h ───────────────────────────────────────
    if (isNew(v.published_at)) {
      add({
        type: "new_video", videoId: id, title, emoji: "🆕", priority: 4,
        message: "New video live — push in first 24h for algorithm boost",
        severity: "info",
        data: {
          Video: title,
          "Hours Live": Math.floor(age * 24) + "h",
          Views: views, Likes: likes, Comments: comments,
          Posted: new Date(v.published_at).toLocaleDateString("en-US"),
        },
      });
      continue;
    }

    if (views === 0) continue;

    // ── SNAPSHOT-BASED ALERTS ────────────────────────────────
    if (p && hasPrev) {
      const vDelta = views    - (p.views    || 0);
      const lDelta = likes    - (p.likes    || 0);
      const cDelta = comments - (p.comments || 0);
      const sDelta = shares   - (p.shares   || 0);
      const subDelta = subsG  - (p.subscribers_gained || 0);
      const vPct = pct(views,    p.views    || 0);
      const lPct = pct(likes,    p.likes    || 0);
      const cPct = pct(comments, p.comments || 0);

      // 🔥 VIRAL EXPLOSION
      if (vPct >= 200 && vDelta >= 1000) {
        add({
          type: "viral_explosion", videoId: id, title, emoji: "🔥", priority: 1,
          message: "VIRAL EXPLOSION! +" + fmt(vDelta) + " views (" + vPct.toFixed(0) + "% surge) — promote NOW",
          severity: "critical",
          data: { Video: title, "New Views": "+" + fmt(vDelta), "Growth": "+" + vPct.toFixed(0) + "%", "Total Views": fmt(views) },
        });
      }
      // 🚀 VIRAL
      else if (vPct >= 100 && vDelta >= 500) {
        add({
          type: "viral", videoId: id, title, emoji: "🚀", priority: 2,
          message: "Going viral! +" + fmt(vDelta) + " views (" + vPct.toFixed(0) + "% growth) — pin a comment",
          severity: "critical",
          data: { Video: title, "New Views": "+" + fmt(vDelta), "Growth": "+" + vPct.toFixed(0) + "%", "Total Views": fmt(views) },
        });
      }
      // 📈 RISING
      else if (vPct >= 30 && vDelta >= 50) {
        add({
          type: "rising", videoId: id, title, emoji: "📈", priority: 7,
          message: "Rising! +" + fmt(vDelta) + " views (" + vPct.toFixed(0) + "% growth)",
          severity: "success",
          data: { Video: title, "New Views": "+" + fmt(vDelta), "Growth": "+" + vPct.toFixed(0) + "%", "Total Views": fmt(views) },
        });
      }

      // 📉 VIEW DROP
      if (vDelta < 0 && Math.abs(vDelta) >= 100 && Math.abs(vPct) >= 40) {
        add({
          type: "views_dropped", videoId: id, title, emoji: "📉", priority: 3,
          message: "Views dropped " + Math.abs(vPct).toFixed(0) + "% — lost " + fmt(Math.abs(vDelta)) + " views",
          severity: "warning",
          data: { Video: title, "Views Lost": fmt(Math.abs(vDelta)), "Drop": "-" + Math.abs(vPct).toFixed(0) + "%", "Current": fmt(views) },
        });
      }

      // 👍 LIKES SPIKE
      if (lDelta >= 10 && lPct >= 50) {
        add({
          type: "likes_spike", videoId: id, title, emoji: "👍", priority: 6,
          message: "Likes spiking! +" + lDelta + " likes (" + lPct.toFixed(0) + "% increase)",
          severity: "success",
          data: { Video: title, "New Likes": "+" + lDelta, "Growth": "+" + lPct.toFixed(0) + "%", "Total Likes": fmt(likes) },
        });
      }

      // 💬 COMMENTS SPIKE
      if (cDelta >= 3 && cPct >= 50) {
        add({
          type: "comments_spike", videoId: id, title, emoji: "💬", priority: 5,
          message: "Comments spiking! +" + cDelta + " — reply fast for algo boost",
          severity: "info",
          data: { Video: title, "New Comments": "+" + cDelta, "Growth": "+" + cPct.toFixed(0) + "%", "Total": fmt(comments) },
        });
      }

      // 🔗 SHARES SPIKE
      if (sDelta >= 5) {
        add({
          type: "shares_spike", videoId: id, title, emoji: "🔗", priority: 5,
          message: "+" + sDelta + " new shares — content spreading organically!",
          severity: "success",
          data: { Video: title, "New Shares": "+" + sDelta, "Total Shares": fmt(shares) },
        });
      }

      // 👥 SUBSCRIBER SPIKE FROM VIDEO
      if (subDelta >= 10) {
        add({
          type: "subscriber_gained", videoId: id, title, emoji: "👥", priority: 4,
          message: "+" + subDelta + " subscribers from this video — it is a growth driver!",
          severity: "success",
          data: { Video: title, "New Subs": "+" + subDelta, "Total Gained": fmt(subsG) },
        });
      }

      // 🏆 VIEW MILESTONE
      const vm = milestoneHit(views, p.views || 0, VIEW_MS);
      if (vm) {
        add({
          type: "milestone", videoId: id, title, emoji: "🏆", priority: 2,
          message: "Crossed " + fmt(vm) + " views milestone!",
          severity: "success",
          data: { Video: title, Milestone: fmt(vm) + " views", "Total Views": fmt(views) },
        });
      }

      // ⌚ WATCH TIME MILESTONE
      if (watchMin && watchMin > 0) {
        const wh = watchMin / 60;
        const pwh = (p.watch_time_minutes || 0) / 60;
        const wm = milestoneHit(wh, pwh, WATCH_MS);
        if (wm) {
          add({
            type: "watch_time_milestone", videoId: id, title, emoji: "⌚", priority: 5,
            message: fmt(wm) + " watch hours milestone reached!",
            severity: "success",
            data: { Video: title, "Watch Hours": fmt(wm) },
          });
        }
      }

      // 📉 MOMENTUM LOSS
      if (vPct < -10 && vDelta < -20 && age > 7 && age < 60) {
        add({
          type: "momentum_loss", videoId: id, title, emoji: "📉", priority: 8,
          message: "Momentum slowing: " + vPct.toFixed(0) + "% view change — consider promoting",
          severity: "warning",
          data: { Video: title, "View Change": vPct.toFixed(0) + "%", "Days Old": Math.floor(age).toString() },
        });
      }

      // 🔄 RE-ENGAGEMENT (old video 60+ days surging again)
      if (age >= 60 && vDelta >= 200 && vPct >= 20) {
        add({
          type: "re_engagement", videoId: id, title, emoji: "🔄", priority: 6,
          message: "Old video resurging! +" + fmt(vDelta) + " views on a " + Math.floor(age) + "-day-old video",
          severity: "success",
          data: { Video: title, "New Views": "+" + fmt(vDelta), "Video Age": Math.floor(age) + " days", "Total": fmt(views) },
        });
      }
    }

    // ── NON-SNAPSHOT ALERTS ──────────────────────────────────

    // 🎉 STRONG LAUNCH
    if (age > 1 && age <= 7 && vpd >= 100) {
      add({
        type: "strong_launch", videoId: id, title, emoji: "🎉", priority: 3,
        message: "Strong launch! " + Math.round(vpd) + " views/day in first " + Math.floor(age) + " days",
        severity: "success",
        data: { Video: title, "Views/Day": Math.round(vpd).toString(), "Days Live": Math.floor(age).toString(), "Total": fmt(views) },
      });
    }

    // ⏱️ CRITICAL RETENTION — REAL DATA ONLY, pct > 1.5%, 100+ views
    if (isRealRetention(retention, views, hasReal) && (retention as number) < 15) {
      add({
        type: "critical_retention", videoId: id, title, emoji: "⏱️", priority: 9,
        message: "Critical retention: " + (retention as number).toFixed(1) + "% — viewers leaving immediately",
        severity: "critical",
        data: { Video: title, Retention: (retention as number).toFixed(1) + "%", "Skipped": (100 - (retention as number)).toFixed(1) + "%", Views: fmt(views) },
      });
    }

    // ❌ CRITICAL ENGAGEMENT
    if (er < 0.5 && er > 0 && views >= 500) {
      add({
        type: "critical_engagement", videoId: id, title, emoji: "❌", priority: 10,
        message: "Critical engagement: " + er.toFixed(2) + "% — add CTA or refresh thumbnail",
        severity: "critical",
        data: { Video: title, "Engagement Rate": er.toFixed(2) + "%", Likes: likes, Comments: comments, Views: fmt(views) },
      });
    }

    // 🪦 DEAD VIDEO
    if (age >= 30 && vpd < 1 && views > 0) {
      add({
        type: "dead_video", videoId: id, title, emoji: "🪦", priority: 14,
        message: "Dead video: " + vpd.toFixed(2) + " views/day after " + Math.floor(age) + " days",
        severity: "warning",
        data: { Video: title, "Views/Day": vpd.toFixed(2), Age: Math.floor(age) + " days", Views: fmt(views) },
      });
    }

    // 💎 HIDDEN GEM — high retention, low views
    if (isRealRetention(retention, views, hasReal) && (retention as number) >= 50 && views < 500 && age > 7) {
      add({
        type: "hidden_gem", videoId: id, title, emoji: "💎", priority: 8,
        message: (retention as number).toFixed(0) + "% retention but only " + fmt(views) + " views — promote this!",
        severity: "info",
        data: { Video: title, Retention: (retention as number).toFixed(1) + "%", Views: fmt(views), Action: "Boost with community post" },
      });
    }

    // 🎯 HIGH CTR LOW VIEWS
    if (ctr !== null && ctr >= 8 && views < 300 && age > 3) {
      add({
        type: "high_ctr_low_views", videoId: id, title, emoji: "🎯", priority: 8,
        message: "High CTR (" + ctr.toFixed(1) + "%) but only " + fmt(views) + " views — share externally",
        severity: "info",
        data: { Video: title, CTR: ctr.toFixed(1) + "%", Views: fmt(views), Action: "Share to trigger algorithm" },
      });
    }

    // 📊 LOW CTR WARNING
    if (ctr !== null && ctr < 2 && views >= 200) {
      add({
        type: "low_ctr_warning", videoId: id, title, emoji: "📊", priority: 9,
        message: "Low CTR: " + ctr.toFixed(1) + "% — thumbnail or title needs A/B test",
        severity: "warning",
        data: { Video: title, CTR: ctr.toFixed(1) + "%", Views: fmt(views), Action: "Test new thumbnail" },
      });
    }
  }

  // ════════════════════════════════════════
  // CHANNEL-WIDE ALERTS
  // ════════════════════════════════════════
  if (activeVideos.length > 2) {
    const byScore = [...activeVideos].sort((a, b) => (b.score || b.views || 0) - (a.score || a.views || 0));
    const top   = byScore[0];
    const worst = byScore[byScore.length - 1];

    const totalViews    = videos.reduce((s, v) => s + (v.views    || 0), 0);
    const totalLikes    = videos.reduce((s, v) => s + (v.likes    || 0), 0);
    const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
    const totalShares   = videos.reduce((s, v) => s + ((v.analytics?.shares || v.shares) || 0), 0);
    const totalWatch    = videos.reduce((s, v) => s + ((v.analytics?.watch_time_minutes) || 0), 0);
    const totalSubsG    = videos.reduce((s, v) => s + ((v.analytics?.subscribers_gained) || 0), 0);
    const avgEng        = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
    const avgScore      = activeVideos.reduce((s, v) => s + (v.score || 0), 0) / activeVideos.length;

    const realVids     = videos.filter(v => v.has_real_analytics && v.analytics?.avg_view_percentage != null && v.analytics.avg_view_percentage > 1.5);
    const avgRetention = realVids.length > 0
      ? realVids.reduce((s, v) => s + (v.analytics.avg_view_percentage || 0), 0) / realVids.length
      : null;

    const now       = Date.now();
    const dayVids   = videos.filter(v => new Date(v.published_at).getTime() > now - 86400000);
    const weekVids  = videos.filter(v => new Date(v.published_at).getTime() > now - 7  * 86400000);
    const monthVids = videos.filter(v => new Date(v.published_at).getTime() > now - 30 * 86400000);

    const deadCount   = videos.filter(v => ageDays(v.published_at) >= 30 && (v.views / Math.max(1, ageDays(v.published_at))) < 1).length;
    const lowEngCount = activeVideos.filter(v => engRate(v.likes, v.comments, v.views) < 0.5 && v.views >= 200).length;

    const mostEngaged = [...videos].sort((a, b) =>
      ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0))
    )[0];

    const health = avgScore >= 60 ? "🟢 Excellent" : avgScore >= 40 ? "🟡 Good" : avgScore >= 25 ? "🟠 Needs Work" : "🔴 Critical";

    // 🥇 TOP PERFORMER
    if (top && top.views >= 100) {
      events.push({
        type: "top_performer", videoId: top.youtube_id,
        title: st(top.title, 60), emoji: "🥇", priority: 11,
        message: "Top performing video by AI score: " + st(top.title, 40),
        severity: "success",
        data: {
          Video: st(top.title, 50),
          Score: (top.score || 0) + "/100",
          Views: fmt(top.views), Likes: top.likes, Comments: top.comments,
          Engagement: engRate(top.likes, top.comments, top.views).toFixed(2) + "%",
        },
      });
    }

    // 🔴 WORST PERFORMER
    if (worst && (worst.score || 0) < (top?.score || 100) - 30 && worst.views >= 50 && worst.youtube_id !== top?.youtube_id) {
      events.push({
        type: "worst_performer", videoId: worst.youtube_id,
        title: st(worst.title, 60), emoji: "🔴", priority: 12,
        message: "Lowest scoring active video — refresh title and thumbnail",
        severity: "warning",
        data: {
          Video: st(worst.title, 50),
          Score: (worst.score || 0) + "/100",
          Views: fmt(worst.views),
          "Gap from Top": fmt((top?.views || 0) - worst.views),
        },
      });
    }

    // 📊 DAILY SUMMARY
    const summaryData: Record<string, string | number> = {
      "Total Videos":    videos.length,
      "Active Videos":   activeVideos.length,
      "Total Views":     fmt(totalViews),
      "Total Likes":     fmt(totalLikes),
      "Total Comments":  fmt(totalComments),
      "Total Shares":    fmt(totalShares),
      "Avg Engagement":  avgEng.toFixed(2) + "%",
      "Avg AI Score":    avgScore.toFixed(0) + "/100",
      "Channel Health":  health,
      "Uploads (24h)":   dayVids.length,
      "Uploads (7d)":    weekVids.length,
      "Uploads (30d)":   monthVids.length,
      "Dead Videos":     deadCount,
      "Low Engagement":  lowEngCount,
    };
    if (avgRetention !== null) summaryData["Avg Retention"] = avgRetention.toFixed(1) + "%";
    if (totalWatch > 0)        summaryData["Watch Hours"]   = fmt(Math.round(totalWatch / 60));
    if (totalSubsG > 0)        summaryData["Subs Gained"]   = fmt(totalSubsG);
    if (mostEngaged)           summaryData["Most Engaged"]  = st(mostEngaged.title, 40);

    events.push({
      type: "daily_summary", videoId: "channel", title: "Channel Daily Summary",
      emoji: "📊", priority: 15,
      message: "Full channel snapshot — " + new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      severity: "info",
      data: summaryData,
    });

    // 📅 UPLOAD GAP
    const newest = videos.reduce((a: any, b: any) =>
      new Date(b.published_at) > new Date(a.published_at) ? b : a
    );
    const gapDays = ageDays(newest.published_at);
    if (gapDays > 14) {
      events.push({
        type: "upload_gap", videoId: "channel", title: "Upload Gap Warning",
        emoji: "📅", priority: 13,
        message: "No upload in " + Math.floor(gapDays) + " days — algorithm is cooling down",
        severity: "warning",
        data: {
          "Days Since Upload": Math.floor(gapDays).toString(),
          "Last Video": st(newest.title, 45),
          "Last Upload": new Date(newest.published_at).toLocaleDateString("en-US"),
        },
      });
    }

    // 🔥 UPLOAD STREAK (7+ this week)
    if (weekVids.length >= 7) {
      add({
        type: "upload_streak", videoId: "channel", title: "Upload Streak",
        emoji: "🔥", priority: 6,
        message: weekVids.length + " uploads this week — algorithm will reward this!",
        severity: "success",
        data: { "Uploads This Week": weekVids.length, Status: "Keep going!" },
      });
    }

    // 📉 CHANNEL ENGAGEMENT DROP
    if (avgEng < 0.3 && totalViews > 1000) {
      add({
        type: "channel_engagement_drop", videoId: "channel", title: "Channel Engagement Low",
        emoji: "📉", priority: 10,
        message: "Channel avg engagement " + avgEng.toFixed(2) + "% — below healthy threshold of 1%",
        severity: "critical",
        data: { "Avg Engagement": avgEng.toFixed(2) + "%", "Total Views": fmt(totalViews), Action: "Add CTAs to top 5 videos" },
      });
    }

    // ⚠️ CONSISTENCY WARNING
    if (monthVids.length < 2 && gapDays > 7) {
      add({
        type: "consistency_warning", videoId: "channel", title: "Low Upload Frequency",
        emoji: "⚠️", priority: 13,
        message: "Only " + monthVids.length + " upload(s) this month — aim for 4+ per month",
        severity: "warning",
        data: { "Uploads This Month": monthVids.length, "Days Since Last": Math.floor(gapDays).toString(), Recommended: "4+ videos/month" },
      });
    }
  }

  // 🎉 SUBSCRIBER MILESTONE
  if (channel?.subscribers) {
    const m = milestoneHit(channel.subscribers, Math.max(0, channel.subscribers - 50), SUB_MS);
    if (m) {
      events.push({
        type: "sub_milestone", videoId: "channel", title: "Subscriber Milestone",
        emoji: "🎉", priority: 3,
        message: fmt(m) + " subscribers reached! Incredible milestone!",
        severity: "success",
        data: { Milestone: fmt(m) + " subscribers", Current: fmt(channel.subscribers) },
      });
    }
    // 🎯 APPROACHING 1K
    if (channel.subscribers >= 900 && channel.subscribers < 1000) {
      events.push({
        type: "approaching_1k", videoId: "channel", title: "Almost 1K Subscribers!",
        emoji: "🎯", priority: 4,
        message: fmt(channel.subscribers) + " subscribers — only " + (1000 - channel.subscribers) + " to go for 1K!",
        severity: "info",
        data: { Current: fmt(channel.subscribers), "Needed": (1000 - channel.subscribers).toString() },
      });
    }
  }

  // ✅ FIRST SYNC
  if (Object.keys(prev).length === 0) {
    events.push({
      type: "first_sync", videoId: "system", title: "Baseline Saved",
      emoji: "✅", priority: 99,
      message: "Snapshot saved — next sync will detect real changes",
      severity: "info",
      data: { "Videos Tracked": videos.length, "Active Videos": activeVideos.length, "Next Check": "In 6 hours" },
    });
  }

  // ── DEDUPLICATE ──────────────────────────────────────────────
  const seen = new Set<string>();
  const unique: NotificationEvent[] = [];
  for (const e of events) {
    const key = e.type + ":" + e.videoId;
    if (!seen.has(key)) { seen.add(key); unique.push(e); }
  }

  unique.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
  return unique.slice(0, 15);
}

// ════════════════════════════════════════════════════════════════
// DIGEST GENERATORS
// ════════════════════════════════════════════════════════════════

export function generateDailyDigest(channel: any, videos: any[]) {
  const now    = Date.now();
  const dayAgo = now - 86400000;

  const todayUploads = videos.filter(v => new Date(v.published_at).getTime() > dayAgo);
  const allActive    = videos.filter(v => (v.views || 0) > 0);
  const byViews      = [...allActive].sort((a, b) => b.views - a.views);
  const byVelocity   = [...allActive].sort((a, b) => {
    return (b.views / Math.max(1, ageDays(b.published_at))) - (a.views / Math.max(1, ageDays(a.published_at)));
  });

  const totalViews    = videos.reduce((s, v) => s + (v.views    || 0), 0);
  const totalLikes    = videos.reduce((s, v) => s + (v.likes    || 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
  const totalShares   = videos.reduce((s, v) => s + ((v.analytics?.shares || v.shares) || 0), 0);
  const avgEng        = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
  const avgScore      = allActive.reduce((s, v) => s + (v.score || 0), 0) / Math.max(1, allActive.length);

  const deadCount   = videos.filter(v => ageDays(v.published_at) >= 30 && (v.views / Math.max(1, ageDays(v.published_at))) < 1).length;
  const lowEngCount = allActive.filter(v => engRate(v.likes, v.comments, v.views) < 0.5 && v.views >= 200).length;

  const needsHelp = allActive.filter(v => {
    return ageDays(v.published_at) <= 14 && v.views >= 50 && engRate(v.likes, v.comments, v.views) < 1.0;
  }).sort((a, b) => engRate(a.likes, a.comments, a.views) - engRate(b.likes, b.comments, b.views))[0];

  const top     = byViews[0];
  const fastest = byVelocity[0];

  const newest  = videos.reduce((a: any, b: any) => new Date(b.published_at) > new Date(a.published_at) ? b : a);
  const gapDays = ageDays(newest.published_at);

  const health = avgScore >= 60 ? "🟢 Excellent" : avgScore >= 40 ? "🟡 Good" : avgScore >= 25 ? "🟠 Needs Work" : "🔴 Critical";

  const realVids = videos.filter(v => v.has_real_analytics && v.analytics?.avg_view_percentage > 1.5);
  const avgRet   = realVids.length > 0
    ? realVids.reduce((s, v) => s + v.analytics.avg_view_percentage, 0) / realVids.length
    : null;

  const data: Record<string, string | number> = {
    "📅 Date": new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    "👥 Subscribers": fmt(channel?.subscribers || 0),
    "👁 Total Views": fmt(totalViews),
    "👍 Total Likes": fmt(totalLikes),
    "💬 Total Comments": fmt(totalComments),
    "🔗 Total Shares": fmt(totalShares),
    "�� Avg Engagement": avgEng.toFixed(2) + "%",
    "⭐ Channel Health": health,
    "📹 Total Videos": videos.length,
    "🆕 Uploaded Today": todayUploads.length,
    "🪦 Dead Videos": deadCount,
    "❌ Low Engagement": lowEngCount,
    "📅 Days Since Upload": Math.floor(gapDays).toString(),
  };

  if (avgRet !== null) data["⏱ Avg Retention"] = avgRet.toFixed(1) + "%";

  if (top) {
    data["🥇 Top Video"]  = st(top.title, 45);
    data["🥇 Top Views"]  = fmt(top.views);
    data["🥇 Top Likes"]  = top.likes;
    data["🥇 Top ER"]     = engRate(top.likes, top.comments, top.views).toFixed(2) + "%";
  }

  if (fastest && fastest.youtube_id !== top?.youtube_id) {
    const vpd = fastest.views / Math.max(1, ageDays(fastest.published_at));
    data["🚀 Fastest Growing"] = st(fastest.title, 40);
    data["🚀 Views/Day"]       = Math.round(vpd).toString();
  }

  if (needsHelp) {
    data["⚠ Needs Attention"] = st(needsHelp.title, 40);
    data["⚠ Its Engagement"]  = engRate(needsHelp.likes, needsHelp.comments, needsHelp.views).toFixed(2) + "%";
  }

  return {
    title: "📊 Daily Digest — Eagle 3D Streaming",
    message: "Channel snapshot for " + new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    data,
  };
}

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
  const deadCount     = videos.filter(v => ageDays(v.published_at) >= 30 && (v.views / Math.max(1, ageDays(v.published_at))) < 1).length;
  const lowEngCount   = allActive.filter(v => engRate(v.likes, v.comments, v.views) < 0.5 && v.views >= 200).length;

  const realVids     = videos.filter(v => v.has_real_analytics && v.analytics?.avg_view_percentage > 1.5);
  const avgRetention = realVids.length > 0
    ? realVids.reduce((s, v) => s + v.analytics.avg_view_percentage, 0) / realVids.length
    : null;

  const health = avgScore >= 60 ? "🟢 Excellent" : avgScore >= 40 ? "🟡 Good" : avgScore >= 25 ? "🟠 Needs Work" : "🔴 Critical";

  const data: Record<string, string | number> = {
    "📅 Period": new Date(weekAgo).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " to " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    "👥 Subscribers": fmt(channel?.subscribers || 0),
    "👁 Total Views": fmt(totalViews),
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

  if (avgRetention !== null) data["⏱ Avg Retention"] = avgRetention.toFixed(1) + "%";
  if (totalWatch > 0)        data["⌚ Watch Hours"]   = fmt(Math.round(totalWatch / 60));

  topWeek.forEach((v, i) => {
    data["🏆 Top " + (i + 1) + " This Week"] = st(v.title, 38) + " (" + fmt(v.views) + " views)";
  });

  if (weekUploads.length === 0) data["⚠ No Uploads"] = "Consider uploading — stay visible to algorithm";
  if (mostLiked)     data["�� Most Liked"]     = st(mostLiked.title, 38) + " (" + fmt(mostLiked.likes) + " likes)";
  if (mostCommented) data["💬 Most Discussed"] = st(mostCommented.title, 38) + " (" + fmt(mostCommented.comments) + " comments)";

  let rec = "Keep uploading consistently!";
  if (weekUploads.length === 0)     rec = "Upload at least 1 video to stay visible";
  else if (avgEng < 0.5)            rec = "Add CTAs to boost engagement";
  else if (deadCount > 10)          rec = "Refresh thumbnails on dead videos";
  else if (avgRetention && avgRetention < 20) rec = "Improve first 30s — avg retention is low";
  data["💡 Top Recommendation"] = rec;

  return {
    title: "📅 Weekly Report — Eagle 3D Streaming",
    message: "This week in review",
    data,
  };
}

export function generateMonthlyDigest(channel: any, videos: any[]) {
  const now      = Date.now();
  const monthAgo = now - 30 * 86400000;

  const monthVids  = videos.filter(v => new Date(v.published_at).getTime() > monthAgo);
  const allActive  = videos.filter(v => (v.views || 0) > 0);

  const totalViews    = videos.reduce((s, v) => s + (v.views    || 0), 0);
  const totalLikes    = videos.reduce((s, v) => s + (v.likes    || 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
  const totalShares   = videos.reduce((s, v) => s + ((v.analytics?.shares || v.shares) || 0), 0);
  const totalWatch    = videos.reduce((s, v) => s + ((v.analytics?.watch_time_minutes) || 0), 0);
  const totalSubsG    = videos.reduce((s, v) => s + ((v.analytics?.subscribers_gained) || 0), 0);

  const monthViews    = monthVids.reduce((s, v) => s + (v.views    || 0), 0);
  const monthLikes    = monthVids.reduce((s, v) => s + (v.likes    || 0), 0);
  const monthComments = monthVids.reduce((s, v) => s + (v.comments || 0), 0);

  const avgEng     = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
  const monthEng   = monthViews > 0 ? ((monthLikes + monthComments) / monthViews) * 100 : 0;
  const avgScore   = allActive.reduce((s, v) => s + (v.score || 0), 0) / Math.max(1, allActive.length);

  const topMonth   = [...monthVids].sort((a, b) => b.views - a.views).slice(0, 5);
  const topAllTime = [...videos].sort((a, b) => b.views - a.views).slice(0, 3);
  const worstVids  = [...allActive]
    .filter(v => ageDays(v.published_at) > 30)
    .sort((a, b) => engRate(a.likes, a.comments, a.views) - engRate(b.likes, b.comments, b.views))
    .slice(0, 3);

  const deadVids   = videos.filter(v => ageDays(v.published_at) >= 30 && (v.views / Math.max(1, ageDays(v.published_at))) < 1);
  const realVids   = videos.filter(v => v.has_real_analytics && v.analytics?.avg_view_percentage > 1.5);
  const hiddenGems = realVids.filter(v => v.analytics.avg_view_percentage >= 50 && v.views < 500 && ageDays(v.published_at) > 7);
  const avgRet     = realVids.length > 0
    ? realVids.reduce((s, v) => s + v.analytics.avg_view_percentage, 0) / realVids.length
    : null;

  const health = avgScore >= 60 ? "🟢 Excellent" : avgScore >= 40 ? "🟡 Good" : avgScore >= 25 ? "🟠 Needs Work" : "🔴 Critical";

  const estRevLow  = Math.round((totalWatch / 60) * 1.0);
  const estRevHigh = Math.round((totalWatch / 60) * 4.0);

  const data: Record<string, string | number> = {
    "📅 Period": new Date(monthAgo).toLocaleDateString("en-US", { month: "long", day: "numeric" }) + " to " + new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    "👥 Subscribers": fmt(channel?.subscribers || 0),
    "📹 Total Videos": videos.length,
    "👁 Channel Total Views": fmt(totalViews),
    "👍 Channel Total Likes": fmt(totalLikes),
    "💬 Channel Total Comments": fmt(totalComments),
    "🔗 Channel Total Shares": fmt(totalShares),
    "📊 Channel Avg Engagement": avgEng.toFixed(2) + "%",
    "⭐ Avg AI Score": avgScore.toFixed(0) + "/100",
    "🏥 Channel Health": health,
    "🆕 Uploads This Month": monthVids.length,
    "👁 Views This Month": fmt(monthViews),
    "📊 Month Engagement": monthEng.toFixed(2) + "%",
    "⌚ Total Watch Hours": fmt(Math.round(totalWatch / 60)),
  };

  if (avgRet !== null)  data["⏱ Avg Retention"]   = avgRet.toFixed(1) + "%";
  if (totalSubsG > 0)   data["👥 Subs Gained"]     = fmt(totalSubsG);
  if (totalWatch > 0)   data["💰 Est Revenue"]     = "$" + estRevLow + " to $" + estRevHigh;

  topMonth.forEach((v, i) => {
    data["🏆 Top " + (i + 1) + " Month"] = st(v.title, 35) + " (" + fmt(v.views) + ")";
  });

  topAllTime.forEach((v, i) => {
    data["⭐ All-Time " + (i + 1)] = st(v.title, 35) + " (" + fmt(v.views) + ")";
  });

  data["🪦 Dead Videos"]          = deadVids.length + " videos under 1 view per day";
  data["💎 Hidden Gems"]          = hiddenGems.length + " high retention low view videos";
  data["❌ Low Engagement Videos"] = allActive.filter(v => engRate(v.likes, v.comments, v.views) < 0.5 && v.views >= 200).length.toString();

  worstVids.forEach((v, i) => {
    data["⚠ Needs Work " + (i + 1)] = st(v.title, 35) + " (" + engRate(v.likes, v.comments, v.views).toFixed(2) + "% ER)";
  });

  const recs: string[] = [];
  if (monthVids.length < 4)             recs.push("Upload more — aim for 4+ per month");
  if (avgEng < 0.5)                      recs.push("Add stronger CTAs — engagement below target");
  if (deadVids.length > 5)              recs.push("Refresh thumbnails on " + deadVids.length + " dead videos");
  if (hiddenGems.length > 0)            recs.push("Promote " + hiddenGems.length + " hidden gems with community posts");
  if (avgRet && avgRet < 20)            recs.push("Improve hooks — avg retention is low");
  if (recs.length === 0)                recs.push("Great month! Keep the consistency going");

  recs.forEach((r, i) => { data["💡 Action " + (i + 1)] = r; });

  return {
    title: "🗓 Monthly Report — " + new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    message: "Full month performance for Eagle 3D Streaming",
    data,
  };
}
// deployed: 2026-05-26T08:29:06Z
