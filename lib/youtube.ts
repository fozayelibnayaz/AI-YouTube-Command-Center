import { getBatchVideoAnalytics } from "./youtube-analytics";
import { getValidAccessToken } from "./oauth";

const API_KEY = process.env.YOUTUBE_API_KEY!;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID!;

function isConfigured(): boolean {
  return !!API_KEY && !API_KEY.includes("your_")
      && !!CHANNEL_ID && !CHANNEL_ID.includes("your_");
}

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
}

function calculateRealEngagement(views: number, likes: number, comments: number) {
  return {
    engagement_rate: views > 0 ? parseFloat((((likes + comments) / views) * 100).toFixed(3)) : 0,
    like_rate: views > 0 ? parseFloat(((likes / views) * 100).toFixed(3)) : 0,
    comment_rate: views > 0 ? parseFloat(((comments / views) * 100).toFixed(3)) : 0,
  };
}

const DEMO_CHANNEL = {
  title: "Demo Channel",
  thumbnail: "",
  subscribers: 45200,
  totalViews: 1250000,
  videoCount: 87,
};

export async function getChannelInfo() {
  if (!isConfigured()) return { ...DEMO_CHANNEL, demo: true };

  try {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=" + CHANNEL_ID + "&key=" + API_KEY,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    if (data.error || !data.items?.length) throw new Error("Channel not found");
    const ch = data.items[0];
    return {
      title: ch.snippet.title,
      thumbnail: ch.snippet.thumbnails?.high?.url || "",
      subscribers: parseInt(ch.statistics.subscriberCount || "0"),
      totalViews: parseInt(ch.statistics.viewCount || "0"),
      videoCount: parseInt(ch.statistics.videoCount || "0"),
      demo: false,
    };
  } catch {
    return { ...DEMO_CHANNEL, demo: true };
  }
}

export async function getChannelVideos(max = 500) {
  if (!isConfigured()) return [];

  try {
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=" + CHANNEL_ID + "&key=" + API_KEY
    );
    const channelData = await channelRes.json();
    if (channelData.error) throw new Error(channelData.error.message);

    const uploadsId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    const allVideoIds: string[] = [];
    let nextPageToken: string | undefined = undefined;
    let safety = 0;

    do {
      const pageSize = Math.min(50, max - allVideoIds.length);
      if (pageSize <= 0) break;
      const tokenParam: string = nextPageToken ? "&pageToken=" + nextPageToken : "";
      const playlistRes = await fetch(
        "https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=" +
          uploadsId + "&maxResults=" + pageSize + "&key=" + API_KEY + tokenParam
      );
      const playlistData = await playlistRes.json();
      if (playlistData.error) throw new Error(playlistData.error.message);
      const ids = (playlistData.items || []).map((i: any) => i.contentDetails.videoId);
      allVideoIds.push(...ids);
      nextPageToken = playlistData.nextPageToken;
      safety++;
      if (safety > 50) break;
    } while (nextPageToken && allVideoIds.length < max);

    // Fetch video details from YouTube Data API
    const allVideos: any[] = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batch = allVideoIds.slice(i, i + 50).join(",");
      const videoRes = await fetch(
        "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=" + batch + "&key=" + API_KEY
      );
      const videoData = await videoRes.json();
      if (videoData.error) throw new Error(videoData.error.message);

      for (const v of videoData.items || []) {
        const duration = parseDuration(v.contentDetails?.duration || "PT0S");
        const views = parseInt(v.statistics?.viewCount || "0");
        const likes = parseInt(v.statistics?.likeCount || "0");
        const comments = parseInt(v.statistics?.commentCount || "0");

        allVideos.push({
          youtube_id: v.id,
          title: v.snippet.title,
          description: v.snippet.description || "",
          thumbnail_url: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || "",
          published_at: v.snippet.publishedAt,
          tags: v.snippet.tags || [],
          duration_seconds: duration,
          views,
          likes,
          comments,
          analytics: calculateRealEngagement(views, likes, comments),
          demo: false,
          has_real_analytics: false,
        });
      }
    }

    // ─── ENRICH with REAL CTR/Retention if OAuth connected ───
    const token = await getValidAccessToken();
    if (token) {
      try {
        const realAnalytics = await getBatchVideoAnalytics(allVideoIds, 90);

        for (const v of allVideos) {
          const real = realAnalytics[v.youtube_id];
          if (real) {
            v.analytics = {
              ...v.analytics,
              // REAL data from YouTube Analytics API
              ctr: real.ctr,  // REAL impression CTR
              impressions: real.impressions,
              avg_view_percentage: real.averageViewPercentage
                ? parseFloat(real.averageViewPercentage.toFixed(2))
                : null,
              avg_view_duration_seconds: real.averageViewDuration || null,
              watch_time_minutes: real.estimatedMinutesWatched || null,
              shares: real.shares || 0,
              subscribers_gained: real.subscribersGained || 0,
              analytics_period: "Last 90 days",
            };
            v.has_real_analytics = true;
          }
        }
      } catch (e) {
        console.error("Failed to enrich with Analytics API:", e);
      }
    }

    return allVideos;
  } catch (e) {
    console.error("getChannelVideos error:", e);
    return [];
  }
}
