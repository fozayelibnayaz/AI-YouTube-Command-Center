import { NextRequest, NextResponse } from "next/server";
import { getChannelVideos, getChannelInfo } from "@/lib/youtube";
import { calculatePerformanceScore } from "@/lib/utils";
import { detectEvents, loadSnapshot, saveSnapshot, NotificationEvent } from "@/lib/notification-engine";
import { sendTelegram, sendWithButtons } from "@/lib/telegram";

const SEVERITY_MAP: Record<string, string> = { info: "info", success: "success", warning: "warning", critical: "error" };

async function pushToTelegram(event: NotificationEvent) {
  const type = SEVERITY_MAP[event.severity] || "info";
  const title = event.emoji + " " + event.type.replace(/_/g, " ").toUpperCase();
  if (event.videoId && event.videoId !== "channel" && event.videoId !== "system") {
    return sendWithButtons(type, title, event.message, [
      { text: "Watch Video", url: "https://youtube.com/watch?v=" + event.videoId },
      { text: "Edit in Studio", url: "https://studio.youtube.com/video/" + event.videoId },
    ], event.data);
  }
  return sendTelegram(type, title, event.message, event.data);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const send = searchParams.get("send") === "true";

  try {
    const [channel, videosRaw] = await Promise.all([getChannelInfo(), getChannelVideos(500)]);
    const videos = (videosRaw || []).map((v: any) => ({
      ...v,
      ...(v.analytics || {}),
      score: calculatePerformanceScore({
        ctr: v.analytics?.ctr || 0,
        avg_view_percentage: v.analytics?.avg_view_percentage || 0,
        likes: v.likes || 0,
        views: v.views || 0,
        comments: v.comments || 0,
      }),
    }));

    const prevSnapshot = await loadSnapshot();
    const events = detectEvents(videos, prevSnapshot, channel);

    let sentResults: any[] = [];
    if (send) {
      for (const event of events) {
        const r = await pushToTelegram(event);
        sentResults.push({ type: event.type, success: r.success });
      }
      await saveSnapshot(videos);
    }

    const grouped: Record<string, number> = {};
    for (const e of events) grouped[e.type] = (grouped[e.type] || 0) + 1;

    return NextResponse.json({
      success: true,
      totalVideos: videos.length,
      eventsDetected: events.length,
      eventsByType: grouped,
      events: events.slice(0, 50),
      sent: send ? sentResults.length : 0,
      sentResults,
      snapshotExists: Object.keys(prevSnapshot).length > 0,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.searchParams.set("send", "true");
  return GET(new NextRequest(url, req));
}
