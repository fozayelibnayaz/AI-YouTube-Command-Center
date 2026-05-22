import { NextResponse } from "next/server";
import { getOAuthStatus, hasOAuthConfig } from "@/lib/oauth";

export async function GET() {
  const status = await getOAuthStatus();
  return NextResponse.json({
    ...status,
    oauthConfigured: hasOAuthConfig(),
  });
}
