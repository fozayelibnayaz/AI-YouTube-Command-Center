import { NextRequest, NextResponse } from "next/server";
import { getChannelVideos, getChannelInfo } from "@/lib/youtube";
import { calculatePerformanceScore } from "@/lib/utils";
import { detectEvents, loadSnapshot, saveSnapshot } from "@/lib/smart-notifications";
import { sendTelegram, sendWithButtons } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const t     = severityMap[event.severity] || "info";
  const title = `${event.emoji} ${event.type.replace(/_/g, " ").toUpperCase()}`;

  const hasVideo = event.videoId &&
    event.videoId !== "channel" &&
    event.videoId !== "system";

  if (hasVideo) {
    return sendWithButtons(t, title, event.message, [
      { text: "▶ Watch",    url: "https://youtube.com/watch?v=" + event.videoId },
      { text: "📊 Studio",  url: "https://studio.youtube.com/video/" + event.videoId },
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
        views:                v.views || 0,
        likes:                v.likes || 0,
        comments:             v.comments || 0,
        publishedAt:          v.published_at,
        channelSubscribers:   channel?.subscribers || 1000,
        ctr:                  v.analytics?.ctr ?? null,
        retention:            v.analytics?.avg_view_percentage ?? null,
      }),
    }));

    const prevSnapshot = await loadSnapshot();
    const events       = detectEvents(videos, prevSnapshot, channel);

    // ── SEND TO TELEGRAM ──
    const sentResults: any[] = [];
    if (send && events.length > 0) {
      // Priority order: critical first, then by event priority
      const toSend = [...events]
        .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50))
        .slice(0, 12); // max 12 per run

      for (const event of toSend) {
        try {
          const r = await pushToTelegram(event);
          sentResults.push({ type: event.type, success: r?.success ?? true, error: r?.error || null });
        } catch (e: any) {
          sentResults.push({ type: event.type, success: false, error: String(e?.message || e) });
        }
        await new Promise(r => setTimeout(r, 400)); // rate limit
      }
      await saveSnapshot(videos);
    }

    // ── GROUP BY TYPE ──
    const grouped: Record<string, number> = {};
    for (const e of events) grouped[e.type] = (grouped[e.type] || 0) + 1;

    const successCount = sentResults.filter(r => r.success).length;
    const failCount    = sentResults.filter(r => !r.success).length;
    const errors       = [...new Set(sentResults.filter(r => !r.success).map(r => r.error).filter(Boolean))];

    return safeJson({
      success:       true,
      totalVideos:   videos.length,
      eventsDetected:events.length,
      eventsByType:  grouped,
      events:        debug ? events : events.map(e => ({
        type:     e.type,
        videoId:  e.videoId,
        title:    e.title,
        emoji:    e.emoji,
        message:  e.message,
        severity: e.severity,
        priority: e.priority,
        data:     e.data,
      })),
      sent:          sentResults.length,
      sentSuccess:   successCount,
      sentFailed:    failCount,
      uniqueErrors:  errors,
      sentResults:   send ? sentResults : [],
      telegramEnv: {
        hasToken:  !!process.env.TELEGRAM_BOT_TOKEN,
        hasChatId: !!process.env.TELEGRAM_CHAT_ID,
      },
      timestamp: new Date().toISOString(),
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
