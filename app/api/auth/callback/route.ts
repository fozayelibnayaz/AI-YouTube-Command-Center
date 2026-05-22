import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, saveTokens, getUserInfo, getAllManagedChannels } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  const error = new URL(req.url).searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  if (error) return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=${error}`);
  if (!code) return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=no_code`);

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (tokens.error || !tokens.access_token) {
      return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=${tokens.error || "token_failed"}`);
    }

    const userInfo = await getUserInfo(tokens.access_token);
    const channels = await getAllManagedChannels(tokens.access_token);

    if (channels.length === 0) {
      // Save tokens but no channel - they'll need to select later
      await saveTokens(tokens, userInfo.email || "", "", "No channels found");
      return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=no_channels_found`);
    }

    // Auto-select first channel, user can change in /select-channel
    const firstChannel = channels[0];
    await saveTokens(tokens, userInfo.email || "", firstChannel.id, firstChannel.snippet?.title || "");

    if (channels.length === 1) {
      // Only one channel - go straight to dashboard
      return NextResponse.redirect(`${baseUrl}/dashboard?oauth_success=1`);
    } else {
      // Multiple channels - let user pick
      return NextResponse.redirect(`${baseUrl}/select-channel?oauth_success=1`);
    }
  } catch (e) {
    return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=${encodeURIComponent(String(e))}`);
  }
}
