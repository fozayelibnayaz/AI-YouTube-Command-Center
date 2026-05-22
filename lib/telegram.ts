const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
let CHAT_ID_RAW = process.env.TELEGRAM_CHAT_ID || "";
const TG_API = process.env.TELEGRAM_API_URL || "https://api.telegram.org";

// AUTO-CORRECT chat ID format
// Telegram group/channel IDs MUST start with -100
function normalizeChatId(id: string): string {
  const cleaned = id.trim();
  if (!cleaned) return "";

  // Already correct format
  if (cleaned.startsWith("-100")) return cleaned;

  // Has minus but missing 100 (e.g., -1003813320209 typed as -3813320209)
  if (cleaned.startsWith("-") && !cleaned.startsWith("-100")) {
    return "-100" + cleaned.substring(1);
  }

  // Numeric starting with 100 (e.g., 1003813320209) - missing minus
  if (cleaned.startsWith("100") && cleaned.length >= 13) {
    return "-" + cleaned;
  }

  // Plain user ID (positive number, short) - leave as-is
  if (/^\d+$/.test(cleaned) && cleaned.length < 12) {
    return cleaned;
  }

  // Long positive number = probably group ID missing prefix
  if (/^\d+$/.test(cleaned) && cleaned.length >= 12) {
    return "-100" + cleaned;
  }

  return cleaned;
}

const CHAT_ID = normalizeChatId(CHAT_ID_RAW);

function isConfigured(): boolean {
  return (
    !!BOT_TOKEN && !BOT_TOKEN.includes("your_") && BOT_TOKEN.length > 20 &&
    !!CHAT_ID && !CHAT_ID.includes("your_")
  );
}

function isGroup(): boolean {
  return CHAT_ID?.startsWith("-") ?? false;
}

const emoji: Record<string, string> = {
  success: "✅", error: "🚨", warning: "⚠️", info: "ℹ️",
  viral: "🔥", analytics: "📊", milestone: "🏆", insight: "🧠",
  team: "👥", alert: "🔔", task: "📋", report: "📈",
};

function ts(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short",
  });
}

export interface TelegramOptions { silent?: boolean; pin?: boolean; }

