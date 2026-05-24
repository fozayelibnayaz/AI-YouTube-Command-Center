import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeJson(data: any, status: number = 200) {
  return new NextResponse(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function dateFromDaysBack(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    const days = parseInt(searchParams.get("days") || "90");

    if (!videoId) return safeJson({ success: false, error: "videoId required" });

    const ya = await import("@/lib/youtube-analytics");
    const data = await ya.getVideoAnalytics(videoId, dateFromDaysBack(days), new Date().toISOString().split("T")[0]);

    return safeJson({
      success: true,
      videoId,
      days,
      data: data || {},
    });
  } catch (e: any) {
    return safeJson({ success: false, error: String(e?.message || e) });
  }
}
