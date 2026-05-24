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
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
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
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
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
  ctx += "Total Views: " + totalViews + "\nAvg Engagement: " + avgEng.toFixed(2) + "%\nAvg Retention: " + avgRet.toFixed(1) + "%\n\n";

  ctx += "TOP 20 VIDEOS:\n";
  for (const v of sorted.slice(0, 20)) {
    ctx += "- \"" + v.title + "\" | V:" + v.views + " L:" + v.likes + " C:" + v.comments + " S:" + (v.score || 0);
    if (v.avg_view_percentage != null) ctx += " Ret:" + v.avg_view_percentage.toFixed(1) + "%";
    if (v.tags?.length) ctx += " Tags:" + v.tags.slice(0, 5).join(",");
    ctx += "\n";
  }

  ctx += "\nBOTTOM 10 VIDEOS:\n";
  for (const v of active.sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 10)) {
    ctx += "- \"" + v.title + "\" | V:" + v.views + " S:" + (v.score || 0) + "\n";
  }

  return ctx;
}

const TOOL_PROMPTS: Record<string, { system: string; prompt: (ctx: string, topic: string) => string }> = {
  content_strategy: {
    system: "You are a YouTube growth strategist. Create specific strategies using REAL channel data.",
    prompt: (ctx, _) => ctx + "\n\nCreate a 90-day content strategy:\n1. Top 3 themes that work\n2. 10 specific video ideas\n3. Optimal video length\n4. Series ideas\n5. Topics to AVOID",
  },
  competitor_gap: {
    system: "You are a YouTube competitive intelligence expert.",
    prompt: (ctx, topic) => ctx + (topic ? "\n\nCompetitor: " + topic : "") + "\n\nFind content gaps:\n1. Topics this channel covers well\n2. Topics it should cover but doesn't\n3. Underserved niche areas\n4. 5 specific video ideas\n5. Format opportunities",
  },
  thumbnail_audit: {
    system: "You are a thumbnail design expert analyzing performance patterns.",
    prompt: (ctx, _) => ctx + "\n\nThumbnail Performance Audit:\n1. Patterns in TOP videos\n2. Patterns in BOTTOM videos\n3. 5 design principles to follow\n4. What to change immediately\n5. 3 thumbnail templates to test",
  },
  title_optimizer: {
    system: "You are a YouTube title expert.",
    prompt: (ctx, topic) => ctx + "\n\nORIGINAL TITLE: " + topic + "\n\nOptimize:\n1. 5 rewrites (curiosity, listicle, controversy, story, value)\n2. Pick BEST and explain\n3. Psychological triggers used\n4. Predicted CTR improvement\n5. Matching thumbnail concept",
  },
  upload_schedule: {
    system: "You are a YouTube algorithm expert.",
    prompt: (ctx, _) => ctx + "\n\nUpload Strategy:\n1. Optimal frequency\n2. Best days/times for audience type\n3. Optimal video length\n4. Consistency tactics\n5. 4-week content calendar",
  },
  audience_persona: {
    system: "You are an audience analysis expert.",
    prompt: (ctx, _) => ctx + "\n\nBuild audience personas:\n1. PRIMARY persona (age, role, interests, pain points)\n2. What they watch for\n3. Why they engage\n4. Content to attract more\n5. 5 video ideas for this persona",
  },
  viral_pattern: {
    system: "You are a viral content analyst.",
    prompt: (ctx, _) => ctx + "\n\nAnalyze TOP videos:\n1. Title patterns (words, structures, hooks)\n2. Topic patterns\n3. Length patterns\n4. What separates top from bottom\n5. Formula to replicate\n6. 5 video ideas using this formula",
  },
  comment_insights: {
    system: "You are an audience insights expert.",
    prompt: (ctx, _) => ctx + "\n\nBased on engagement patterns:\n1. Topics that generate discussion\n2. What viewers care about\n3. Content ideas from engagement signals\n4. How to encourage comments\n5. 5 CTAs to add to next videos",
  },
  weekly_report: {
    system: "You are a YouTube analytics consultant.",
    prompt: (ctx, _) => ctx + "\n\nWeekly Executive Report:\n## Executive Summary\n## Key Metrics\n## Top Wins\n## Areas of Concern\n## Action Items\n## 30-Day Outlook",
  },
  improvement_plan: {
    system: "You are a YouTube growth coach.",
    prompt: (ctx, _) => ctx + "\n\n30-Day Plan:\n## Week 1: Foundation\n## Week 2: Content\n## Week 3: Optimization\n## Week 4: Growth\nSpecific daily tasks based on real data.",
  },
  // NEW TOOLS
  video_clone: {
    system: "You are a content cloning expert - help recreate the success patterns of top videos.",
    prompt: (ctx, topic) => ctx + (topic ? "\n\nVideo to clone: " + topic : "") + "\n\nVIDEO CLONE BLUEPRINT:\n1. Analyze the TOP video's success formula (title structure, length, topic angle)\n2. Identify the 5 key elements that made it work\n3. Generate 7 NEW video ideas using the same formula but different topics\n4. Provide exact title templates\n5. Suggest thumbnail composition\n6. Recommend video structure/script outline",
  },
  description_writer: {
    system: "You are a YouTube SEO description writer.",
    prompt: (ctx, topic) => ctx + "\n\nVIDEO TITLE: " + (topic || "Use a top performing video") + "\n\nWrite an OPTIMIZED YouTube description:\n1. Hook in first 2 lines (visible in search)\n2. SEO-rich paragraph (3-5 sentences)\n3. Key takeaways/timestamps\n4. Call-to-action\n5. Links section\n6. Hashtags (5-10 relevant)\n7. Tag suggestions (15-20 SEO tags)",
  },
  tag_optimizer: {
    system: "You are a YouTube SEO tag expert.",
    prompt: (ctx, topic) => ctx + "\n\nVIDEO TOPIC: " + (topic || "Top performing video topic") + "\n\nGenerate optimal tags:\n1. 15 PRIMARY keyword tags (direct matches)\n2. 10 LONG-TAIL keyword tags (specific phrases)\n3. 5 BROAD niche tags\n4. 5 TRENDING tags in this niche\n5. 5 COMPETITOR-style tags\n6. SEO strategy explanation\n7. Tags to AVOID (over-saturated)",
  },
  channel_swot: {
    system: "You are a YouTube strategist conducting SWOT analysis.",
    prompt: (ctx, _) => ctx + "\n\nCHANNEL SWOT ANALYSIS:\n\n## STRENGTHS\n- Top performing content patterns\n- Engagement strengths\n- Audience loyalty signals\n\n## WEAKNESSES\n- Underperforming areas\n- Engagement gaps\n- Content gaps\n\n## OPPORTUNITIES\n- Untapped niches\n- Format opportunities (Shorts, Live, etc)\n- Trending topics\n\n## THREATS\n- Algorithm risks\n- Competitor moves\n- Niche saturation\n\n## STRATEGIC PRIORITIES (next 90 days)\n5 specific actions ranked by impact",
  },
  ab_test_planner: {
    system: "You are a YouTube A/B testing expert.",
    prompt: (ctx, topic) => ctx + "\n\nTITLE TO TEST: " + (topic || "Best performing video") + "\n\nCREATE A/B TEST PLAN:\n1. 3 title variations (different psychological angles)\n2. 3 thumbnail concept descriptions\n3. Hypothesis for each variation\n4. Success metrics to track\n5. Test duration recommendation\n6. How to interpret results\n7. Winner implementation strategy",
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
      return safeJson({ success: false, error: "AI not configured" });
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