export async function sendTelegram(
  type: string, title: string, message: string,
  data?: Record<string, string | number>, options?: TelegramOptions
): Promise<{ success: boolean; error?: string; message_id?: number }> {
  if (!isConfigured()) return { success: false, error: "Telegram env vars missing" };

  let text = (emoji[type] || "📢") + " *" + title + "*\n";
  text += "━━━━━━━━━━━━━━━━━━━━━━━\n";
  text += message + "\n";
  if (data && Object.keys(data).length > 0) {
    text += "\n📋 *Details*\n";
    for (const [k, v] of Object.entries(data)) text += "• " + k + ": `" + v + "`\n";
  }
  text += "\n⏰ " + ts();
  if (isGroup()) text += " | 👥 Team";

  try {
    const body: any = {
      chat_id: CHAT_ID, text,
      parse_mode: "Markdown", disable_web_page_preview: true,
    };
    if (options?.silent) body.disable_notification = true;

    const res = await fetch(TG_API + "/bot" + BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) {
      console.error("Telegram error:", json, "Used chat_id:", CHAT_ID);
      return { success: false, error: (json.description || "Telegram rejected") + " (chat_id used: " + CHAT_ID + ")" };
    }
    if (options?.pin && isGroup() && json.result?.message_id) {
      await fetch(TG_API + "/bot" + BOT_TOKEN + "/pinChatMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, message_id: json.result.message_id }),
      });
    }
    return { success: true, message_id: json.result?.message_id };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function sendWithButtons(
  type: string, title: string, message: string,
  buttons: Array<{ text: string; url: string }>,
  data?: Record<string, string | number>
): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured()) return { success: false, error: "Telegram env vars missing" };

  let text = (emoji[type] || "📢") + " *" + title + "*\n";
  text += "━━━━━━━━━━━━━━━━━━━━━━━\n";
  text += message + "\n";
  if (data) {
    text += "\n📋 *Details*\n";
    for (const [k, v] of Object.entries(data)) text += "• " + k + ": `" + v + "`\n";
  }
  text += "\n⏰ " + ts();

  const keyboard: Array<Array<{ text: string; url: string }>> = [];
  for (let i = 0; i < buttons.length; i += 2) keyboard.push(buttons.slice(i, i + 2));

  try {
    const res = await fetch(TG_API + "/bot" + BOT_TOKEN + "/sendMessage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID, text, parse_mode: "Markdown",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard },
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      console.error("Telegram error:", json);
      return { success: false, error: (json.description || "Telegram rejected") + " (chat_id: " + CHAT_ID + ")" };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function sendPhoto(
  photoUrl: string, caption: string,
  buttons?: Array<{ text: string; url: string }>
): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured()) return { success: false, error: "Not configured" };
  try {
    const body: any = { chat_id: CHAT_ID, photo: photoUrl, caption, parse_mode: "Markdown" };
    if (buttons) {
      const keyboard: Array<Array<{ text: string; url: string }>> = [];
      for (let i = 0; i < buttons.length; i += 2) keyboard.push(buttons.slice(i, i + 2));
      body.reply_markup = { inline_keyboard: keyboard };
    }
    const res = await fetch(TG_API + "/bot" + BOT_TOKEN + "/sendPhoto", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) return { success: false, error: json.description };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
}

export const notify = {
  systemOnline: () => sendTelegram("success", "System Online", "AI YouTube Command Center is active."),
  analyticsSynced: (count: number) => sendTelegram("analytics", "Analytics Synced", "Latest YouTube data pulled.", { "Videos Synced": count }, { silent: true }),
  viralVideo: (title: string, views: number, ctr: number, videoId: string) =>
    sendWithButtons("viral", "VIRAL ALERT!", "A video is going viral!",
      [{ text: "Watch", url: "https://youtube.com/watch?v=" + videoId }, { text: "Analytics", url: "https://studio.youtube.com" }],
      { Video: title.substring(0, 45), Views: views.toLocaleString(), CTR: ctr + "%" }
    ),
  lowCTR: (title: string, ctr: number, videoId: string) =>
    sendWithButtons("warning", "Low CTR Alert", "Video needs new thumbnail!",
      [{ text: "Watch", url: "https://youtube.com/watch?v=" + videoId }, { text: "Edit", url: "https://studio.youtube.com/video/" + videoId }],
      { Video: title.substring(0, 45), "Current CTR": ctr + "%", "Target CTR": ">4%" }
    ),
  lowRetention: (title: string, retention: number, videoId: string) =>
    sendWithButtons("warning", "Low Retention Alert", "Video retention needs work.",
      [{ text: "Watch", url: "https://youtube.com/watch?v=" + videoId }],
      { Video: title.substring(0, 45), Retention: retention + "%", Target: ">35%" }
    ),
  milestone: (type: string, value: string) =>
    sendTelegram("milestone", "MILESTONE!", "Congratulations team!", { Achievement: type, Value: value }, { pin: true }),
  newVideo: (title: string, videoId: string, thumbnailUrl?: string) => {
    if (thumbnailUrl) {
      return sendPhoto(thumbnailUrl, "*New Video Live!*\n\n" + title,
        [{ text: "Watch", url: "https://youtube.com/watch?v=" + videoId }, { text: "Share", url: "https://t.me/share/url?url=https://youtu.be/" + videoId }]
      );
    }
    return sendWithButtons("success", "New Video Live!", "New video is live!",
      [{ text: "Watch", url: "https://youtube.com/watch?v=" + videoId }],
      { Title: title.substring(0, 50) }
    );
  },
  dailyReport: (stats: any) =>
    sendTelegram("report", "Daily Report", "Channel performance today:", stats, { silent: true }),
  weeklyReport: (stats: any) =>
    sendTelegram("report", "Weekly Report", "Week summary:", stats, { pin: true }),
  taskAssigned: (taskTitle: string, assignedTo: string, priority: string) =>
    sendTelegram("task", "New Task", assignedTo + " has a task.",
      { Task: taskTitle.substring(0, 45), Priority: priority.toUpperCase(), "Assigned To": assignedTo }),
  aiInsightReady: (videoTitle: string, score: number, videoId: string) =>
    sendWithButtons("insight", "AI Analysis Complete", "Insights ready for: " + videoTitle.substring(0, 40),
      [{ text: "Dashboard", url: (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") + "/dashboard" }, { text: "Watch", url: "https://youtube.com/watch?v=" + videoId }],
      { Video: videoTitle.substring(0, 45), Score: score + "/100" }
    ),
  competitorAlert: (competitor: string, videoTitle: string, views: number) =>
    sendTelegram("alert", "Competitor Alert", "Competitor posted viral video.",
      { Channel: competitor, Video: videoTitle.substring(0, 40), Views: views.toLocaleString() }),
  error: (location: string, error: string) =>
    sendTelegram("error", "System Error", "Error needs attention.", { Location: location, Error: error.substring(0, 80) }),
};

// Export the normalized chat ID for debugging
export const NORMALIZED_CHAT_ID = CHAT_ID;
export const RAW_CHAT_ID = CHAT_ID_RAW;
