import { NextRequest, NextResponse } from "next/server";
import { getChannelInfo, getChannelVideos } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const body = await req.json();
    const question = (body.question || body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!question) {
      return NextResponse.json({ success: false, error: "Empty question" });
    }

    const [channel, videos] = await Promise.all([
      getChannelInfo(),
      getChannelVideos(500),
    ]);

    const context = buildContext(channel, videos);
    const systemPrompt =
      "You are a YouTube growth expert analyzing " + (channel.title || "this channel") + ".\n" +
      "Use ONLY the REAL data below. Always reference specific video TITLES and numbers.\n" +
      "Be specific, actionable, and concise.\n\n" + context;

    // Try providers in order: Groq → Gemini → OpenAI → Claude → Local
    const providers: Array<{ name: string; fn: () => Promise<string | null> }> = [
      { name: "groq", fn: () => tryGroq(systemPrompt, question, history) },
      { name: "gemini", fn: () => tryGemini(systemPrompt, question, history) },
      { name: "openai", fn: () => tryOpenAI(systemPrompt, question, history) },
      { name: "claude", fn: () => tryClaude(systemPrompt, question, history) },
    ];

    for (const p of providers) {
      try {
        const reply = await p.fn();
        if (reply && reply.trim()) {
          return NextResponse.json({
            success: true,
            answer: reply,
            source: p.name,
            ms: Date.now() - t0,
          });
        }
      } catch (e: any) {
        console.error("[" + p.name + "] failed:", e.message);
      }
    }

    // Local analyzer — ALWAYS works
    return NextResponse.json({
      success: true,
      answer: localAnalyze(question, channel, videos),
      source: "local-analyzer",
      ms: Date.now() - t0,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      answer: "Error: " + e.message,
    });
  }
}

async function tryGroq(sys: string, q: string, history: any[]): Promise<string | null> {
  if (!GROQ_KEY || GROQ_KEY.length < 20) return null;
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + GROQ_KEY },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: sys },
        ...history.slice(-6),
        { role: "user", content: q },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!r.ok) throw new Error("Groq " + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || null;
}

async function tryGemini(sys: string, q: string, history: any[]): Promise<string | null> {
  if (!GEMINI_KEY || GEMINI_KEY.length < 20) return null;
  const histText = history.slice(-4).map((h: any) => h.role + ": " + h.content).join("\n");
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: sys + "\n\nHistory:\n" + histText + "\n\nUser: " + q }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
      }),
    }
  );
  if (!r.ok) throw new Error("Gemini " + r.status);
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function tryOpenAI(sys: string, q: string, history: any[]): Promise<string | null> {
  if (!OPENAI_KEY || OPENAI_KEY.length < 20) return null;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + OPENAI_KEY },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        ...history.slice(-6),
        { role: "user", content: q },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!r.ok) throw new Error("OpenAI " + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || null;
}

async function tryClaude(sys: string, q: string, history: any[]): Promise<string | null> {
  if (!ANTHROPIC_KEY || ANTHROPIC_KEY.length < 20) return null;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      system: sys,
      messages: [...history.slice(-6), { role: "user", content: q }],
    }),
  });
  if (!r.ok) throw new Error("Claude " + r.status);
  const j = await r.json();
  return j.content?.[0]?.text || null;
}

