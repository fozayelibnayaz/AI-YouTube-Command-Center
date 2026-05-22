import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  const apiUrl = process.env.TELEGRAM_API_URL || "https://api.telegram.org";

  const debug: any = {
    env: {
      hasToken: !!token,
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 10) + "...",
      hasChatId: !!chatId,
      chatId,
      apiUrl,
    },
    tests: [],
  };

  // Test 1: Verify bot exists
  try {
    const res = await fetch(`${apiUrl}/bot${token}/getMe`);
    const data = await res.json();
    debug.tests.push({
      name: "getMe",
      ok: data.ok,
      result: data.result ? {
        id: data.result.id,
        username: data.result.username,
        first_name: data.result.first_name,
      } : null,
      error: data.description,
    });
  } catch (e: any) {
    debug.tests.push({ name: "getMe", error: e.message });
  }

  // Test 2: Try to send a test message
  try {
    const res = await fetch(`${apiUrl}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🔧 Telegram Debug Test - " + new Date().toISOString(),
      }),
    });
    const data = await res.json();
    debug.tests.push({
      name: "sendMessage",
      ok: data.ok,
      error: data.description,
      hint: data.description?.includes("chat not found")
        ? "Bot needs to be ADDED to the group/channel first. Add bot to chat ID " + chatId
        : data.description?.includes("not enough rights")
        ? "Bot needs admin rights in the group"
        : data.description?.includes("bot was blocked")
        ? "Bot was blocked. Unblock it."
        : null,
    });
  } catch (e: any) {
    debug.tests.push({ name: "sendMessage", error: e.message });
  }

  // Test 3: getChat to verify chat exists
  try {
    const res = await fetch(`${apiUrl}/bot${token}/getChat?chat_id=${chatId}`);
    const data = await res.json();
    debug.tests.push({
      name: "getChat",
      ok: data.ok,
      chat: data.result ? {
        id: data.result.id,
        type: data.result.type,
        title: data.result.title,
      } : null,
      error: data.description,
    });
  } catch (e: any) {
    debug.tests.push({ name: "getChat", error: e.message });
  }

  return NextResponse.json(debug, { status: 200 });
}
