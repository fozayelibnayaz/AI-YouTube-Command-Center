import { NextRequest, NextResponse } from "next/server";
import { getChannelInfo, getChannelVideos } from "@/lib/youtube";

export const dynamic = "force-dynamic";

function safeJson(data: any, status: number = 200) {
  return new NextResponse(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "channel";

    if (action === "channel") {
      const data = await getChannelInfo();
      return safeJson({ success: true, data });
    }
    if (action === "videos") {
      const max = parseInt(searchParams.get("max") || "500");
      const startDate = searchParams.get("startDate") || undefined;
      const endDate = searchParams.get("endDate") || undefined;
      const data = await getChannelVideos(max, startDate, endDate);
      return safeJson({
        success: true, data, count: data.length,
        startDate, endDate,
      });
    }
    return safeJson({ success: false, error: "Unknown action" }, 400);
  } catch (e: any) {
    return safeJson({ success: false, error: String(e?.message || e) });
  }
}
