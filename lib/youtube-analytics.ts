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

// VALID METRICS (after YouTube API changes):
// views, estimatedMinutesWatched, averageViewDuration, averageViewPercentage,
// likes, dislikes, comments, shares, subscribersGained, subscribersLost,
// videosAddedToPlaylists, videosRemovedFromPlaylists, cardImpressions,
// cardClicks, cardClickRate, cardTeaserImpressions, cardTeaserClicks,
// cardTeaserClickRate, annotationImpressions, annotationClickableImpressions,
// annotationClicks, annotationClickThroughRate, annotationClosableImpressions,
// annotationCloses, annotationCloseRate, estimatedRevenue, estimatedAdRevenue,
// grossRevenue, cpm, playbackBasedCpm, adImpressions, monetizedPlaybacks

export async function getVideoAnalytics(videoId: string, daysBack: number = 90): Promise<any> {
  try {
    const data = await fetchAnalytics({
      startDate: dateString(daysBack), endDate: dateString(0),
      metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,dislikes,comments,shares,subscribersGained,subscribersLost,cardImpressions,cardClicks,cardClickRate",
      dimensions: "video", filters: "video==" + videoId,
    });
    return parseRows(data)[0] || null;
  } catch (e) {
    console.error("getVideoAnalytics:", e);
    return null;
  }
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
  try {
    const params: any = {
      startDate: dateString(daysBack), endDate: dateString(0),
      metrics: "views,estimatedMinutesWatched,averageViewDuration",
      dimensions: "insightTrafficSourceType", sort: "-views",
    };
    if (videoId) params.filters = "video==" + videoId;
    const data = await fetchAnalytics(params);
    return parseRows(data);
  } catch { return []; }
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
      metrics: "estimatedRevenue,estimatedAdRevenue,grossRevenue,cpm,playbackBasedCpm,adImpressions,monetizedPlaybacks",
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
 * Get card CTR (closest equivalent to impression CTR available via API)
 * Note: True impression CTR requires YouTube Studio - not exposed in API
 */
async function getBatchCardMetrics(videoIds: string[], daysBack: number = 365): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (videoIds.length === 0) return result;
  const batchSize = 30;

  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    const filter = "video==" + batch.join(",");
    try {
      const data = await fetchAnalytics({
        startDate: dateString(daysBack),
        endDate: dateString(0),
        metrics: "cardImpressions,cardClicks,cardClickRate",
        dimensions: "video",
        filters: filter,
        maxResults: String(batchSize),
      });
      const rows = parseRows(data);
      for (const r of rows) {
        result[r.video] = {
          cardImpressions: r.cardImpressions || 0,
          cardClicks: r.cardClicks || 0,
          cardCTR: r.cardClickRate != null ? parseFloat((r.cardClickRate * 100).toFixed(2)) : null,
        };
      }
    } catch (e) {
      console.error("Card metrics batch failed:", e);
    }
  }
  return result;
}

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
        metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,dislikes,comments,shares,subscribersGained",
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

  // Fetch all in parallel
  const [core, cards] = await Promise.all([
    getBatchCore(videoIds, daysBack),
    getBatchCardMetrics(videoIds, 365),
  ]);

  const result: Record<string, any> = {};
  for (const id of videoIds) {
    const c = core[id];
    const card = cards[id];
    if (c || card) {
      result[id] = {
        ...(c || {}),
        // Card-based engagement (the closest to CTR we can get from API)
        cardImpressions: card?.cardImpressions || null,
        cardClicks: card?.cardClicks || null,
        cardCTR: card?.cardCTR ?? null,
        // CTR/impressions NOT available via API - YouTube Studio only
        ctr: null,
        impressions: null,
      };
    }
  }
  return result;
}
