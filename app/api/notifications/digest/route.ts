import { NextRequest, NextResponse } from "next/server";
import { getChannelInfo, getChannelVideos } from "@/lib/youtube";
import { generateDailyDigest, generateWeeklyDigest, generateMonthlyDigest } from "@/lib/smart-notifications";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "daily";
  const send = searchParams.get("send") === "true";

  try {
    const [channel, videosRaw] = await Promise.all([
      getChannelInfo(),
      getChannelVideos(500),
    ]);

    const videos = (videosRaw || []).map((v: any) => ({
      ...v, ...(v.analytics || {}),
      engagement_rate: v.analytics?.engagement_rate ?? 0,
    }));

    let digest;
    if (type === "daily") digest = generateDailyDigest(channel, videos);
    else if (type === "weekly") digest = generateWeeklyDigest(channel, videos);
    else if (type === "monthly") digest = generateMonthlyDigest(channel, videos);
    else return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });

    let sentResult = null;
    if (send) {
      sentResult = await sendTelegram("report", digest.title, digest.message, digest.data, { silent: false });
    }

    return NextResponse.json({ success: true, type, digest, sent: send ? sentResult : null });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}
