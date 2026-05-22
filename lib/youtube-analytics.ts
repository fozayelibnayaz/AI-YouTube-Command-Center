import { getValidAccessToken, getStoredChannelId } from "./oauth";

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";

function dateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

async function getChannelFilter(): Promise<string> {
  const channelId = await getStoredChannelId();
  if (channelId && channelId.length > 5) {
    return "channel==" + channelId;
  }
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
    console.error("Analytics API error:", data.error.message, "URL:", url);
    throw new Error(data.error.message || "Analytics API error");
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

export async function getVideoAnalytics(videoId: string, daysBack: number = 90): Promise<any> {
  const data = await fetchAnalytics({
    startDate: dateString(daysBack), endDate: dateString(0),
    metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost",
    dimensions: "video", filters: "video==" + videoId,
  });
  return parseRows(data)[0] || null;
}

export async function getVideoCTR(videoId: string, daysBack: number = 365): Promise<any> {
  try {
    const data = await fetchAnalytics({
      startDate: dateString(daysBack), endDate: dateString(0),
      metrics: "impressions,impressionClickThroughRate",
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

export async function getTrafficSources(videoId?: string, daysBack: number = 30): Promise<any[]> {
  const params: any = {
    startDate: dateString(daysBack), endDate: dateString(0),
    metrics: "views,estimatedMinutesWatched,averageViewDuration",
    dimensions: "insightTrafficSourceType", sort: "-views",
  };
  if (videoId) params.filters = "video==" + videoId;
  const data = await fetchAnalytics(params);
  return parseRows(data);
}

export async function getDemographics(daysBack: number = 90): Promise<any> {
  try {
    const [ageGender, geography, devices] = await Promise.all([
      fetchAnalytics({
        startDate: dateString(daysBack), endDate: dateString(0),
        metrics: "viewerPercentage", dimensions: "ageGroup,gender",
      }).then(parseRows).catch(() => []),
      fetchAnalytics({
        startDate: dateString(daysBack), endDate: dateString(0),
        metrics: "views", dimensions: "country", sort: "-views", maxResults: "10",
      }).then(parseRows).catch(() => []),
      fetchAnalytics({
        startDate: dateString(daysBack), endDate: dateString(0),
        metrics: "views,estimatedMinutesWatched", dimensions: "deviceType",
      }).then(parseRows).catch(() => []),
    ]);
    return { ageGender, geography, devices };
  } catch (e) {
    return { ageGender: [], geography: [], devices: [], error: String(e) };
  }
}

export async function getSubscriberGrowth(daysBack: number = 30): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: dateString(daysBack), endDate: dateString(0),
      metrics: "subscribersGained,subscribersLost,views",
      dimensions: "day", sort: "day",
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getDailyViews(daysBack: number = 30): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: dateString(daysBack), endDate: dateString(0),
      metrics: "views,estimatedMinutesWatched,averageViewDuration,likes,comments",
      dimensions: "day", sort: "day",
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getRevenue(daysBack: number = 30): Promise<any> {
  try {
    const data = await fetchAnalytics({
      startDate: dateString(daysBack), endDate: dateString(0),
      metrics: "estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue,grossRevenue,cpm,playbackBasedCpm,adImpressions,monetizedPlaybacks",
    });
    return parseRows(data)[0] || null;
  } catch { return null; }
}

export async function getTopVideos(metric: string = "views", daysBack: number = 30, max: number = 10): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      startDate: dateString(daysBack), endDate: dateString(0),
      metrics: metric, dimensions: "video", sort: "-" + metric, maxResults: String(max),
    });
    return parseRows(data);
  } catch { return []; }
}

export async function getSearchTerms(videoId?: string, daysBack: number = 30): Promise<any[]> {
  try {
    const params: any = {
      startDate: dateString(daysBack), endDate: dateString(0),
      metrics: "views",
      dimensions: "insightTrafficSourceDetail",
      filters: "insightTrafficSourceType==YT_SEARCH",
      sort: "-views", maxResults: "25",
    };
    if (videoId) params.filters += ";video==" + videoId;
    const data = await fetchAnalytics(params);
    return parseRows(data);
  } catch { return []; }
}

/**
 * Get CTR for batch of videos.
 * CTR is finicky - needs LONG date range (365 days) and only returns videos with enough impressions.
 */
async function getBatchCTR(videoIds: string[], daysBack: number = 365): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (videoIds.length === 0) return result;

  // YouTube Analytics API filter limit is 500 chars roughly
  // Each video ID is ~11 chars + comma = 12 chars
  // Safe batch size: 30 videos at a time
  const batchSize = 30;

  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    const filter = "video==" + batch.join(",");

    try {
      const data = await fetchAnalytics({
        startDate: dateString(daysBack),
        endDate: dateString(0),
        metrics: "impressions,impressionClickThroughRate",
        dimensions: "video",
        filters: filter,
        maxResults: String(batchSize),
      });
      const rows = parseRows(data);
      for (const r of rows) {
        result[r.video] = {
          impressions: r.impressions || 0,
          ctr: r.impressionClickThroughRate != null
            ? parseFloat((r.impressionClickThroughRate * 100).toFixed(2))
            : null,
        };
      }
    } catch (e) {
      console.error("CTR batch failed:", e);
    }
  }

  return result;
}

/**
 * Get core analytics for batch of videos (views, retention, watch time, etc.)
 */
async function getBatchCore(videoIds: string[], daysBack: number = 90): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (videoIds.length === 0) return result;

  const batchSize = 50;
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    const filter = "video==" + batch.join(",");

    try {
      const data = await fetchAnalytics({
        startDate: dateString(daysBack),
        endDate: dateString(0),
        metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained",
        dimensions: "video",
        filters: filter,
        maxResults: String(batchSize),
      });
      const rows = parseRows(data);
      for (const r of rows) {
        result[r.video] = r;
      }
    } catch (e) {
      console.error("Core batch failed:", e);
    }
  }

  return result;
}

export async function getBatchVideoAnalytics(videoIds: string[], daysBack: number = 90): Promise<Record<string, any>> {
  if (videoIds.length === 0) return {};

  // Fetch core analytics (90 days) AND CTR (365 days) in parallel
  const [core, ctrMap] = await Promise.all([
    getBatchCore(videoIds, daysBack),
    getBatchCTR(videoIds, 365), // CTR needs longer range
  ]);

  const result: Record<string, any> = {};
  for (const id of videoIds) {
    const c = core[id];
    const ctr = ctrMap[id];
    if (c || ctr) {
      result[id] = {
        ...(c || {}),
        impressions: ctr?.impressions || null,
        ctr: ctr?.ctr ?? null,
      };
    }
  }
  return result;
}
