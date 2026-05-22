import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, saveTokens, getUserInfo, getMineChannels } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  const error = new URL(req.url).searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  if (error) {
    let msg = error;
    if (error === "access_denied") {
      msg = "access_denied: Your email is not added as Test User in Google Cloud OAuth Consent Screen. Add yourself at console.cloud.google.com/apis/credentials/consent";
    }
    return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=${encodeURIComponent(msg)}`);
  }
  if (!code) return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=no_code`);

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (tokens.error || !tokens.access_token) {
      return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=${encodeURIComponent(tokens.error_description || tokens.error || "token_failed")}`);
    }

    const userInfo = await getUserInfo(tokens.access_token);
    const channels = await getMineChannels(tokens.access_token);

    // Save tokens with first channel (or empty)
    const firstChannel = channels[0];
    await saveTokens(
      tokens,
      userInfo.email || "",
      firstChannel?.id || "",
      firstChannel?.snippet?.title || ""
    );

    // Always go to select-channel to let user pick (including brand)
    return NextResponse.redirect(`${baseUrl}/select-channel?oauth_success=1`);
  } catch (e: any) {
    return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=${encodeURIComponent(e?.message || String(e))}`);
  }
}
