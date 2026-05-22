import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getStoredChannelId } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function safeJson(data: any) {
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function dateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const debug: any = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  const token = await getValidAccessToken();
  if (!token) return safeJson({ error: "No token" });

  const channelId = await getStoredChannelId();
  debug.channelId = channelId;

  // Try multiple variations to find what works
  const variations = [
    {
      name: "ctr_with_channel_id",
      params: {
        ids: "channel==" + channelId,
        startDate: dateString(28),
        endDate: dateString(0),
        metrics: "impressions,impressionClickThroughRate",
      },
    },
    {
      name: "ctr_with_MINE",
      params: {
        ids: "channel==MINE",
        startDate: dateString(28),
        endDate: dateString(0),
        metrics: "impressions,impressionClickThroughRate",
      },
    },
    {
      name: "ctr_90_days",
      params: {
        ids: "channel==" + channelId,
        startDate: dateString(90),
        endDate: dateString(0),
        metrics: "impressions,impressionClickThroughRate",
      },
    },
    {
      name: "ctr_with_video_dimension",
      params: {
        ids: "channel==" + channelId,
        startDate: dateString(90),
        endDate: dateString(0),
        metrics: "impressions,impressionClickThroughRate",
        dimensions: "video",
        maxResults: "5",
      },
    },
    {
      name: "all_metrics_test",
      params: {
        ids: "channel==" + channelId,
        startDate: dateString(28),
        endDate: dateString(0),
        metrics: "views,impressions,impressionClickThroughRate,subscribersGained,estimatedRevenue,cardClicks,cardImpressions,cardClickRate",
      },
    },
  ];

  for (const v of variations) {
    try {
      const url = "https://youtubeanalytics.googleapis.com/v2/reports?" + new URLSearchParams(v.params).toString();
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      const data = await res.json();

      debug.tests.push({
        name: v.name,
        status: res.status,
        url: url,
        response: {
          error: data.error?.message,
          columnHeaders: data.columnHeaders?.map((c: any) => c.name),
          rows: data.rows?.slice(0, 3),
          rowCount: data.rows?.length || 0,
        },
      });
    } catch (e: any) {
      debug.tests.push({ name: v.name, error: e.message });
    }
  }

  return safeJson(debug);
}
