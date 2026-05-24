import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const debug: any = {
    timestamp: new Date().toISOString(),
    env: {
      hasGroq: !!process.env.GROQ_API_KEY,
      groqLength: (process.env.GROQ_API_KEY || "").length,
      groqPrefix: (process.env.GROQ_API_KEY || "").substring(0, 10),
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      openaiLength: (process.env.OPENAI_API_KEY || "").length,
      openaiPrefix: (process.env.OPENAI_API_KEY || "").substring(0, 10),
    },
    tests: [],
  };

  // Test Groq directly
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.GROQ_API_KEY },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "Say hello in 5 words" }],
          temperature: 0.5, max_tokens: 50,
        }),
      });
      const data = await res.json();
      debug.tests.push({
        name: "groq_api",
        status: res.status,
        ok: !data.error,
        response: data.choices?.[0]?.message?.content,
        error: data.error?.message,
      });
    } catch (e: any) {
      debug.tests.push({ name: "groq_api", exception: e.message });
    }
  }

  // Test OpenAI directly
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Say hello in 5 words" }],
          temperature: 0.5, max_tokens: 50,
        }),
      });
      const data = await res.json();
      debug.tests.push({
        name: "openai_api",
        status: res.status,
        ok: !data.error,
        response: data.choices?.[0]?.message?.content,
        error: data.error?.message,
      });
    } catch (e: any) {
      debug.tests.push({ name: "openai_api", exception: e.message });
    }
  }

  // Test data fetching
  try {
    const { getChannelInfo, getChannelVideos } = await import("@/lib/youtube");
    const ch = await getChannelInfo();
    const vids = await getChannelVideos(5);
    debug.tests.push({
      name: "data_fetch",
      ok: true,
      channel: ch?.title,
      videoCount: vids?.length,
      firstVideo: vids?.[0]?.title,
    });
  } catch (e: any) {
    debug.tests.push({ name: "data_fetch", exception: e.message });
  }

  return new NextResponse(JSON.stringify(debug, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
