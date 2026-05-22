import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, saveTokens, getUserInfo, getOwnedChannel } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  const error = new URL(req.url).searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=${error}`);
  }
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=no_code`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (tokens.error || !tokens.access_token) {
      return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=${tokens.error || "token_failed"}`);
    }

    const userInfo = await getUserInfo(tokens.access_token);
    const channel = await getOwnedChannel(tokens.access_token);

    await saveTokens(tokens, userInfo.email || "", channel?.id || "");

    return NextResponse.redirect(`${baseUrl}/dashboard?oauth_success=1`);
  } catch (e) {
    return NextResponse.redirect(`${baseUrl}/dashboard?oauth_error=${encodeURIComponent(String(e))}`);
  }
}
