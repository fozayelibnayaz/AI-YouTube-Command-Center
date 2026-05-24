import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function safeJson(data: any, status: number = 200) {
  return new NextResponse(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function hasAI(): boolean {
  return (!!GROQ_KEY && GROQ_KEY.length > 10) || (!!OPENAI_KEY && OPENAI_KEY.length > 10);
}

async function callAI(prompt: string, system: string): Promise<string> {
  if (GROQ_KEY && GROQ_KEY.length > 10) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + GROQ_KEY },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.7, max_tokens: 3000,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }
  if (OPENAI_KEY && OPENAI_KEY.length > 10) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + OPENAI_KEY },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.7, max_tokens: 3000,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }
  return "";
}

function buildChannelContext(videos: any[], channel: any): string {
  const sorted = [...videos].sort((a, b) => (b.score || 0) - (a.score || 0));
  const active = videos.filter(v => (v.views || 0) > 0);
  const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
  const avgEng = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
  const retVids = videos.filter(v => v.avg_view_percentage != null);
  const avgRet = retVids.length > 0 ? retVids.reduce((s, v) => s + v.avg_view_percentage, 0) / retVids.length : 0;

  let ctx = "CHANNEL: " + (channel?.title || "Unknown") + "\n";
  ctx += "Subscribers: " + (channel?.subscribers || 0) + "\n";
  ctx += "Videos: " + videos.length + " (" + active.length + " active)\n";
  ctx += "Total Views: " + totalViews + "\n";
  ctx += "Avg Engagement: " + avgEng.toFixed(2) + "%\n";
  ctx += "Avg Retention: " + avgRet.toFixed(1) + "%\n\n";

  ctx += "TOP 15 VIDEOS:\n";
  for (const v of sorted.slice(0, 15)) {
    ctx += "- \"" + v.title + "\" | V:" + v.views + " L:" + v.likes + " C:" + v.comments + " S:" + (v.score || 0);
    if (v.avg_view_percentage != null) ctx += " Ret:" + v.avg_view_percentage.toFixed(1) + "%";
    ctx += "\n";
  }

  ctx += "\nBOTTOM 10 (with views):\n";
  for (const v of active.sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 10)) {
    ctx += "- \"" + v.title + "\" | V:" + v.views + " S:" + (v.score || 0) + "\n";
  }

  return ctx;
}

