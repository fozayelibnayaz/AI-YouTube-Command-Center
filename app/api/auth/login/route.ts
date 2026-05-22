import { NextResponse } from "next/server";
import { getAuthUrl, hasOAuthConfig } from "@/lib/oauth";

export async function GET() {
  if (!hasOAuthConfig()) {
    return NextResponse.json({ error: "OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to env." }, { status: 500 });
  }
  return NextResponse.redirect(getAuthUrl());
}