function buildContext(channel: any, videos: any[]): string {
  const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
  const avgViews = videos.length ? Math.round(totalViews / videos.length) : 0;
  const avgEng = totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) : "0";

  const top = [...videos].sort((a, b) => b.views - a.views).slice(0, 25);
  const worst = videos
    .filter((v) => v.views > 50)
    .sort((a, b) => (a.analytics?.engagement_rate || 0) - (b.analytics?.engagement_rate || 0))
    .slice(0, 15);
  const recent = [...videos]
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 15);
  const zeroViews = videos.filter((v) => v.views === 0);

  let ctx = "═══ CHANNEL ═══\n";
  ctx += "Name: " + channel.title + "\n";
  ctx += "Subscribers: " + (channel.subscribers || 0).toLocaleString() + "\n";
  ctx += "Total Views: " + (channel.totalViews || 0).toLocaleString() + "\n";
  ctx += "Total Videos: " + videos.length + "\n";
  ctx += "Avg Views/Video: " + avgViews.toLocaleString() + "\n";
  ctx += "Avg Engagement: " + avgEng + "%\n";
  ctx += "Videos with 0 views: " + zeroViews.length + "\n\n";

  ctx += "═══ TOP 25 VIDEOS BY VIEWS ═══\n";
  top.forEach((v, i) => {
    const er = v.analytics?.engagement_rate || 0;
    ctx += (i + 1) + '. "' + v.title + '" | ' + v.views.toLocaleString() + " views | " +
           v.likes + " likes | " + v.comments + " comments | ER: " + er + "%\n";
  });

  ctx += "\n═══ 15 WORST ENGAGEMENT (50+ views) ═══\n";
  worst.forEach((v, i) => {
    ctx += (i + 1) + '. "' + v.title + '" | ' + v.views.toLocaleString() + " views | ER: " + (v.analytics?.engagement_rate || 0) + "%\n";
  });

  ctx += "\n═══ 15 MOST RECENT UPLOADS ═══\n";
  recent.forEach((v, i) => {
    ctx += (i + 1) + '. "' + v.title + '" | ' + v.views.toLocaleString() + " views | " + new Date(v.published_at).toLocaleDateString() + "\n";
  });

  return ctx;
}

function localAnalyze(q: string, channel: any, videos: any[]): string {
  const m = q.toLowerCase();
  const note = "\n\n_💡 Local analyzer active. Add GROQ_API_KEY (free at console.groq.com/keys) for full AI._";

  if (m.includes("worst") || m.includes("retention") || m.includes("lowest")) {
    const worst = videos.filter((v) => v.views > 50)
      .sort((a, b) => (a.analytics?.engagement_rate || 0) - (b.analytics?.engagement_rate || 0))
      .slice(0, 10);
    if (!worst.length) return "Not enough video data yet." + note;
    return "**Videos with worst engagement/retention:**\n\n" + worst.map((v, i) =>
      (i + 1) + ". **" + v.title + "**\n   Views: " + v.views.toLocaleString() +
      " | Likes: " + v.likes + " | Engagement: " + (v.analytics?.engagement_rate || 0) + "%"
    ).join("\n\n") + note;
  }

  if (m.includes("best") || m.includes("top")) {
    const top = [...videos].sort((a, b) => b.views - a.views).slice(0, 10);
    return "**Top 10 Videos:**\n\n" + top.map((v, i) =>
      (i + 1) + ". **" + v.title + "**\n   " + v.views.toLocaleString() + " views | " + v.likes + " likes"
    ).join("\n\n") + note;
  }

  if (m.includes("recent") || m.includes("latest") || m.includes("new")) {
    const recent = [...videos]
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, 10);
    return "**Most recent uploads:**\n\n" + recent.map((v, i) =>
      (i + 1) + ". **" + v.title + "** - " + v.views.toLocaleString() + " views (" + new Date(v.published_at).toLocaleDateString() + ")"
    ).join("\n") + note;
  }

  if (m.includes("0 view") || m.includes("zero")) {
    const zero = videos.filter((v) => v.views === 0);
    if (!zero.length) return "Great news — no videos with 0 views!" + note;
    return "**" + zero.length + " videos with 0 views:**\n\n" + zero.slice(0, 20).map((v, i) =>
      (i + 1) + ". " + v.title
    ).join("\n") + note;
  }

  if (m.includes("overall") || m.includes("doing") || m.includes("performance")) {
    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const totalLikes = videos.reduce((s, v) => s + v.likes, 0);
    const totalComments = videos.reduce((s, v) => s + v.comments, 0);
    return "**Channel Overview: " + channel.title + "**\n\n" +
      "- 📺 " + videos.length + " videos\n" +
      "- 👁️ " + totalViews.toLocaleString() + " total views\n" +
      "- 👥 " + (channel.subscribers || 0).toLocaleString() + " subscribers\n" +
      "- 👍 " + totalLikes.toLocaleString() + " total likes\n" +
      "- 💬 " + totalComments.toLocaleString() + " total comments\n" +
      "- 📊 Avg " + Math.round(totalViews / Math.max(videos.length, 1)).toLocaleString() + " views/video" + note;
  }

  return "I can analyze your channel. Try asking:\n\n" +
    "- 'How is my channel doing overall?'\n" +
    "- 'What are my best videos?'\n" +
    "- 'Which videos have worst retention?'\n" +
    "- 'Show recent uploads'\n" +
    "- 'Videos with 0 views'" + note;
}
