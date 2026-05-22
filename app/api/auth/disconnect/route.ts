import { NextResponse } from "next/server";
import { disconnectOAuth } from "@/lib/oauth";

export async function POST() {
  await disconnectOAuth();
  return NextResponse.json({ success: true });
}
