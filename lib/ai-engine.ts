import { calculatePerformanceScore, diagnoseVideo, getEngagementRating, getViewsPerDayRating } from "./utils";

const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function hasAI(): boolean {
  return (!!GROQ_KEY && GROQ_KEY.length > 10 && !GROQ_KEY.includes("your_")) ||
         (!!OPENAI_KEY && OPENAI_KEY.length > 10 && !OPENAI_KEY.includes("your_"));
}

async function callAI(prompt: string): Promise<any> {
  if (GROQ_KEY && GROQ_KEY.length > 10 && !GROQ_KEY.includes("your_")) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + GROQ_KEY },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7, max_tokens: 1500,
      }),
    });
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }
  if (OPENAI_KEY && OPENAI_KEY.length > 10 && !OPENAI_KEY.includes("your_")) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + OPENAI_KEY },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7, max_tokens: 1500,
      }),
    });
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }
  return null;
}

function generateBuiltInAnalysis(video: any): any {
  const views = video.views || 0;
  const likes = video.likes || 0;
  const comments = video.comments || 0;
  const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const daysSince = video.published_at
    ? Math.max(1, (Date.now() - new Date(video.published_at).getTime()) / 86400000)
    : 1;
  const viewsPerDay = views / daysSince;

  let main_reason = "";
  if (viewsPerDay < 1 && daysSince > 30) {
    main_reason = "This video has only " + viewsPerDay.toFixed(2) + " views per day after " + Math.floor(daysSince) + " days. The algorithm has stopped pushing it. The thumbnail or title likely didn't generate enough early clicks to trigger sustained growth.";
  } else if (engRate < 1 && views >= 200) {
    main_reason = "Engagement is low at " + engRate.toFixed(2) + "% (likes+comments/views). Viewers are watching but not connecting emotionally enough to like or comment. Content may lack a strong call-to-action or emotional hook.";
  } else if (engRate >= 5) {
    main_reason = "Excellent engagement at " + engRate.toFixed(2) + "%! Audience is highly connected. " + likes + " likes and " + comments + " comments on " + views + " views shows strong emotional impact.";
  } else if (viewsPerDay >= 100) {
    main_reason = "Strong velocity at " + Math.round(viewsPerDay) + " views/day. Algorithm is actively pushing this. Title/thumbnail combo is working - the system sees high click-through and is rewarding it with more impressions.";
  } else {
    main_reason = "Mixed performance: " + Math.round(viewsPerDay) + " views/day, " + engRate.toFixed(2) + "% engagement. Some signals working, others not. Need to identify which specific element (hook, pacing, CTA) is underperforming.";
  }

  let thumbnail_analysis = "";
  if (viewsPerDay < 5 && daysSince > 7) {
    thumbnail_analysis = "Low view velocity suggests thumbnail isn't compelling enough to stop the scroll. Try: (1) Clearer human face with strong emotion. (2) 3-5 BIG words. (3) High contrast colors. (4) A 'before vs after' or comparison element. (5) Curiosity gap - tease but don't reveal.";
  } else if (viewsPerDay >= 100) {
    thumbnail_analysis = "Thumbnail is working well - " + Math.round(viewsPerDay) + " daily views shows people ARE clicking. Keep this style consistent across future uploads. Document what makes this thumbnail effective.";
  } else {
    thumbnail_analysis = "Thumbnail is performing moderately. A/B test variations with: (1) Different facial expressions. (2) Bigger text. (3) Brighter colors. Even a 10% improvement in clicks compounds over time.";
  }

  let title_analysis = "";
  const titleLength = (video.title || "").length;
  if (titleLength > 60) {
    title_analysis = "Title is " + titleLength + " characters - YouTube cuts off at ~60. Make it punchier and front-load important keywords in first 50 characters.";
  } else if (titleLength < 30) {
    title_analysis = "Title is short at " + titleLength + " characters. Consider adding: (1) A number, (2) Emotional trigger word, (3) Curiosity gap. Example: 'How I Did X' → 'How I Did X in 7 Days (Shocking Results)'";
  } else {
    title_analysis = "Title length is good. Optimize further: (1) Include the main keyword in first 5 words for SEO. (2) Add a number or emotional trigger. (3) Create curiosity gap that demands a click.";
  }

  let engagement_analysis = "";
  if (engRate < 1) {
    engagement_analysis = "CRITICAL: Only " + engRate.toFixed(2) + "% engagement (" + (likes + comments) + " interactions on " + views + " views). Fix: (1) Ask viewers to like in first 30 seconds. (2) Pose a question to drive comments. (3) Add 'comment X if you agree' style CTAs. (4) Reply to every comment in first hour.";
  } else if (engRate < 3) {
    engagement_analysis = "Engagement at " + engRate.toFixed(2) + "% is below industry avg of 2-5%. Boost it: (1) Add more emotional moments. (2) Ask viewers to share their opinion. (3) Pin a comment with a question.";
  } else {
    engagement_analysis = "Strong engagement at " + engRate.toFixed(2) + "%! This is above industry average. Audience clearly connecting. Keep using this same emotional/topic angle in future videos.";
  }

  let seo_analysis = "";
  const tagCount = (video.tags || []).length;
  const descLength = (video.description || "").length;
  if (tagCount < 5) {
    seo_analysis = "Only " + tagCount + " tags. Add 10-15 relevant tags: exact match keywords, long-tail variations, niche-specific terms.";
  } else if (descLength < 200) {
    seo_analysis = "Description too short (" + descLength + " chars). Add: (1) 150+ word description with keywords. (2) Timestamps. (3) Links to related videos. (4) Social media links. (5) Hashtags.";
  } else {
    seo_analysis = "SEO basics good (" + tagCount + " tags, " + descLength + " char description). Further optimize: (1) First 2 lines must hook. (2) Keyword in title/description/tags. (3) Add chapters/timestamps. (4) Pin comment with key links.";
  }

  let improved_title = video.title;
  if (viewsPerDay < 10) {
    const words = (video.title || "").split(" ");
    improved_title = "I Tested " + (words.slice(-3).join(" ") || "This") + " for 30 Days (Real Results)";
  }

  let next_video_advice = "";
  if (engRate >= 3 && viewsPerDay >= 20) {
    next_video_advice = "This format works! Strategy: (1) Make a 'Part 2' building on this. (2) Create a series with same thumbnail style. (3) Cover related topics. (4) Repurpose key moments into Shorts.";
  } else {
    next_video_advice = "Pivot strategy: (1) Study top 3 videos in your niche this week. (2) Use proven thumbnail formats. (3) Test more emotional/controversial angles. (4) Create response content to trending videos.";
  }

  return {
    main_reason, thumbnail_analysis, title_analysis, engagement_analysis,
    seo_analysis, improved_title, next_video_advice,
    source: "built-in-analysis",
  };
}

