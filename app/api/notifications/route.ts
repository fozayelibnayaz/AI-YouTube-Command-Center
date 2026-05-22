import { NextRequest, NextResponse } from "next/server";
import { getChannelVideos, getChannelInfo } from "@/lib/youtube";
import { calculatePerformanceScore } from "@/lib/utils";
import { detectEvents, loadSnapshot, saveSnapshot } from "@/lib/notification-engine";
import { sendTelegram, sendWithButtons } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    console.log("[notifications] Starting...");

    const [channel, videosRaw] = await Promise.all([
      getChannelInfo(),
      getChannelVideos(500),
    ]);
    console.log("[notifications] Fetched", videosRaw?.length || 0, "videos");

    const videos = (videosRaw || []).map((v: any) => ({
      ...v, ...(v.analytics || {}),
      score: calculatePerformanceScore({
        ctr: v.analytics?.ctr || 0,
        avg_view_percentage: v.analytics?.avg_view_percentage || 0,
        likes: v.likes || 0, views: v.views || 0, comments: v.comments || 0,
      }),
    }));

    const prevSnapshot = await loadSnapshot();
    console.log("[notifications] Prev snapshot has", Object.keys(prevSnapshot).length, "entries");

    const events = detectEvents(videos, prevSnapshot, channel);
    console.log("[notifications] Detected", events.length, "events");

    const sentResults: any[] = [];
    if (send) {
      // Limit to 20 most important events (avoid Telegram flood)
      const priority = ["viral_explosion", "viral", "new_video", "milestone", "sub_milestone",
        "needs_rescue", "critical_ctr", "critical_retention", "views_dropped",
        "star_performer", "daily_summary", "upload_gap",
        "rising", "strong_launch", "excellent_ctr", "excellent_retention",
        "low_ctr", "low_retention", "stagnant", "dead_video"];

      const sorted = events.sort((a, b) => {
        const ai = priority.indexOf(a.type);
        const bi = priority.indexOf(b.type);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      const toSend = sorted.slice(0, 20);
      for (const event of toSend) {
        try {
          const r = await pushToTelegram(event);
          sentResults.push({ type: event.type, title: event.title, success: r.success, error: r.error });
          // Small delay to avoid Telegram rate limit
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          sentResults.push({ type: event.type, success: false, error: String(e) });
        }
      }
      await saveSnapshot(videos);
      console.log("[notifications] Sent", sentResults.length, "alerts, saved snapshot");
    }

    const grouped: Record<string, number> = {};
    for (const e of events) grouped[e.type] = (grouped[e.type] || 0) + 1;

    return NextResponse.json({
      success: true,
      totalVideos: videos.length,
      eventsDetected: events.length,
      eventsByType: grouped,
      events,
      sent: sentResults.length,
      sentResults,
      snapshotSize: Object.keys(prevSnapshot).length,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[notifications] ERROR:", e);
    return NextResponse.json({
      success: false,
      error: String(e),
      stack: e instanceof Error ? e.stack?.substring(0, 500) : undefined,
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.searchParams.set("send", "true");
  return GET(new NextRequest(url));
}
