import { NextResponse } from "next/server";
import { getPlaylistTitles } from "@/lib/youtube-analytics";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { playlistIds } = await req.json();
    if (!Array.isArray(playlistIds)) {
      return NextResponse.json({ error: "playlistIds must be array" }, { status: 400 });
    }
    const titles = await getPlaylistTitles(playlistIds);
    return NextResponse.json({ success: true, titles });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = url.searchParams.get("ids")?.split(",") || [];
  const titles = await getPlaylistTitles(ids);
  return NextResponse.json({ success: true, titles });
}
