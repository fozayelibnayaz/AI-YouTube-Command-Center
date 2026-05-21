import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo, generateTitles, generateHooks } from "@/lib/ai-engine";

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();

    switch (action) {
      case "analyze_video": {
        const result = await analyzeVideo(payload.video);
        return NextResponse.json({ success: true, data: result });
      }
      case "generate_titles": {
        const result = await generateTitles(payload.topic);
        return NextResponse.json({ success: true, data: result });
      }
      case "generate_hooks": {
        const result = await generateHooks(payload.videoTitle);
        return NextResponse.json({ success: true, data: result });
      }
      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
