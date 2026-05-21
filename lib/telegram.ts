const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const TG_API = process.env.TELEGRAM_API_URL || "https://api.telegram.org";

function isConfigured(): boolean {
  return (
    !!BOT_TOKEN &&
    !BOT_TOKEN.includes("your_") &&
    BOT_TOKEN !== "skip_for_now" &&
    !!CHAT_ID &&
    !CHAT_ID.includes("your_") &&
    CHAT_ID !== "skip_for_now"
  );
}

function isGroup(): boolean {
  return CHAT_ID?.startsWith("-") ?? false;
}

const emoji: Record<string, string> = {
  success: "✅",
  error: "🚨",
  warning: "⚠️",
  info: "ℹ️",
  viral: "🔥",
  analytics: "📊",
  milestone: "🏆",
  insight: "🧠",
  team: "👥",
  alert: "🔔",
  task: "📋",
  report: "📈",
};

function ts(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export interface TelegramOptions {
  silent?: boolean;
  pin?: boolean;
}

export async function sendTelegram(
  type: string,
  title: string,
  message: string,
  data?: Record<string, string | number>,
  options?: TelegramOptions
): Promise<{ success: boolean; error?: string; message_id?: number }> {
  if (!isConfigured()) {
    return { success: false, error: "Telegram not configured" };
  }

  let text = (emoji[type] || "📢") + " *" + title + "*\n";
  text += "━━━━━━━━━━━━━━━━━━━━━━━\n";
  text += message + "\n";

  if (data && Object.keys(data).length > 0) {
    text += "\n📋 *Details*\n";
    for (const [k, v] of Object.entries(data)) {
      text += "• " + k + ": `" + v + "`\n";
    }
  }

  text += "\n⏰ " + ts();
  if (isGroup()) text += " | 👥 Team Alert";

  try {
    const body: any = {
      chat_id: CHAT_ID,
      text: text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    };

    if (options?.silent) body.disable_notification = true;

    const res = await fetch(
      TG_API + "/bot" + BOT_TOKEN + "/sendMessage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const json = await res.json();
    if (!json.ok) throw new Error(json.description);

    if (options?.pin && isGroup() && json.result?.message_id) {
      await fetch(TG_API + "/bot" + BOT_TOKEN + "/pinChatMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          message_id: json.result.message_id,
        }),
      });
    }

    return { success: true, message_id: json.result?.message_id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

export async function sendWithButtons(
  type: string,
  title: string,
  message: string,
  buttons: Array<{ text: string; url: string }>,
  data?: Record<string, string | number>
): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured()) return { success: false, error: "Not configured" };

  let text = (emoji[type] || "📢") + " *" + title + "*\n";
  text += "━━━━━━━━━━━━━━━━━━━━━━━\n";
  text += message + "\n";

  if (data) {
    text += "\n📋 *Details*\n";
    for (const [k, v] of Object.entries(data)) {
      text += "• " + k + ": `" + v + "`\n";
    }
  }

  text += "\n⏰ " + ts();

  const keyboard: Array<Array<{ text: string; url: string }>> = [];
  for (let i = 0; i < buttons.length; i += 2) {
    keyboard.push(buttons.slice(i, i + 2));
  }

  try {
    const res = await fetch(
      TG_API + "/bot" + BOT_TOKEN + "/sendMessage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard },
        }),
      }
    );

    const json = await res.json();
    if (!json.ok) throw new Error(json.description);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

