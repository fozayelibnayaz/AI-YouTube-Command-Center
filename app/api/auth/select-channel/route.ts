import { NextRequest, NextResponse } from "next/server";
import { updateChannelSelection } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  const { channelId, channelTitle } = await req.json();
  if (!channelId) {
    return NextResponse.json({ success: false, error: "channelId required" }, { status: 400 });
  }
  await updateChannelSelection(channelId, channelTitle || "");
  return NextResponse.json({ success: true, channelId, channelTitle });
}
