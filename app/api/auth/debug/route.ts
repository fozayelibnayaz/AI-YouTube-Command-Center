import { NextResponse } from "next/server";
import { getValidAccessToken, getAllManagedChannels, hasOAuthConfig } from "@/lib/oauth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const debug: any = {
    timestamp: new Date().toISOString(),
    env: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "NOT SET",
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasYoutubeKey: !!process.env.YOUTUBE_API_KEY,
      youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || "NOT SET",
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
    },
    oauthConfigured: hasOAuthConfig(),
    steps: [],
  };

  // Step 1: Check Supabase connection
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !key) {
      debug.steps.push({ step: "supabase", status: "fail", reason: "Missing URL or key" });
    } else {
      const sb = createClient(url, key);
      const { data, error } = await sb.from("oauth_tokens").select("id,email,channel_id,channel_title,expires_at").eq("id", "primary").single();
      if (error) {
        debug.steps.push({ step: "supabase", status: "fail", error: error.message, code: error.code });
        if (error.message?.includes("channel_title")) {
          debug.steps.push({ step: "schema", status: "fail", action: "Run: ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS channel_title TEXT DEFAULT '';" });
        }
      } else if (!data) {
        debug.steps.push({ step: "supabase", status: "ok", tokensFound: false });
      } else {
        debug.steps.push({
          step: "supabase", status: "ok", tokensFound: true,
          email: data.email, channelId: data.channel_id, channelTitle: data.channel_title,
          expiresAt: data.expires_at,
        });
      }
    }
  } catch (e) {
    debug.steps.push({ step: "supabase", status: "exception", error: String(e) });
  }

  // Step 2: Get access token
  try {
    const token = await getValidAccessToken();
    if (!token) {
      debug.steps.push({ step: "token", status: "fail", reason: "No valid token (need to OAuth login)" });
    } else {
      debug.steps.push({ step: "token", status: "ok", tokenLength: token.length });

      // Step 3: Fetch managed channels
      try {
        const channels = await getAllManagedChannels(token);
        debug.steps.push({
          step: "channels", status: "ok", count: channels.length,
          channels: channels.map((c: any) => ({
            id: c.id,
            title: c.snippet?.title,
            subs: c.statistics?.subscriberCount,
            videos: c.statistics?.videoCount,
          })),
        });
      } catch (e) {
        debug.steps.push({ step: "channels", status: "exception", error: String(e) });
      }
    }
  } catch (e) {
    debug.steps.push({ step: "token", status: "exception", error: String(e) });
  }

  return NextResponse.json(debug, { status: 200 });
}
