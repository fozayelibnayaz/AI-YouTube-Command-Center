import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function safeJson(data: any) {
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET() {
  const debug: any = {
    timestamp: new Date().toISOString(),
    env: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "NOT SET",
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasYoutubeKey: !!process.env.YOUTUBE_API_KEY,
      youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || "NOT SET",
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
    },
    checks: [] as any[],
  };

  // Check Supabase schema
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !key) {
      debug.checks.push({ check: "supabase_config", status: "fail", reason: "Missing URL or key" });
    } else {
      const sb = createClient(url, key);

      // Try to select all expected columns
      try {
        const { data, error } = await sb.from("oauth_tokens").select("id,access_token,refresh_token,expires_at,scope,email,channel_id,channel_title,updated_at").eq("id", "primary").maybeSingle();
        if (error) {
          debug.checks.push({
            check: "schema",
            status: "fail",
            error: error.message,
            FIX: "Run this SQL in Supabase: ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS channel_title TEXT DEFAULT '';",
          });
        } else {
          debug.checks.push({
            check: "schema",
            status: "ok",
            hasRow: !!data,
            data: data ? {
              email: data.email,
              channelId: data.channel_id,
              channelTitle: data.channel_title,
              hasAccessToken: !!data.access_token,
              hasRefreshToken: !!data.refresh_token,
              expiresAt: data.expires_at,
            } : null,
          });
        }
      } catch (e: any) {
        debug.checks.push({ check: "schema", status: "exception", error: e.message });
      }
    }
  } catch (e: any) {
    debug.checks.push({ check: "supabase", status: "exception", error: e.message });
  }

  // Test API routes
  try {
    const { getValidAccessToken, getMineChannels } = await import("@/lib/oauth");
    const token = await getValidAccessToken();
    if (token) {
      debug.checks.push({ check: "token", status: "ok", length: token.length });
      const channels = await getMineChannels(token);
      debug.checks.push({
        check: "channels_api",
        status: "ok",
        count: channels.length,
        channels: channels.map((c: any) => ({
          id: c.id,
          title: c.snippet?.title,
          subs: c.statistics?.subscriberCount,
        })),
      });
    } else {
      debug.checks.push({ check: "token", status: "none", reason: "No token in DB or expired" });
    }
  } catch (e: any) {
    debug.checks.push({ check: "oauth_import", status: "exception", error: e.message });
  }

  return safeJson(debug);
}