export async function analyzeVideo(video: any, channelSubscribers?: number) {
  const views = video.views || 0;
  const likes = video.likes || 0;
  const comments = video.comments || 0;
  const subs = channelSubscribers || 1000;

  const score = calculatePerformanceScore({
    views, likes, comments,
    publishedAt: video.published_at,
    channelSubscribers: subs,
  });

  const issues = diagnoseVideo({
    views, likes, comments,
    publishedAt: video.published_at,
    channelSubscribers: subs,
  });

  const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const daysSince = video.published_at
    ? Math.max(1, (Date.now() - new Date(video.published_at).getTime()) / 86400000)
    : 1;
  const viewsPerDay = views / daysSince;

  let aiAnalysis = null;

  if (hasAI()) {
    try {
      const prompt = "You are a YouTube growth expert. Analyze this video using ONLY real data and give specific actionable advice.\n\n" +
        "REAL Video Data:\n" +
        "- Title: " + video.title + "\n" +
        "- Views: " + views + "\n" +
        "- Likes: " + likes + "\n" +
        "- Comments: " + comments + "\n" +
        "- Engagement Rate: " + engRate.toFixed(2) + "% (industry avg: 2-5%)\n" +
        "- Views per Day: " + viewsPerDay.toFixed(1) + "\n" +
        "- Days Since Upload: " + Math.floor(daysSince) + "\n" +
        "- Channel Subscribers: " + subs + "\n" +
        "- Duration: " + Math.floor((video.duration_seconds || 0) / 60) + " min\n" +
        "- Tags: " + ((video.tags || []).slice(0, 10).join(", ")) + "\n" +
        "- Description preview: " + ((video.description || "").substring(0, 200)) + "\n\n" +
        "IMPORTANT: CTR and Retention are NOT available (require YouTube Analytics API OAuth). Base your analysis on engagement rate, views/day, and how content/title/thumbnail likely affect these.\n\n" +
        "Respond ONLY with valid JSON: {main_reason, thumbnail_analysis, title_analysis, engagement_analysis, seo_analysis, improved_title, next_video_advice}. Each value: 2-3 sentences with SPECIFIC actionable advice.";

      aiAnalysis = await callAI(prompt);
      if (aiAnalysis) aiAnalysis.source = "ai-powered";
    } catch (e) {
      console.error("AI call failed:", e);
    }
  }

  if (!aiAnalysis) {
    aiAnalysis = generateBuiltInAnalysis(video);
  }

  const recommendations = [];
  if (viewsPerDay < 5 && daysSince > 7) recommendations.push("Update thumbnail - current view velocity is too low");
  if (engRate < 1 && views >= 200) recommendations.push("Add stronger CTAs to drive likes and comments");
  if (engRate < 2) recommendations.push("Pin a comment asking a question to spark discussion");
  if (viewsPerDay < 1 && daysSince > 30) recommendations.push("Consider unlisting or refreshing this video");
  if (engRate >= 5) recommendations.push("This format works! Create more in same style");
  if (score >= 70) recommendations.push("Document what works here - replicate in future videos");

  const strengths = [];
  if (engRate >= 5) strengths.push("High engagement rate (" + engRate.toFixed(2) + "%) - audience deeply connecting");
  if (viewsPerDay >= 50) strengths.push("Strong view velocity (" + Math.round(viewsPerDay) + " views/day)");
  if (views >= subs) strengths.push("Views exceed subscriber count - reaching new audiences");
  if (likes >= 100 && (likes / Math.max(views, 1)) >= 0.03) strengths.push("Strong like-to-view ratio");

  return {
    performance_score: score,
    engagement_rate: parseFloat(engRate.toFixed(2)),
    views_per_day: parseFloat(viewsPerDay.toFixed(1)),
    issues,
    strengths,
    recommendations,
    ai: aiAnalysis,
    data_source: "youtube_data_api_v3_verified",
  };
}

