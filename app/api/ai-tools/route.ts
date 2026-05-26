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
  hook_generator: {
    system: "You are a YouTube hook expert. Write irresistible first 15 seconds.",
    prompt: (ctx, topic) => ctx + "\n\nVIDEO TOPIC: " + topic + "\n\nWrite 6 powerful hooks (15s each):\n1. Curiosity gap\n2. Shocking stat\n3. Story-based\n4. Direct value\n5. Controversial\n6. MrBeast-style\n\nFor each include: hook script, why it works, retention impact",
  },
  script_writer: {
    system: "You are a YouTube script writer. Write full retention-optimized scripts.",
    prompt: (ctx, topic) => ctx + "\n\nVIDEO TOPIC: " + topic + "\n\nWrite complete script:\n1. Hook (0-15s)\n2. Promise (15-30s)\n3. Main content (broken into 3-5 sections with pattern interrupts)\n4. CTA mid-roll\n5. Strong outro with end-screen prompts\n\nInclude B-roll suggestions and pacing notes.",
  },
  shorts_ideas: {
    system: "You are a YouTube Shorts viral expert.",
    prompt: (ctx, _) => ctx + "\n\nGenerate 15 Shorts ideas from existing content:\n1. Hook line\n2. 30-60s script\n3. Hashtags\n4. Best source video to clip from\n5. Viral potential score (1-10)",
  },
  chapter_generator: {
    system: "You are a YouTube SEO and chapter optimization expert.",
    prompt: (ctx, topic) => ctx + "\n\nVIDEO: " + topic + "\n\nGenerate optimal chapter timestamps:\n1. 6-10 chapters with timestamps\n2. SEO-rich chapter titles\n3. Description format\n4. Why these chapters boost retention",
  },
  sponsor_pitch: {
    system: "You are a brand partnership expert writing sponsor pitch emails.",
    prompt: (ctx, topic) => ctx + "\n\nTARGET BRAND: " + (topic || "any relevant brand") + "\n\nWrite professional sponsor pitch:\n1. Subject line (5 variations)\n2. Opening hook\n3. Channel stats highlight\n4. Audience demographics\n5. Past success metrics\n6. Specific deal proposal\n7. CTA",
  },
  community_post: {
    system: "You are a YouTube community engagement expert.",
    prompt: (ctx, _) => ctx + "\n\nGenerate 10 high-engagement community posts:\n1. Polls (3)\n2. Questions (3)\n3. Image/quote ideas (2)\n4. Announcements (2)\n\nEach with engagement strategy and best posting time.",
  },
  comment_replier: {
    system: "You are a YouTube community manager.",
    prompt: (ctx, topic) => ctx + "\n\nCOMMENT TO REPLY TO: " + topic + "\n\nGenerate 5 reply options:\n1. Friendly + question\n2. Thank you + CTA\n3. Funny/witty\n4. Detailed value-add\n5. Pin-worthy response\n\nPick best and explain why.",
  },
  cta_generator: {
    system: "You are a conversion optimization expert.",
    prompt: (ctx, topic) => ctx + "\n\nVIDEO TOPIC: " + topic + "\n\nGenerate 10 CTAs:\n1. Subscribe CTAs (3)\n2. Like CTAs (2)\n3. Comment CTAs (2)\n4. Watch next CTAs (2)\n5. External link CTA (1)\n\nInclude timing and delivery style.",
  },
  trend_radar: {
    system: "You are a YouTube trend analyst.",
    prompt: (ctx, topic) => ctx + "\n\nNICHE: " + (topic || "this channel's niche") + "\n\nIdentify trends:\n1. 5 rising topics (next 30 days)\n2. 5 declining topics to avoid\n3. Seasonal opportunities\n4. Format trends (Shorts, long-form, live)\n5. 10 specific video ideas to capitalize NOW",
  },
  keyword_finder: {
    system: "You are a YouTube SEO and keyword research expert.",
    prompt: (ctx, topic) => ctx + "\n\nTOPIC: " + topic + "\n\nFind low-competition keywords:\n1. 10 long-tail keywords\n2. Search volume estimate\n3. Competition level\n4. Suggested title using each\n5. Related hashtags\n6. Top 3 priority keywords to target",
  },
  channel_audit: {
    system: "You are a YouTube channel auditor doing a complete review.",
    prompt: (ctx, _) => ctx + "\n\nComplete Channel Audit:\n1. Branding (logo, banner, about)\n2. Content quality patterns\n3. Upload consistency\n4. SEO health\n5. Engagement health\n6. Monetization readiness\n7. Critical issues (top 5)\n8. Quick wins (top 10)\n9. Long-term recommendations\n10. Overall grade A-F",
  },
  revenue_forecast: {
    system: "You are a YouTube monetization expert.",
    prompt: (ctx, _) => ctx + "\n\nRevenue Forecast:\n1. Current estimated monthly revenue\n2. 3-month projection\n3. 6-month projection\n4. 12-month projection\n5. Required views to hit $1000/mo\n6. CPM estimates by niche\n7. Additional revenue streams\n8. Action plan to 10x revenue",
  },
  collab_finder: {
    system: "You are a YouTube collaboration strategist.",
    prompt: (ctx, _) => ctx + "\n\nCollaboration Opportunities:\n1. 10 similar-sized channels to collab with\n2. 5 bigger channels (long-shot collabs)\n3. Collab format ideas (5)\n4. Outreach template\n5. Win-win value propositions",
  },
  niche_analyzer: {
    system: "You are a YouTube niche research expert.",
    prompt: (ctx, topic) => ctx + "\n\nNICHE: " + (topic || "current niche") + "\n\nNiche analysis:\n1. Saturation level (1-10)\n2. Audience size\n3. Avg revenue potential\n4. Top 5 dominant channels\n5. Gaps in market\n6. Sub-niches to dominate\n7. Should you stay or pivot?\n8. 5 angle differentiators",
  },
  algorithm_decoder: {
    system: "You are a YouTube algorithm expert decoding current ranking factors.",
    prompt: (ctx, _) => ctx + "\n\nDecode YouTube algorithm for this channel:\n1. Current ranking factors (2025)\n2. What YT is favoring NOW\n3. What's being penalized\n4. CTR vs Retention priorities\n5. Session time importance\n6. Specific actions to align with algorithm\n7. Common mistakes this channel may be making\n8. 30-day algorithm-aligned strategy",
  },

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
