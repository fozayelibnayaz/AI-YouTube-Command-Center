import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  const apiUrl = process.env.TELEGRAM_API_URL || "https://api.telegram.org";

  const debug: any = {
    timestamp: new Date().toISOString(),
    env: {
      hasToken: !!token,
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 15) + "...",
      hasChatId: !!chatId,
      chatId,
      apiUrl,
    },
    tests: [],
  };

  // Test 1: getMe (verify bot exists)
  try {
    const res = await fetch(apiUrl + "/bot" + token + "/getMe");
    const data = await res.json();
    debug.tests.push({
      name: "getMe",
      httpStatus: res.status,
      ok: data.ok,
      result: data.result,
      error: data.description,
    });
  } catch (e: any) {
    debug.tests.push({ name: "getMe", exception: e.message });
  }

  // Test 2: getChat (verify chat ID is valid)
  try {
    const res = await fetch(apiUrl + "/bot" + token + "/getChat?chat_id=" + encodeURIComponent(chatId));
    const data = await res.json();
    debug.tests.push({
      name: "getChat",
      httpStatus: res.status,
      ok: data.ok,
      chat: data.result,
      error: data.description,
      hint: data.description?.includes("chat not found")
        ? "Bot must be ADDED as member to the chat first"
        : data.description?.includes("Unauthorized")
        ? "Bot token is invalid"
        : null,
    });
  } catch (e: any) {
    debug.tests.push({ name: "getChat", exception: e.message });
  }

  // Test 3: sendMessage (actual send test)
  try {
    const res = await fetch(apiUrl + "/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🔧 DEBUG TEST: " + new Date().toISOString(),
      }),
    });
    const data = await res.json();
    debug.tests.push({
      name: "sendMessage",
      httpStatus: res.status,
      ok: data.ok,
      messageId: data.result?.message_id,
      error: data.description,
      errorCode: data.error_code,
      hint: !data.ok
        ? (data.description?.includes("chat not found")
            ? "ADD THE BOT TO YOUR GROUP/CHANNEL"
            : data.description?.includes("blocked")
            ? "Bot is blocked - unblock it"
            : data.description?.includes("not enough rights")
            ? "Bot needs to be ADMIN in the group"
            : "Check token and chat ID")
        : "✅ Telegram is working!",
    });
  } catch (e: any) {
    debug.tests.push({ name: "sendMessage", exception: e.message });
  }

  return new NextResponse(JSON.stringify(debug, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