export async function generateTitles(topic: string) {
  if (hasAI()) {
    try {
      const prompt = "Generate 10 viral YouTube video titles for topic: '" + topic + "'. Mix styles: curiosity-gap, how-to, listicle, story, controversy. Make them click-worthy but not clickbait. Respond ONLY with valid JSON: { titles: ['title1', ...], best_pick: 'title', reason: 'why' }";
      const result = await callAI(prompt);
      if (result) return { ...result, ai: true };
    } catch {}
  }

  return {
    titles: [
      "How to " + topic + " in 2025 (Step by Step)",
      topic + ": Everything You Need to Know",
      "I Tried " + topic + " for 30 Days - Here's What Happened",
      "The Truth About " + topic + " Nobody Tells You",
      topic + " Tutorial for Beginners (2025)",
      "5 " + topic + " Mistakes Killing Your Growth",
      "Why " + topic + " is Changing Everything",
      topic + " - From Zero to Pro",
      "I Made $1000 Using " + topic,
      "STOP Doing " + topic + " Wrong!",
    ],
    best_pick: "I Tried " + topic + " for 30 Days - Here's What Happened",
    reason: "Story-based titles with time commitments perform 40% better",
    ai: false,
  };
}

export async function generateHooks(videoTitle: string) {
  if (hasAI()) {
    try {
      const prompt = "Write 6 powerful YouTube video hooks (first 30 seconds script) for: '" + videoTitle + "'. Types: curiosity, shocking stat, story-based, direct value, controversial, MrBeast-style. Each hook 3-4 sentences max. Respond ONLY with valid JSON: { hooks: [{type: 'curiosity', script: '...'}, ...] }";
      const result = await callAI(prompt);
      if (result) return { ...result, ai: true };
    } catch {}
  }

  return {
    hooks: [
      { type: "curiosity", script: "In the next 5 minutes, I'll show you exactly how to " + videoTitle + ". And by the end, you'll never look at this the same way again." },
      { type: "shocking-stat", script: "97% of people fail at this. The reason is so simple, you'll be shocked. I spent 6 months researching " + videoTitle + " and the truth nobody talks about is..." },
      { type: "story", script: "Last month, something happened that completely changed how I think about " + videoTitle + ". I lost everything. But what I discovered next changed my life." },
      { type: "direct-value", script: "By the end of this video, you'll know exactly how to " + videoTitle + ". No fluff, no theory - just step by step what actually works." },
      { type: "controversial", script: "Everything you've been told about " + videoTitle + " is WRONG. The gurus are lying to you. In the next 5 minutes, I'll prove it." },
      { type: "mrbeast", script: "I just spent $10,000 testing " + videoTitle + " so you don't have to. The results were INSANE." },
    ],
    ai: false,
  };
}
