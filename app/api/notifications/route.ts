import { NextRequest, NextResponse } from "next/server";
import { getChannelVideos, getChannelInfo } from "@/lib/youtube";
import { calculatePerformanceScore } from "@/lib/utils";
import { detectEvents, loadSnapshot, saveSnapshot } from "@/lib/smart-notifications";
import { sendTelegram, sendWithButtons } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── TYPES THAT ARE ALLOWED TO SEND ──────────────────────────
const ALLOWED_TYPES = new Set([
  "viral_explosion", "viral", "rising", "views_dropped",
  "likes_spike", "comments_spike", "shares_spike", "subscriber_gained",
  "milestone", "watch_time_milestone", "sub_milestone", "approaching_1k",
  "new_video", "strong_launch",
  "critical_retention", "critical_engagement",
  "dead_video", "hidden_gem", "high_ctr_low_views", "low_ctr_warning",
  "re_engagement", "momentum_loss",
  "top_performer", "worst_performer",
  "upload_gap", "upload_streak", "consistency_warning",
  "channel_engagement_drop", "daily_summary", "first_sync",
]);

// ── TYPES PERMANENTLY DISABLED ───────────────────────────────
const DISABLED_TYPES = new Set([
  "excellent_retention",
  "low_retention",
  "stagnant",
  "needs_rescue",
  "star_performer",
]);

// ── MAX PER TYPE PER RUN ─────────────────────────────────────
const MAX_PER_TYPE: Record<string, number> = {
  critical_retention:   3,
  critical_engagement:  3,
  dead_video:           3,
  rising:               4,
  views_dropped:        3,
  likes_spike:          3,
  comments_spike:       3,
  shares_spike:         3,
  hidden_gem:           3,
  low_ctr_warning:      3,
  high_ctr_low_views:   3,
  re_engagement:        2,
  momentum_loss:        3,
  new_video:            5,
  strong_launch:        3,
};

function safeJson(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function pushToTelegram(event: any) {
  const severityMap: Record<string, string> = {
    info: "info", success: "success", warning: "warning", critical: "error",
  };
  const t = severityMap[event.severity] || "info";
  const title = `${event.emoji} ${event.type.replace(/_/g, " ").toUpperCase()}`;
  const hasVideo = event.videoId && event.videoId !== "channel" && event.videoId !== "system";

  if (hasVideo) {
    return sendWithButtons(t, title, event.message, [
      { text: "▶ Watch",   url: "https://youtube.com/watch?v=" + event.videoId },
      { text: "📊 Studio", url: "https://studio.youtube.com/video/" + event.videoId },
    ], event.data);
  }
  return sendTelegram(t, title, event.message, event.data);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const send  = searchParams.get("send")  === "true";
  const debug = searchParams.get("debug") === "true";

  try {
    const [channel, videosRaw] = await Promise.all([
      getChannelInfo(),
      getChannelVideos(500),
    ]);

    const videos = (videosRaw || []).map((v: any) => ({
      ...v,
      ...(v.analytics || {}),
      score: calculatePerformanceScore({
        views:              v.views || 0,
        likes:              v.likes || 0,
        comments:           v.comments || 0,
        publishedAt:        v.published_at,
        channelSubscribers: channel?.subscribers || 1000,
        ctr:                v.analytics?.ctr ?? null,
        retention:          v.analytics?.avg_view_percentage ?? null,
      }),
    }));

    const prevSnapshot = await loadSnapshot();
    const rawEvents    = detectEvents(videos, prevSnapshot, channel);

    // ── FILTER: Remove disabled + apply per-type caps ──
    const typeSeen: Record<string, number> = {};
    const events = rawEvents.filter(e => {
      // Remove permanently disabled types
      if (DISABLED_TYPES.has(e.type)) return false;
      // Only keep allowed types
      if (!ALLOWED_TYPES.has(e.type)) return false;
      // Apply per-type cap
      const max = MAX_PER_TYPE[e.type];
      if (max !== undefined) {
        const count = typeSeen[e.type] || 0;
        if (count >= max) return false;
        typeSeen[e.type] = count + 1;
      }
      return true;
    });

    // ── SORT by priority ──
    const PRIORITY: Record<string, number> = {
      viral_explosion: 1, viral: 2, milestone: 3, sub_milestone: 3,
      views_dropped: 4, new_video: 4, approaching_1k: 4,
      strong_launch: 5, comments_spike: 5, likes_spike: 6, shares_spike: 6,
      subscriber_gained: 6, rising: 7, watch_time_milestone: 7,
      re_engagement: 7, critical_retention: 8, critical_engagement: 8,
      low_ctr_warning: 8, momentum_loss: 8, hidden_gem: 8,
      high_ctr_low_views: 9, top_performer: 10, worst_performer: 10,
      upload_gap: 11, upload_streak: 11, channel_engagement_drop: 11,
      consistency_warning: 12, daily_summary: 13, first_sync: 99,
    };

    events.sort((a, b) => (PRIORITY[a.type] ?? 50) - (PRIORITY[b.type] ?? 50));

    // ── FINAL CAP: max 12 events total ──
    const finalEvents = events.slice(0, 12);

    // ── SEND ──
    const sentResults: any[] = [];
    if (send && finalEvents.length > 0) {
      for (const event of finalEvents) {
        try {
          const r = await pushToTelegram(event);
          sentResults.push({ type: event.type, success: r?.success ?? true, error: r?.error || null });
        } catch (e: any) {
          sentResults.push({ type: event.type, success: false, error: String(e?.message || e) });
        }
        await new Promise(r => setTimeout(r, 400));
      }
      await saveSnapshot(videos);
    }

    // ── STATS ──
    const grouped: Record<string, number> = {};
    for (const e of finalEvents) grouped[e.type] = (grouped[e.type] || 0) + 1;

    const allGrouped: Record<string, number> = {};
    for (const e of rawEvents) allGrouped[e.type] = (allGrouped[e.type] || 0) + 1;

    return safeJson({
      success:        true,
      totalVideos:    videos.length,
      eventsDetected: finalEvents.length,
      rawEventsTotal: rawEvents.length,
      eventsByType:   grouped,
      rawEventsByType:allGrouped,
      events:         finalEvents,
      sent:           sentResults.length,
      sentSuccess:    sentResults.filter(r => r.success).length,
      sentFailed:     sentResults.filter(r => !r.success).length,
      sentResults:    send ? sentResults : [],
      uniqueErrors:   [...new Set(sentResults.filter(r => !r.success).map(r => r.error).filter(Boolean))],
      timestamp:      new Date().toISOString(),
    });

  } catch (e: any) {
    console.error("[notifications] Error:", e);
    return safeJson({ success: false, error: String(e?.message || e) }, 500);
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.searchParams.set("send", "true");
  return GET(new NextRequest(url));
}
