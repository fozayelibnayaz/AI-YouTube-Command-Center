import { getValidAccessToken } from "./oauth";

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";

function dateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

async function fetchAnalytics(params: Record<string, string>): Promise<any> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Not authenticated - please connect YouTube account");

  const url = ANALYTICS_BASE + "?" + new URLSearchParams(params).toString();
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Analytics API error");
  return data;
}

// Parse analytics response into easy object
function parseRows(data: any): any[] {
  if (!data.rows || !data.columnHeaders) return [];
  const headers = data.columnHeaders.map((c: any) => c.name);
  return data.rows.map((row: any[]) => {
    const obj: any = {};
    headers.forEach((h: string, i: number) => obj[h] = row[i]);
    return obj;
  });
}

// ─── ALL-TIME video performance with REAL CTR + Retention ──────────────
export async function getVideoAnalytics(videoId: string, daysBack: number = 90): Promise<any> {
  const data = await fetchAnalytics({
    ids: "channel==MINE",
    startDate: dateString(daysBack),
    endDate: dateString(0),
    metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost,cardClickRate,cardImpressions,cardClicks,cardTeaserClickRate",
    dimensions: "video",
    filters: "video==" + videoId,
  });
  const rows = parseRows(data);
  return rows[0] || null;
}

// ─── CTR + Impressions for a video ──────────────────────────────────────
export async function getVideoCTR(videoId: string, daysBack: number = 90): Promise<any> {
  try {
    const data = await fetchAnalytics({
      ids: "channel==MINE",
      startDate: dateString(daysBack),
      endDate: dateString(0),
      metrics: "impressions,impressionClickThroughRate",
      dimensions: "video",
      filters: "video==" + videoId,
    });
    const rows = parseRows(data);
    return rows[0] || null;
  } catch {
    return null;
  }
}

// ─── Retention curve (audience drop-off graph) ──────────────────────────
export async function getRetentionCurve(videoId: string): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      ids: "channel==MINE",
      startDate: dateString(365),
      endDate: dateString(0),
      metrics: "audienceWatchRatio,relativeRetentionPerformance",
      dimensions: "elapsedVideoTimeRatio",
      filters: "video==" + videoId,
      sort: "elapsedVideoTimeRatio",
    });
    return parseRows(data);
  } catch {
    return [];
  }
}

// ─── Traffic sources (where views come from) ────────────────────────────
export async function getTrafficSources(videoId?: string, daysBack: number = 30): Promise<any[]> {
  const params: any = {
    ids: "channel==MINE",
    startDate: dateString(daysBack),
    endDate: dateString(0),
    metrics: "views,estimatedMinutesWatched,averageViewDuration",
    dimensions: "insightTrafficSourceType",
    sort: "-views",
  };
  if (videoId) params.filters = "video==" + videoId;
  const data = await fetchAnalytics(params);
  return parseRows(data);
}

// ─── Audience demographics ──────────────────────────────────────────────
export async function getDemographics(daysBack: number = 90): Promise<any> {
  try {
    const [ageGender, geography, devices] = await Promise.all([
      fetchAnalytics({
        ids: "channel==MINE",
        startDate: dateString(daysBack),
        endDate: dateString(0),
        metrics: "viewerPercentage",
        dimensions: "ageGroup,gender",
      }).then(parseRows).catch(() => []),
      fetchAnalytics({
        ids: "channel==MINE",
        startDate: dateString(daysBack),
        endDate: dateString(0),
        metrics: "views",
        dimensions: "country",
        sort: "-views",
        maxResults: "10",
      }).then(parseRows).catch(() => []),
      fetchAnalytics({
        ids: "channel==MINE",
        startDate: dateString(daysBack),
        endDate: dateString(0),
        metrics: "views,estimatedMinutesWatched",
        dimensions: "deviceType",
      }).then(parseRows).catch(() => []),
    ]);
    return { ageGender, geography, devices };
  } catch (e) {
    return { ageGender: [], geography: [], devices: [], error: String(e) };
  }
}