export async function sendPhoto(
  photoUrl: string,
  caption: string,
  buttons?: Array<{ text: string; url: string }>
): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured()) return { success: false, error: "Not configured" };

  try {
    const body: any = {
      chat_id: CHAT_ID,
      photo: photoUrl,
      caption: caption,
      parse_mode: "Markdown",
    };

    if (buttons) {
      const keyboard: Array<Array<{ text: string; url: string }>> = [];
      for (let i = 0; i < buttons.length; i += 2) {
        keyboard.push(buttons.slice(i, i + 2));
      }
      body.reply_markup = { inline_keyboard: keyboard };
    }

    const res = await fetch(
      TG_API + "/bot" + BOT_TOKEN + "/sendPhoto",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const json = await res.json();
    if (!json.ok) throw new Error(json.description);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

export const notify = {
  systemOnline: () =>
    sendTelegram(
      "success",
      "System Online",
      "AI YouTube Command Center is active. Team will receive automated alerts here."
    ),

  analyticsSynced: (count: number) =>
    sendTelegram(
      "analytics",
      "Analytics Synced",
      "Latest YouTube data has been pulled.",
      { "Videos Synced": count },
      { silent: true }
    ),

  viralVideo: (title: string, views: number, ctr: number, videoId: string) =>
    sendWithButtons(
      "viral",
      "VIRAL ALERT!",
      "Team, a video is going viral! Time to capitalize.",
      [
        { text: "Watch Video", url: "https://youtube.com/watch?v=" + videoId },
        { text: "View Analytics", url: "https://studio.youtube.com" },
      ],
      {
        Video: title.substring(0, 45),
        Views: views.toLocaleString(),
        CTR: ctr + "%",
        Action: "Boost on social media NOW",
      }
    ),

  // Fixed: now takes the actual lowest CTR video data
  lowCTR: (title: string, ctr: number, videoId: string) =>
    sendWithButtons(
      "warning",
      "Low CTR Alert",
      "Designers - this video needs a new thumbnail urgently!",
      [
        { text: "Watch", url: "https://youtube.com/watch?v=" + videoId },
        {
          text: "Edit in Studio",
          url: "https://studio.youtube.com/video/" + videoId,
        },
      ],
      {
        Video: title.substring(0, 45),
        "Current CTR": ctr + "%",
        "Target CTR": "above 4%",
        "Action Required": "New thumbnail design",
      }
    ),

  lowRetention: (title: string, retention: number, videoId: string) =>
    sendWithButtons(
      "warning",
      "Low Retention Alert",
      "Editors - this video has retention issues. Need to review the hook.",
      [{ text: "Watch", url: "https://youtube.com/watch?v=" + videoId }],
      {
        Video: title.substring(0, 45),
        Retention: retention + "%",
        Target: "above 35%",
        "Fix Needed": "First 30 seconds hook",
      }
    ),

  milestone: (type: string, value: string) =>
    sendTelegram(
      "milestone",
      "MILESTONE REACHED!",
      "Congratulations team! We hit a new milestone.",
      { Achievement: type, Value: value },
      { pin: true }
    ),

  newVideo: (title: string, videoId: string, thumbnailUrl?: string) => {
    if (thumbnailUrl) {
      return sendPhoto(
        thumbnailUrl,
        "*New Video Live!*\n\n" +
          title +
          "\n\nLet us promote this everywhere!",
        [
          {
            text: "Watch",
            url: "https://youtube.com/watch?v=" + videoId,
          },
          {
            text: "Share",
            url:
              "https://t.me/share/url?url=https://youtu.be/" + videoId,
          },
        ]
      );
    }
    return sendWithButtons(
      "success",
      "New Video Live!",
      "Team, our new video is live! Time to promote.",
      [
        {
          text: "Watch and Share",
          url: "https://youtube.com/watch?v=" + videoId,
        },
      ],
      { Title: title.substring(0, 50) }
    );
  },

  dailyReport: (stats: {
    views: number;
    subs: number;
    ctr: number;
    topVideo: string;
    revenue: number;
  }) =>
    sendTelegram(
      "report",
      "Daily Report",
      "Here is how the channel performed today:",
      {
        "Total Views": stats.views.toLocaleString(),
        "New Subscribers": stats.subs.toLocaleString(),
        "Avg CTR": stats.ctr + "%",
        "Top Video": stats.topVideo.substring(0, 35),
        "Est Revenue": "$" + stats.revenue.toFixed(2),
      },
      { silent: true }
    ),

  weeklyReport: (stats: any) =>
    sendTelegram(
      "report",
      "Weekly Performance Report",
      "This week summary for the team:",
      stats,
      { pin: true }
    ),

  taskAssigned: (
    taskTitle: string,
    assignedTo: string,
    priority: string
  ) =>
    sendTelegram(
      "task",
      "New Task Assigned",
      assignedTo + " has a new task assigned.",
      {
        Task: taskTitle.substring(0, 45),
        Priority: priority.toUpperCase(),
        "Assigned To": assignedTo,
      }
    ),

  aiInsightReady: (
    videoTitle: string,
    score: number,
    videoId: string
  ) =>
    sendWithButtons(
      "insight",
      "AI Analysis Complete",
      "New insights available for: " + videoTitle.substring(0, 40),
      [
        {
          text: "View Dashboard",
          url:
            (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") +
            "/dashboard",
        },
        {
          text: "Watch Video",
          url: "https://youtube.com/watch?v=" + videoId,
        },
      ],
      {
        Video: videoTitle.substring(0, 45),
        Score: score + "/100",
        Status: "Ready to review",
      }
    ),

  competitorAlert: (
    competitor: string,
    videoTitle: string,
    views: number
  ) =>
    sendTelegram(
      "alert",
      "Competitor Alert",
      "A competitor posted a viral video. Time to analyze.",
      {
        Channel: competitor,
        Video: videoTitle.substring(0, 40),
        Views: views.toLocaleString(),
        Action: "Study and create response",
      }
    ),

  error: (location: string, error: string) =>
    sendTelegram("error", "System Error", "An error needs attention.", {
      Location: location,
      Error: error.substring(0, 80),
    }),
};
