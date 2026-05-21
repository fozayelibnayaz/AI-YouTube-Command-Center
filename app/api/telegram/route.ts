import { NextRequest, NextResponse } from "next/server";
import { sendTelegram, sendWithButtons, sendPhoto, notify } from "@/lib/telegram";

export async function GET() {
  const result = await notify.systemOnline();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();
    let result;

    switch (action) {
      case "custom":
        result = await sendTelegram(
          payload.type || "info",
          payload.title,
          payload.message,
          payload.data,
          payload.options
        );
        break;

      case "with_buttons":
        result = await sendWithButtons(
          payload.type,
          payload.title,
          payload.message,
          payload.buttons,
          payload.data
        );
        break;

      case "photo":
        result = await sendPhoto(payload.photoUrl, payload.caption, payload.buttons);
        break;

      case "viral":
        result = await notify.viralVideo(
          payload.title,
          payload.views,
          payload.ctr,
          payload.videoId
        );
        break;

      case "low_ctr":
        // payload MUST include the actual lowest CTR video data
        // title, ctr, videoId are required
        if (!payload.title || payload.ctr === undefined || !payload.videoId) {
          return NextResponse.json(
            { success: false, error: "low_ctr requires title, ctr, and videoId" },
            { status: 400 }
          );
        }
        result = await notify.lowCTR(
          payload.title,
          payload.ctr,
          payload.videoId
        );
        break;

      case "low_retention":
        result = await notify.lowRetention(
          payload.title,
          payload.retention,
          payload.videoId
        );
        break;

      case "milestone":
        result = await notify.milestone(payload.type, payload.value);
        break;

      case "new_video":
        result = await notify.newVideo(
          payload.title,
          payload.videoId,
          payload.thumbnailUrl
        );
        break;

      case "daily_report":
        result = await notify.dailyReport(payload.stats);
        break;

      case "weekly_report":
        result = await notify.weeklyReport(payload.stats);
        break;

      case "task_assigned":
        result = await notify.taskAssigned(
          payload.taskTitle,
          payload.assignedTo,
          payload.priority
        );
        break;

      case "ai_insight":
        result = await notify.aiInsightReady(
          payload.videoTitle,
          payload.score,
          payload.videoId
        );
        break;

      case "competitor":
        result = await notify.competitorAlert(
          payload.competitor,
          payload.videoTitle,
          payload.views
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Unknown action: " + action },
          { status: 400 }
        );
    }

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
