import { NextRequest, NextResponse } from "next/server";
import {
  getDemographics, getSubscriberGrowth, getDailyViews,
  getRevenue, getTrafficSources, getTopVideos,
  getRetentionCurve, getSearchTerms
} from "@/lib/youtube-analytics";
import { getValidAccessToken } from "@/lib/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeJson(data: any, status: number = 200) {
  return new NextResponse(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
}

function dateFromDaysBack(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "all";
  const videoId = searchParams.get("videoId") || undefined;
  const days = parseInt(searchParams.get("days") || "30");
  const startDate = searchParams.get("startDate") || dateFromDaysBack(days);
  const endDate = searchParams.get("endDate") || today();

  const token = await getValidAccessToken();
  if (!token) {
    return safeJson({
      success: false,
      error: "Not authenticated. Connect YouTube account first.",
      needsAuth: true,
    }, 401);
  }

  try {
    let data: any = {};

    switch (action) {
      case "demographics":
        data = await getDemographics(startDate, endDate);
        break;
      case "subscribers":
        data = await getSubscriberGrowth(startDate, endDate);
        break;
      case "daily":
        data = await getDailyViews(startDate, endDate);
        break;
      case "revenue":
        data = await getRevenue(startDate, endDate);
        break;
      case "traffic":
        data = await getTrafficSources(videoId, startDate, endDate);
        break;
      case "top":
        const metric = searchParams.get("metric") || "views";
        data = await getTopVideos(metric, startDate, endDate);
        break;
      case "retention":
        if (!videoId) return safeJson({ success: false, error: "videoId required" }, 400);
        data = await getRetentionCurve(videoId);
        break;
      case "searchTerms":
        data = await getSearchTerms(videoId, startDate, endDate);
        break;
      case "all":
        const [demographics, subscribers, daily, revenue, traffic] = await Promise.all([
          getDemographics(startDate, endDate).catch(() => null),
          getSubscriberGrowth(startDate, endDate).catch(() => null),
          getDailyViews(startDate, endDate).catch(() => null),
          getRevenue(startDate, endDate).catch(() => null),
          getTrafficSources(undefined, startDate, endDate).catch(() => null),
        ]);
        data = { demographics, subscribers, daily, revenue, traffic };
        break;
      default:
        return safeJson({ success: false, error: "Unknown action" }, 400);
    }

    return safeJson({ success: true, data, action, startDate, endDate });
  } catch (e: any) {
    return safeJson({ success: false, error: String(e?.message || e) }, 500);
  }
}
