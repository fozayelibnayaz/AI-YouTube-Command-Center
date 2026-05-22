const API_KEY = process.env.YOUTUBE_API_KEY!;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID!;

function isConfigured(): boolean {
  return !!API_KEY && !API_KEY.includes("your_")
      && !!CHANNEL_ID && !CHANNEL_ID.includes("your_");
}

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseInt(match[3] || "0");
  return h * 3600 + m * 60 + s;
}

// Engagement-based metrics derived from REAL data
// These are calculations, NOT estimates - 100% real
function calculateRealMetrics(views: number, likes: number, comments: number, duration: number) {
  const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const likeRate = views > 0 ? (likes / views) * 100 : 0;
  const commentRate = views > 0 ? (comments / views) * 100 : 0;

  return {
    engagement_rate: parseFloat(engagementRate.toFixed(3)),
    like_rate: parseFloat(likeRate.toFixed(3)),
    comment_rate: parseFloat(commentRate.toFixed(3)),
    // These are NULL because YouTube Data API doesn't provide them
    ctr: null,
    avg_view_percentage: null,
    avg_view_duration_seconds: null,
    impressions: null,
    watch_time_minutes: null,
    revenue_usd: null,
  };
}

const DEMO_CHANNEL = {
  title: "Demo YouTube Channel",
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
  if (!isConfigured()) {
    return [];
  }

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

    const allVideos: any[] = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batch = allVideoIds.slice(i, i + 50).join(",");
      const videoRes = await fetch(
        "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=" +
          batch + "&key=" + API_KEY
      );
      const videoData = await videoRes.json();
      if (videoData.error) throw new Error(videoData.error.message);

      for (const v of videoData.items || []) {
        const duration = parseDuration(v.contentDetails?.duration || "PT0S");
        const views = parseInt(v.statistics?.viewCount || "0");
        const likes = parseInt(v.statistics?.likeCount || "0");
        const comments = parseInt(v.statistics?.commentCount || "0");

        const video = {
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
        };

        allVideos.push({
          ...video,
          analytics: calculateRealMetrics(views, likes, comments, duration),
          demo: false,
          data_source: "youtube_data_api_v3",
          metrics_note: "Views/Likes/Comments are 100% real. CTR/Retention require YouTube Analytics API (OAuth).",
        });
      }
    }

    return allVideos;
  } catch (e) {
    console.error("getChannelVideos error:", e);
    return [];
  }
}
