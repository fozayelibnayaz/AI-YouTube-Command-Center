import { NextRequest, NextResponse } from "next/server";
import { getChannelVideos, getChannelInfo } from "@/lib/youtube";
import { calculatePerformanceScore } from "@/lib/utils";
import { detectEvents, loadSnapshot, saveSnapshot } from "@/lib/smart-notifications";
import { sendTelegram, sendWithButtons } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeJson(data: any, status: number = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function pushToTelegram(event: any) {
  const typeMap: Record<string, string> = {
    info: "info", success: "success", warning: "warning", critical: "error",
  };
  const t = typeMap[event.severity] || "info";
  const title = event.emoji + " " + event.type.replace(/_/g, " ").toUpperCase();

  if (event.videoId && event.videoId !== "channel" && event.videoId !== "system") {
    return sendWithButtons(t, title, event.message, [
      { text: "▶ Watch", url: "https://youtube.com/watch?v=" + event.videoId },
      { text: "📊 Studio", url: "https://studio.youtube.com/video/" + event.videoId },
    ], event.data);
  }
  return sendTelegram(t, title, event.message, event.data);
}

export async function GET(req: NextRequest) {
  const send = new URL(req.url).searchParams.get("send") === "true";

  try {
    const [channel, videosRaw] = await Promise.all([
      getChannelInfo(),
      getChannelVideos(500),
    ]);

    const videos = (videosRaw || []).map((v: any) => ({
      ...v, ...(v.analytics || {}),
      score: calculatePerformanceScore({
        views: v.views || 0,
        likes: v.likes || 0,
        comments: v.comments || 0,
        publishedAt: v.published_at,
        channelSubscribers: channel?.subscribers || 1000,
        ctr: v.analytics?.ctr ?? null,
        retention: v.analytics?.avg_view_percentage ?? null,
      }),
    }));

    const prevSnapshot = await loadSnapshot();
    const events = detectEvents(videos, prevSnapshot, channel);

    const sentResults: any[] = [];
    if (send) {
      const priority = ["viral_explosion", "viral", "new_video", "milestone", "sub_milestone",
        "needs_rescue", "critical_engagement", "critical_retention", "views_dropped",
        "star_performer", "daily_summary", "upload_gap",
        "rising", "strong_launch", "excellent_retention",
        "low_retention", "stagnant", "dead_video"];

      const sorted = events.sort((a, b) => {
        const ai = priority.indexOf(a.type);
        const bi = priority.indexOf(b.type);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      const toSend = sorted.slice(0, 20);
      for (const event of toSend) {
        try {
          const r = await pushToTelegram(event);
          sentResults.push({
            type: event.type,
            success: r.success,
            error: r.error || null,
          });
          await new Promise(r => setTimeout(r, 300));
        } catch (e: any) {
          sentResults.push({
            type: event.type,
            success: false,
            error: String(e?.message || e),
          });
        }
      }
      await saveSnapshot(videos);
    }

    const grouped: Record<string, number> = {};
    for (const e of events) grouped[e.type] = (grouped[e.type] || 0) + 1;

    const successCount = sentResults.filter(r => r.success).length;
    const failCount = sentResults.filter(r => !r.success).length;
    const errors = sentResults.filter(r => !r.success).map(r => r.error).filter(Boolean);
    const uniqueErrors = Array.from(new Set(errors));

    return safeJson({
      success: true,
      totalVideos: videos.length,
      eventsDetected: events.length,
      eventsByType: grouped,
      events: events.slice(0, 50),
      sent: sentResults.length,
      sentSuccess: successCount,
      sentFailed: failCount,
      sentResults: send ? sentResults : [],
      uniqueErrors,
      telegramEnv: {
        hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
        hasChatId: !!process.env.TELEGRAM_CHAT_ID,
        apiUrl: process.env.TELEGRAM_API_URL || "default",
      },
    });
  } catch (e: any) {
    return safeJson({ success: false, error: String(e?.message || e) }, 500);
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.searchParams.set("send", "true");
  return GET(new NextRequest(url));
}
