import { getValidAccessToken, getStoredChannelId } from "./oauth";

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";

function dateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

async function getChannelFilter(): Promise<string> {
  const channelId = await getStoredChannelId();
  if (channelId && channelId.length > 5) return "channel==" + channelId;
  return "channel==MINE";
}

async function fetchAnalytics(params: Record<string, string>): Promise<any> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Not authenticated");
  if (!params.ids) params.ids = await getChannelFilter();
  const url = ANALYTICS_BASE + "?" + new URLSearchParams(params).toString();
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const data = await res.json();
  if (data.error) {
    console.error("Analytics API error:", data.error.message);
    throw new Error(data.error.message);
  }
  return data;
}

function parseRows(data: any): any[] {
  if (!data.rows || !data.columnHeaders) return [];
  const headers = data.columnHeaders.map((c: any) => c.name);
  return data.rows.map((row: any[]) => {
    const obj: any = {};
    headers.forEach((h: string, i: number) => obj[h] = row[i]);
    return obj;
  });
}

export async function getVideoAnalytics(videoId: string, startDate?: string, endDate?: string): Promise<any> {
  try {
    const data = await fetchAnalytics({
      startDate: startDate || dateString(90),
      endDate: endDate || dateString(0),
      metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,dislikes,comments,shares,subscribersGained,subscribersLost,videosAddedToPlaylists,videosRemovedFromPlaylists",
      dimensions: "video", filters: "video==" + videoId,
    });
    return parseRows(data)[0] || null;
  } catch { return null; }
}

export async function getRetentionCurve(videoId: string): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: dateString(365), endDate: dateString(0),
      metrics: "audienceWatchRatio,relativeRetentionPerformance",
      dimensions: "elapsedVideoTimeRatio",
      filters: "video==" + videoId, sort: "elapsedVideoTimeRatio",
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getTrafficSources(videoId?: string, startDate?: string, endDate?: string): Promise<any[]> {
  try {
    const params: any = {
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: "views,estimatedMinutesWatched,averageViewDuration",
      dimensions: "insightTrafficSourceType", sort: "-views",
    };
    if (videoId) params.filters = "video==" + videoId;
    const data = await fetchAnalytics(params);
    return parseRows(data);
  } catch { return []; }
}

export async function getDemographics(startDate?: string, endDate?: string): Promise<any> {
  const start = startDate || dateString(90);
  const end = endDate || dateString(0);
  try {
    const [ageGender, geography, devices, os, language] = await Promise.all([
      fetchAnalytics({ startDate: start, endDate: end, metrics: "viewerPercentage", dimensions: "ageGroup,gender" }).then(parseRows).catch(() => []),
      fetchAnalytics({ startDate: start, endDate: end, metrics: "views,estimatedMinutesWatched", dimensions: "country", sort: "-views", maxResults: "20" }).then(parseRows).catch(() => []),
      fetchAnalytics({ startDate: start, endDate: end, metrics: "views,estimatedMinutesWatched", dimensions: "deviceType" }).then(parseRows).catch(() => []),
      fetchAnalytics({ startDate: start, endDate: end, metrics: "views", dimensions: "operatingSystem", sort: "-views", maxResults: "10" }).then(parseRows).catch(() => []),
      fetchAnalytics({ startDate: start, endDate: end, metrics: "views", dimensions: "subscribedStatus" }).then(parseRows).catch(() => []),
    ]);
    return { ageGender, geography, devices, os, subscribedStatus: language };
  } catch (e) {
    return { ageGender: [], geography: [], devices: [], os: [], subscribedStatus: [], error: String(e) };
  }
}

