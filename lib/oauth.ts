import { createClient } from "@supabase/supabase-js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function hasOAuthConfig(): boolean {
  return !!CLIENT_ID && !!CLIENT_SECRET && CLIENT_ID.length > 20;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
}

export async function exchangeCodeForTokens(code: string): Promise<any> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<any> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  return res.json();
}

export async function saveTokens(tokens: any, email: string, channelId: string, channelTitle?: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  await sb.from("oauth_tokens").upsert({
    id: "primary",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scope: tokens.scope || "",
    email,
    channel_id: channelId,
    channel_title: channelTitle || "",
    updated_at: new Date().toISOString(),
  });
}

// Updates ONLY channel info, doesn't fail if tokens missing
export async function updateChannelSelection(channelId: string, channelTitle: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  // First check if row exists
  const { data: existing } = await sb.from("oauth_tokens").select("id").eq("id", "primary").maybeSingle();

  if (existing) {
    await sb.from("oauth_tokens").update({
      channel_id: channelId,
      channel_title: channelTitle,
      updated_at: new Date().toISOString(),
    }).eq("id", "primary");
  } else {
    // No OAuth row yet - create a placeholder one with just channel info
    // This lets us track which channel to display even before OAuth
    await sb.from("oauth_tokens").upsert({
      id: "primary",
      access_token: "",
      refresh_token: "",
      expires_at: new Date(Date.now() - 1000).toISOString(),
      scope: "",
      email: "",
      channel_id: channelId,
      channel_title: channelTitle,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from("oauth_tokens").select("*").eq("id", "primary").maybeSingle();
    if (error || !data || !data.access_token) return null;
    const expiresAt = new Date(data.expires_at).getTime();
    const now = Date.now();
    if (expiresAt - now < 5 * 60 * 1000) {
      if (!data.refresh_token) return null;
      const refreshed = await refreshAccessToken(data.refresh_token);
      if (refreshed.access_token) {
        const newExpires = new Date(now + (refreshed.expires_in || 3600) * 1000).toISOString();
        await sb.from("oauth_tokens").update({
          access_token: refreshed.access_token,
          expires_at: newExpires,
          updated_at: new Date().toISOString(),
        }).eq("id", "primary");
        return refreshed.access_token;
      }
      return null;
    }
    return data.access_token;
  } catch (e) {
    console.error("getValidAccessToken:", e);
    return null;
  }
}

export async function getStoredChannelId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.from("oauth_tokens").select("channel_id").eq("id", "primary").maybeSingle();
    return data?.channel_id || null;
  } catch { return null; }
}

export async function getOAuthStatus(): Promise<{ connected: boolean; email?: string; channelId?: string; channelTitle?: string; expiresAt?: string }> {
  const sb = getSupabase();
  if (!sb) return { connected: false };
  try {
    const { data } = await sb.from("oauth_tokens").select("email,channel_id,channel_title,expires_at,access_token").eq("id", "primary").maybeSingle();
    if (!data) return { connected: false };
    return {
      connected: !!data.access_token,
      email: data.email,
      channelId: data.channel_id,
      channelTitle: data.channel_title,
      expiresAt: data.expires_at,
    };
  } catch { return { connected: false }; }
}

export async function disconnectOAuth(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("oauth_tokens").delete().eq("id", "primary");
}

export async function getUserInfo(accessToken: string): Promise<any> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  return res.json();
}

export async function getMineChannels(accessToken: string): Promise<any[]> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true&maxResults=50",
      { headers: { Authorization: "Bearer " + accessToken } }
    );
    const data = await res.json();
    if (data.error) {
      console.error("getMineChannels:", data.error.message);
      return [];
    }
    return data.items || [];
  } catch { return []; }
}

// Public API lookup (uses API key, not OAuth)
export async function getChannelByIdPublic(channelId: string): Promise<any | null> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY || "";
    if (!apiKey) return null;
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=" + channelId + "&key=" + apiKey
    );
    const data = await res.json();
    if (data.error || !data.items?.length) return null;
    return data.items[0];
  } catch { return null; }
}

export async function getAllManagedChannels(accessToken: string): Promise<any[]> {
  return getMineChannels(accessToken);
}

export async function getOwnedChannel(accessToken: string): Promise<any> {
  const channels = await getMineChannels(accessToken);
  return channels[0];
}