// ─── Subscriber growth over time ────────────────────────────────────────
export async function getSubscriberGrowth(daysBack: number = 30): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      ids: "channel==MINE",
      startDate: dateString(daysBack),
      endDate: dateString(0),
      metrics: "subscribersGained,subscribersLost,views",
      dimensions: "day",
      sort: "day",
    });
    return parseRows(data);
  } catch {
    return [];
  }
}

// ─── Daily channel views over time ──────────────────────────────────────
export async function getDailyViews(daysBack: number = 30): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      ids: "channel==MINE",
      startDate: dateString(daysBack),
      endDate: dateString(0),
      metrics: "views,estimatedMinutesWatched,averageViewDuration,likes,comments",
      dimensions: "day",
      sort: "day",
    });
    return parseRows(data);
  } catch {
    return [];
  }
}

// ─── Revenue (if monetized) ──────────────────────────────────────────────
export async function getRevenue(daysBack: number = 30): Promise<any> {
  try {
    const data = await fetchAnalytics({
      ids: "channel==MINE",
      startDate: dateString(daysBack),
      endDate: dateString(0),
      metrics: "estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue,grossRevenue,cpm,playbackBasedCpm,adImpressions,monetizedPlaybacks",
    });
    const rows = parseRows(data);
    return rows[0] || null;
  } catch {
    return null;
  }
}

// ─── Top videos by metric ────────────────────────────────────────────────
export async function getTopVideos(metric: string = "views", daysBack: number = 30, max: number = 10): Promise<any[]> {
  try {
    const data = await fetchAnalytics({
      ids: "channel==MINE",
      startDate: dateString(daysBack),
      endDate: dateString(0),
      metrics: metric,
      dimensions: "video",
      sort: "-" + metric,
      maxResults: String(max),
    });
    return parseRows(data);
  } catch {
    return [];
  }
}

// ─── Search terms viewers used to find video ────────────────────────────
export async function getSearchTerms(videoId?: string, daysBack: number = 30): Promise<any[]> {
  try {
    const params: any = {
      ids: "channel==MINE",
      startDate: dateString(daysBack),
      endDate: dateString(0),
      metrics: "views",
      dimensions: "insightTrafficSourceDetail",
      filters: "insightTrafficSourceType==YT_SEARCH",
      sort: "-views",
      maxResults: "25",
    };
    if (videoId) params.filters += ";video==" + videoId;
    const data = await fetchAnalytics(params);
    return parseRows(data);
  } catch {
    return [];
  }
}

// ─── BATCH: Get all enriched analytics for multiple videos ───────────────
export async function getBatchVideoAnalytics(videoIds: string[], daysBack: number = 90): Promise<Record<string, any>> {
  if (videoIds.length === 0) return {};

  try {
    // YouTube Analytics supports up to 200 filters in a single video== filter
    const batches: string[][] = [];
    for (let i = 0; i < videoIds.length; i += 200) {
      batches.push(videoIds.slice(i, i + 200));
    }

    const result: Record<string, any> = {};

    for (const batch of batches) {
      const filter = "video==" + batch.join(",");

      // Get main analytics + CTR in parallel
      const [analytics, ctr] = await Promise.all([
        fetchAnalytics({
          ids: "channel==MINE",
          startDate: dateString(daysBack),
          endDate: dateString(0),
          metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained",
          dimensions: "video",
          filters: filter,
          maxResults: "200",
        }).then(parseRows).catch(() => []),
        fetchAnalytics({
          ids: "channel==MINE",
          startDate: dateString(daysBack),
          endDate: dateString(0),
          metrics: "impressions,impressionClickThroughRate",
          dimensions: "video",
          filters: filter,
          maxResults: "200",
        }).then(parseRows).catch(() => []),
      ]);

      const ctrMap: Record<string, any> = {};
      for (const c of ctr) ctrMap[c.video] = c;

      for (const a of analytics) {
        result[a.video] = {
          ...a,
          impressions: ctrMap[a.video]?.impressions || null,
          ctr: ctrMap[a.video]?.impressionClickThroughRate
            ? parseFloat((ctrMap[a.video].impressionClickThroughRate * 100).toFixed(2))
            : null,
        };
      }
    }

    return result;
  } catch (e) {
    console.error("getBatchVideoAnalytics error:", e);
    return {};
  }
}
