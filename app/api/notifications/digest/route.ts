import { NextRequest, NextResponse } from "next/server";
import { getChannelInfo, getChannelVideos } from "@/lib/youtube";
import {
  generateDailyDigest,
  generateWeeklyDigest,
  generateMonthlyDigest,
} from "@/lib/smart-notifications";
import { sendTelegram } from "@/lib/telegram";

export const dynamic   = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "daily";
  const send = searchParams.get("send") === "true";

  if (!["daily", "weekly", "monthly"].includes(type)) {
    return NextResponse.json(
      { success: false, error: "Invalid type. Use: daily | weekly | monthly" },
      { status: 400 }
    );
  }

  try {
    const [channel, videosRaw] = await Promise.all([
      getChannelInfo(),
      getChannelVideos(500),
    ]);

    if (!videosRaw || videosRaw.length === 0) {
      return NextResponse.json({ success: false, error: "No videos found" });
    }

    const videos = (videosRaw || []).map((v: any) => ({
      ...v,
      ...(v.analytics || {}),
      engagement_rate: v.analytics?.engagement_rate ?? 0,
    }));

    let digest: { title: string; message: string; data: Record<string, string | number> };

    if (type === "daily")        digest = generateDailyDigest(channel, videos);
    else if (type === "weekly")  digest = generateWeeklyDigest(channel, videos);
    else                         digest = generateMonthlyDigest(channel, videos);

    let sentResult = null;
    if (send) {
      sentResult = await sendTelegram("report", digest.title, digest.message, digest.data);
    }

    return NextResponse.json({
      success: true,
      type,
      digest,
      sent:      send ? sentResult : null,
      timestamp: new Date().toISOString(),
    });

  } catch (e: any) {
    console.error("[digest] Error:", e);
    return NextResponse.json(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
