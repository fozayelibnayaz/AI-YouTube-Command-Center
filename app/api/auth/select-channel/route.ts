import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeJson(data: any, status: number = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch { return safeJson({ success: false, error: "Invalid JSON" }); }

    const channelId = (body.channelId || "").trim();
    const channelTitle = (body.channelTitle || "").trim();

    if (!channelId) return safeJson({ success: false, error: "channelId required" });

    let oauth;
    try { oauth = await import("@/lib/oauth"); }
    catch (e: any) { return safeJson({ success: false, error: "Module load: " + e.message }); }

    try {
      await oauth.updateChannelSelection(channelId, channelTitle);
    } catch (e: any) {
      return safeJson({
        success: false,
        error: "Save failed: " + (e?.message || String(e)),
        hint: "Check Supabase oauth_tokens table has channel_title column. Run: ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS channel_title TEXT DEFAULT '';",
      });
    }

    return safeJson({ success: true, channelId, channelTitle });
  } catch (e: any) {
    return safeJson({ success: false, error: String(e?.message || e) });
  }
}