export async function getSubscriberGrowth(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: "subscribersGained,subscribersLost,views",
      dimensions: "day", sort: "day",
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getDailyViews(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: "views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained",
      dimensions: "day", sort: "day",
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getRevenue(startDate?: string, endDate?: string): Promise<any> {
  try {
    const data = await fetchAnalytics({
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: "estimatedRevenue,estimatedAdRevenue,grossRevenue,cpm,playbackBasedCpm,adImpressions,monetizedPlaybacks",
    });
    return parseRows(data)[0] || null;
  } catch { return null; }
}

export async function getRevenueDaily(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: "estimatedRevenue,cpm,adImpressions",
      dimensions: "day", sort: "day",
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getTopVideos(metric: string = "views", startDate?: string, endDate?: string, max: number = 10): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: metric, dimensions: "video", sort: "-" + metric, maxResults: String(max),
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getSearchTerms(videoId?: string, startDate?: string, endDate?: string): Promise<any[]> {
  try {
    const params: any = {
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: "views",
      dimensions: "insightTrafficSourceDetail",
      filters: "insightTrafficSourceType==YT_SEARCH",
      sort: "-views", maxResults: "50",
    };
    if (videoId) params.filters += ";video==" + videoId;
    const data = await fetchAnalytics(params);
    return parseRows(data);
  } catch { return []; }
}

export async function getViewsByPlayback(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: "views,estimatedMinutesWatched",
      dimensions: "insightPlaybackLocationType",
      sort: "-views",
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getSharingService(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: "shares",
      dimensions: "sharingService",
      sort: "-shares", maxResults: "20",
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getPlaylistAnalytics(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: startDate || dateString(30),
      endDate: endDate || dateString(0),
      metrics: "views,estimatedMinutesWatched,averageViewDuration,playlistStarts,viewsPerPlaylistStart,averageTimeInPlaylist",
      dimensions: "playlist",
      sort: "-views", maxResults: "25",
    });
    const rows = parseRows(data);
    // V15: Auto-merge playlist titles
    const ids = rows.map((r: any) => r.playlist).filter(Boolean);
    if (ids.length > 0) {
      try {
        const titles = await getPlaylistTitles(ids);
        return rows.map((r: any) => ({ ...r, playlist_title: titles[r.playlist] || r.playlist }));
      } catch { return rows; }
    }
    return rows;
  } catch { return []; }
}

async function getBatchCore(videoIds: string[], startDate: string, endDate: string): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (videoIds.length === 0) return result;
  const batchSize = 50;
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    const filter = "video==" + batch.join(",");
    try {
      const data = await fetchAnalytics({
        startDate, endDate,
        metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,dislikes,comments,shares,subscribersGained",
        dimensions: "video", filters: filter, maxResults: String(batchSize),
      });
      const rows = parseRows(data);
      for (const r of rows) result[r.video] = r;
    } catch (e) { console.error("Core batch failed:", e); }
  }
  return result;
}

async function getBatchCardMetrics(videoIds: string[], startDate: string, endDate: string): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (videoIds.length === 0) return result;
  const batchSize = 30;
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    const filter = "video==" + batch.join(",");
    try {
      const data = await fetchAnalytics({
        startDate, endDate,
        metrics: "cardImpressions,cardClicks,cardClickRate",
        dimensions: "video", filters: filter, maxResults: String(batchSize),
      });
      const rows = parseRows(data);
      for (const r of rows) {
        result[r.video] = {
          cardImpressions: r.cardImpressions || 0,
          cardClicks: r.cardClicks || 0,
          cardCTR: r.cardClickRate != null ? parseFloat((r.cardClickRate * 100).toFixed(2)) : null,
        };
      }
    } catch {}
  }
  return result;
}

export async function getBatchVideoAnalytics(videoIds: string[], startDate?: string, endDate?: string): Promise<Record<string, any>> {
  if (videoIds.length === 0) return {};
  const start = startDate || dateString(90);
  const end = endDate || dateString(0);
  const [core, cards] = await Promise.all([
    getBatchCore(videoIds, start, end),
    getBatchCardMetrics(videoIds, start, end),
  ]);
  const result: Record<string, any> = {};
  for (const id of videoIds) {
    const c = core[id];
    const card = cards[id];
    if (c || card) {
      result[id] = {
        ...(c || {}),
        cardImpressions: card?.cardImpressions || null,
        cardClicks: card?.cardClicks || null,
        cardCTR: card?.cardCTR ?? null,
        ctr: null, impressions: null,
        period_start: start, period_end: end,
      };
    }
  }
  return result;
}

// ═══════════════════════════════════════════════
// V15: Fetch playlist titles (Analytics API only gives IDs)
// ═══════════════════════════════════════════════
export async function getPlaylistTitles(playlistIds: string[]): Promise<Record<string, string>> {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  if (!API_KEY || !playlistIds.length) return {};
  const titles: Record<string, string> = {};
  for (let i = 0; i < playlistIds.length; i += 50) {
    const batch = playlistIds.slice(i, i + 50).join(",");
    try {
      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=" + batch + "&maxResults=50&key=" + API_KEY
      );
      const data = await res.json();
      if (data.items) {
        for (const p of data.items) {
          titles[p.id] = p.snippet?.title || p.id;
        }
      }
    } catch (e) {
      console.error("Playlist title fetch failed:", e);
    }
  }
  return titles;
}