const TOOL_PROMPTS: Record<string, { system: string; prompt: (ctx: string, topic: string) => string }> = {
  content_strategy: {
    system: "You are a YouTube growth strategist. Create specific content strategies using the channel's REAL data. Reference actual video titles. Give 5-10 concrete video ideas.",
    prompt: (ctx, _) => ctx + "\n\nBased on this REAL channel data, create a 90-day content strategy with:\n1. Top 3 themes that work for this channel\n2. 10 specific video title ideas to make next (based on what's working)\n3. Optimal video length (based on top performers)\n4. Series ideas to build on success\n5. Topics to AVOID (based on what failed)",
  },
  competitor_gap: {
    system: "You are a YouTube competitive intelligence expert. Analyze gaps and opportunities.",
    prompt: (ctx, topic) => ctx + "\n\n" + (topic ? "Competitor: " + topic + "\n\n" : "") + "Find content gaps and opportunities:\n1. Topics this channel covers WELL\n2. Topics it should cover but doesn't\n3. Underserved areas in their niche\n4. 5 specific video ideas that fill the gap\n5. Format opportunities (Shorts, livestreams, etc.)",
  },
  thumbnail_audit: {
    system: "You are a thumbnail design expert. Analyze patterns in successful vs failing thumbnails based on titles and metrics.",
    prompt: (ctx, _) => ctx + "\n\nBased on the data, give a Thumbnail Performance Audit:\n1. Common patterns in TOP performing videos (titles suggest themes)\n2. Common patterns in BOTTOM performing videos\n3. 5 specific design principles this channel should follow\n4. What to change immediately\n5. 3 thumbnail templates to test",
  },
  title_optimizer: {
    system: "You are a YouTube title expert. Optimize titles for maximum CTR using proven psychological triggers.",
    prompt: (ctx, topic) => ctx + "\n\nORIGINAL TITLE: " + topic + "\n\nOptimize this title for max CTR:\n1. Show 5 rewrites using different techniques (curiosity, listicle, controversy, story, value-driven)\n2. Pick the BEST one and explain why\n3. List the psychological triggers used\n4. Predict CTR improvement\n5. Suggest matching thumbnail concept",
  },
  upload_schedule: {
    system: "You are a YouTube algorithm expert. Recommend upload schedules based on data patterns.",
    prompt: (ctx, _) => ctx + "\n\nBased on this channel's performance:\n1. Optimal upload frequency (videos per week)\n2. Best days/times based on audience type\n3. How long videos should be (based on top performers)\n4. Consistency strategy\n5. Sample 4-week content calendar",
  },
  audience_persona: {
    system: "You are an audience analysis expert. Build detailed viewer personas from video performance patterns.",
    prompt: (ctx, _) => ctx + "\n\nBuild detailed audience personas based on what content performs:\n1. PRIMARY persona (age, role, interests, pain points)\n2. What they watch for\n3. Why they engage (or don't)\n4. What content would attract MORE of them\n5. 5 specific video ideas tailored to this persona",
  },
  viral_pattern: {
    system: "You are a viral content analyst. Identify patterns in successful videos.",
    prompt: (ctx, _) => ctx + "\n\nAnalyze the TOP 15 videos and find:\n1. Common patterns in titles (words, structures, hooks)\n2. Common patterns in topics covered\n3. Length patterns of viral videos\n4. What separates top 15 from bottom 10\n5. Formula to replicate the success (specific actionable steps)\n6. 5 video ideas using this formula",
  },
  comment_insights: {
    system: "You are an audience insights expert.",
    prompt: (ctx, _) => ctx + "\n\nBased on engagement patterns (videos with high comments/likes ratios):\n1. What topics generate most discussion\n2. What viewers seem to care about most\n3. Content ideas based on engagement signals\n4. How to encourage more meaningful comments\n5. 5 questions/CTAs to add to next videos",
  },
  weekly_report: {
    system: "You are a YouTube analytics consultant writing executive reports.",
    prompt: (ctx, _) => ctx + "\n\nWrite a WEEKLY EXECUTIVE REPORT with:\n## Executive Summary (3 bullets)\n## Key Metrics This Period\n## Top Wins\n## Areas of Concern\n## Action Items for Next Week\n## 30-Day Outlook\n\nFormat for executive readability. Use real numbers from the data.",
  },
  improvement_plan: {
    system: "You are a YouTube growth coach. Create actionable 30-day plans with specific daily tasks.",
    prompt: (ctx, _) => ctx + "\n\nCreate a 30-DAY IMPROVEMENT PLAN with:\n## Week 1: Foundation (specific daily tasks)\n## Week 2: Content (specific videos to make)\n## Week 3: Optimization (specific videos to update)\n## Week 4: Growth (specific promotion tactics)\n\nEach task should be specific and based on this channel's actual weaknesses. Reference real video titles and metrics.",
  },
};

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch { return safeJson({ success: false, error: "Invalid JSON" }); }

    const { tool, topic = "" } = body;
    if (!tool || !TOOL_PROMPTS[tool]) {
      return safeJson({ success: false, error: "Unknown tool: " + tool });
    }

    if (!hasAI()) {
      return safeJson({ success: false, error: "AI not configured (need GROQ_API_KEY or OPENAI_API_KEY)" });
    }

    let channel: any = null;
    let videos: any[] = [];
    try {
      const yt = await import("@/lib/youtube");
      const utils = await import("@/lib/utils");
      const [ch, vidsRaw] = await Promise.all([yt.getChannelInfo(), yt.getChannelVideos(500)]);
      channel = ch;
      videos = (vidsRaw || []).map((v: any) => ({
        ...v, ...(v.analytics || {}),
        score: utils.calculatePerformanceScore({
          views: v.views || 0, likes: v.likes || 0, comments: v.comments || 0,
          publishedAt: v.published_at, channelSubscribers: ch?.subscribers || 1000,
          ctr: v.analytics?.ctr ?? null,
          retention: v.analytics?.avg_view_percentage ?? null,
        }),
      }));
    } catch (e: any) {
      return safeJson({ success: false, error: "Data fetch failed: " + e.message });
    }

    const ctx = buildChannelContext(videos, channel);
    const { system, prompt } = TOOL_PROMPTS[tool];
    const result = await callAI(prompt(ctx, topic), system);

    if (!result) return safeJson({ success: false, error: "AI returned empty result" });

    return safeJson({ success: true, result, tool });
  } catch (e: any) {
    return safeJson({ success: false, error: String(e?.message || e) });
  }
}
