import { NextRequest, NextResponse } from "next/server";
import {
  getDemographics, getSubscriberGrowth, getDailyViews,
  getRevenue, getTrafficSources, getTopVideos,
  getRetentionCurve, getSearchTerms
} from "@/lib/youtube-analytics";
import { getValidAccessToken } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action") || "all";
  const videoId = new URL(req.url).searchParams.get("videoId");
  const days = parseInt(new URL(req.url).searchParams.get("days") || "30");

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({
      success: false,
      error: "Not authenticated. Please connect your YouTube account first.",
      needsAuth: true,
    }, { status: 401 });
  }

  try {
    let data: any = {};

    switch (action) {
      case "demographics":
        data = await getDemographics(days);
        break;
      case "subscribers":
        data = await getSubscriberGrowth(days);
        break;
      case "daily":
        data = await getDailyViews(days);
        break;
      case "revenue":
        data = await getRevenue(days);
        break;
      case "traffic":
        data = await getTrafficSources(videoId || undefined, days);
        break;
      case "top":
        const metric = new URL(req.url).searchParams.get("metric") || "views";
        data = await getTopVideos(metric, days);
        break;
      case "retention":
        if (!videoId) return NextResponse.json({ success: false, error: "videoId required" }, { status: 400 });
        data = await getRetentionCurve(videoId);
        break;
      case "searchTerms":
        data = await getSearchTerms(videoId || undefined, days);
        break;
      case "all":
        const [demographics, subscribers, daily, revenue, traffic] = await Promise.all([
          getDemographics(days).catch(() => null),
          getSubscriberGrowth(days).catch(() => null),
          getDailyViews(days).catch(() => null),
          getRevenue(days).catch(() => null),
          getTrafficSources(undefined, days).catch(() => null),
        ]);
        data = { demographics, subscribers, daily, revenue, traffic };
        break;
      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data, action, days });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
