import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channelId, channelTitle } = body;

    if (!channelId) {
      return NextResponse.json({ success: false, error: "channelId required" }, { status: 200 });
    }

    const { updateChannelSelection } = await import("@/lib/oauth");

    try {
      await updateChannelSelection(channelId, channelTitle || "");
    } catch (e: any) {
      // If no OAuth token exists yet, store in a simpler way
      return NextResponse.json({
        success: false,
        error: "Save failed: " + String(e?.message || e),
        hint: "You may need to OAuth login first, or check Supabase oauth_tokens table",
      }, { status: 200 });
    }

    return NextResponse.json({ success: true, channelId, channelTitle });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: String(e?.message || e),
    }, { status: 200 });
  }
}
