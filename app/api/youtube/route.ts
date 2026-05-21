import { NextRequest, NextResponse } from "next/server";
import { getChannelInfo, getChannelVideos } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "channel";

  try {
    if (action === "channel") {
      const data = await getChannelInfo();
      return NextResponse.json({ success: true, data });
    }
    if (action === "videos") {
      const max = parseInt(searchParams.get("max") || "20");
      const data = await getChannelVideos(max);
      return NextResponse.json({ success: true, data, count: data.length });
    }
    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
