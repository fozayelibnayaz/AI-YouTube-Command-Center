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

  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 20) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.GROQ_API_KEY },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "Reply with: WORKING" }],
          temperature: 0.1, max_tokens: 10,
        }),
      });
      const data = await res.json();
      debug.tests.push({
        name: "groq",
        httpStatus: res.status,
        ok: !data.error,
        response: data.choices?.[0]?.message?.content,
        error: data.error?.message,
      });
    } catch (e: any) {
      debug.tests.push({ name: "groq", exception: e.message });
    }
  } else {
    debug.tests.push({ name: "groq", skipped: "No GROQ_API_KEY set" });
  }

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 20) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Reply with: WORKING" }],
          temperature: 0.1, max_tokens: 10,
        }),
      });
      const data = await res.json();
      debug.tests.push({
        name: "openai",
        httpStatus: res.status,
        ok: !data.error,
        response: data.choices?.[0]?.message?.content,
        error: data.error?.message,
      });
    } catch (e: any) {
      debug.tests.push({ name: "openai", exception: e.message });
    }
  } else {
    debug.tests.push({ name: "openai", skipped: "No OPENAI_API_KEY set" });
  }

  try {
    const { getChannelInfo, getChannelVideos } = await import("@/lib/youtube");
    const ch = await getChannelInfo();
    const vids = await getChannelVideos(5);
    debug.tests.push({
      name: "data_fetch",
      ok: true,
      channel: ch?.title,
      videoCount: vids?.length,
    });
  } catch (e: any) {
    debug.tests.push({ name: "data_fetch", exception: e.message });
  }

  return new NextResponse(JSON.stringify(debug, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
