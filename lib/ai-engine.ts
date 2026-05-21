import { calculatePerformanceScore, diagnoseVideo, getCTRRating, getRetentionRating } from "./utils";

const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function hasAI(): boolean {
  return (!!GROQ_KEY && !GROQ_KEY.includes("your_")) || (!!OPENAI_KEY && !OPENAI_KEY.includes("your_"));
}

async function callAI(prompt: string): Promise<any> {
  if (GROQ_KEY && !GROQ_KEY.includes("your_")) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + GROQ_KEY,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }
  if (OPENAI_KEY && !OPENAI_KEY.includes("your_")) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_KEY,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }
  return null;
}

function generateBuiltInAnalysis(video: any): any {
  const ctr = video.ctr || 0;
  const retention = video.avg_view_percentage || 0;
  const views = video.views || 0;
  
  let main_reason = "";
  if (ctr < 3 && retention < 25) {
    main_reason = "This video struggled because BOTH the thumbnail and content failed to hold attention. CTR of " + ctr + "% means people are not clicking, and " + retention + "% retention means those who click leave quickly.";
  } else if (ctr < 3) {
    main_reason = "The main problem is the thumbnail/title not getting clicks. With " + ctr + "% CTR, fewer than 3 in 100 people who see this video click on it. The content might be good but nobody is reaching it.";
  } else if (retention < 25) {
    main_reason = "People click the video (CTR of " + ctr + "% is decent) but leave quickly. " + retention + "% retention means viewers do not find the first 30-60 seconds compelling enough to stay.";
  } else if (ctr >= 7 && retention >= 40) {
    main_reason = "This video performed excellently! " + ctr + "% CTR shows strong thumbnail/title combo, and " + retention + "% retention proves the content delivers on the promise.";
  } else {
    main_reason = "This video has mixed performance. With " + ctr + "% CTR and " + retention + "% retention, there is room to improve both the click appeal and the content delivery.";
  }

  let thumbnail_analysis = "";
  if (ctr < 3) {
    thumbnail_analysis = "CRITICAL: Your thumbnail is failing. Solutions: 1) Add a clear human face showing emotion (shock, excitement, fear). 2) Use 3-5 words max in HUGE text. 3) High contrast colors - red, yellow, white on dark backgrounds. 4) Show a 'before vs after' or comparison. 5) Create curiosity gap - tease the answer but do not give it.";
  } else if (ctr < 5) {
    thumbnail_analysis = "Your thumbnail is okay but not stopping the scroll. Try: 1) A/B test with brighter version. 2) Add an arrow pointing to something interesting. 3) Use a more shocking facial expression. 4) Increase text size by 50%.";
  } else {
    thumbnail_analysis = "Thumbnail is performing well at " + ctr + "% CTR. Keep this style consistent. Study what makes this thumbnail work and replicate it across future videos.";
  }

  let title_analysis = "";
  const titleLength = (video.title || "").length;
  if (titleLength > 60) {
    title_analysis = "Title is too long (" + titleLength + " chars). YouTube cuts it off at ~60 characters. Make it punchier - keep under 55 characters for maximum impact.";
  } else if (titleLength < 30) {
    title_analysis = "Title might be too short. Consider adding curiosity hooks, numbers, or emotional triggers. Examples: 'I Tried X for 30 Days', 'Why X is Wrong About Y', '5 Hidden Truths About X'";
  } else {
    title_analysis = "Title length is good. Make sure it includes: 1) A number if possible. 2) Emotional trigger word. 3) Curiosity gap. 4) Target keyword in first 5 words.";
  }

  let retention_analysis = "";
  if (retention < 25) {
    retention_analysis = "CRITICAL retention issue. Viewers leave within first 30 seconds. Fixes: 1) Cut your intro to 5 seconds max. 2) State the BIGGEST benefit in first sentence. 3) Show the 'after' or result in first 10 seconds. 4) Add pattern interrupts every 60 seconds (zoom, sound, jump cut). 5) Use the 'open loop' technique - tease something for later.";
  } else if (retention < 35) {
    retention_analysis = "Retention is below average. Mid-video drop suggests pacing issues. Fix: 1) Use jump cuts every 3-5 seconds. 2) Add B-roll constantly. 3) Remove all 'um', long pauses. 4) Change topic/angle every 60-90 seconds.";
  } else {
    retention_analysis = "Solid retention at " + retention + "%. Audience is engaged. Push higher by adding more pattern interrupts and stronger CTAs in the final 30%.";
  }

  let seo_analysis = "";
  const tagCount = (video.tags || []).length;
  const descLength = (video.description || "").length;
  if (tagCount < 5) {
    seo_analysis = "SEO needs work. Only " + tagCount + " tags found. Add 10-15 relevant tags including: 1) Exact match keywords. 2) Long-tail variations. 3) Trending tags in your niche. 4) Competitor channel names if relevant.";
  } else if (descLength < 200) {
    seo_analysis = "Description is too short (" + descLength + " chars). YouTube needs context. Add: 1) 150+ word description with keywords. 2) Timestamps for sections. 3) Links to related videos. 4) Social media links. 5) Hashtags at the end.";
  } else {
    seo_analysis = "SEO basics look good. Optimize further: 1) First 2 lines must hook (shown in search). 2) Keyword in title, description, tags. 3) Add chapters/timestamps. 4) Pin a comment with key links.";
  }

  let improved_title = video.title;
  if (ctr < 4) {
    const words = (video.title || "").split(" ");
    improved_title = "I Tried " + (words.slice(-3).join(" ") || "This") + " For 30 Days (Shocking Results)";
  }

  let next_video_advice = "";
  if (ctr >= 5 && retention >= 35) {
    next_video_advice = "This format WORKS. Double down: 1) Create a series with same style. 2) Make a 'Part 2' building on this. 3) Cover related topics with same thumbnail style. 4) Repurpose into Shorts.";
  } else {
    next_video_advice = "Pivot strategy: 1) Study top 3 videos in your niche this week. 2) Use same thumbnail format. 3) Test a more controversial/emotional angle. 4) Make a 'response' to trending content in your niche.";
  }

  return {
    main_reason,
    thumbnail_analysis,
    title_analysis,
    retention_analysis,
    seo_analysis,
    improved_title,
    next_video_advice,
    source: "built-in-analysis",
  };
}

export async function analyzeVideo(video: any) {
  const ctr = video.ctr || 0;
  const retention = video.avg_view_percentage || 0;

  const score = calculatePerformanceScore({
    ctr,
    avg_view_percentage: retention,
    likes: video.likes || 0,
    views: video.views || 0,
    comments: video.comments || 0,
  });

  const issues = diagnoseVideo({
    ctr,
    avg_view_percentage: retention,
    views: video.views || 0,
    impressions: video.impressions || 0,
  });

  const ctrRating = getCTRRating(ctr);
  const retentionRating = getRetentionRating(retention);

  let aiAnalysis = null;
  
  if (hasAI()) {
    try {
      const prompt = "You are a YouTube growth expert. Analyze this video and give specific actionable advice.\n\nVideo Data:\n- Title: " + video.title + "\n- Views: " + (video.views || 0) + "\n- CTR: " + ctr + "%\n- Retention: " + retention + "%\n- Likes: " + (video.likes || 0) + "\n- Comments: " + (video.comments || 0) + "\n- Duration: " + Math.floor((video.duration_seconds || 0) / 60) + " minutes\n- Tags: " + ((video.tags || []).slice(0, 10).join(", ")) + "\n- Description preview: " + ((video.description || "").substring(0, 200)) + "\n\nRespond ONLY with valid JSON containing these exact keys: main_reason, thumbnail_analysis, title_analysis, retention_analysis, seo_analysis, improved_title, next_video_advice. Each value should be 2-3 sentences with SPECIFIC actionable advice.";
      
      aiAnalysis = await callAI(prompt);
      if (aiAnalysis) aiAnalysis.source = "ai-powered";
    } catch (e) {
      console.error("AI call failed:", e);
    }
  }

  if (!aiAnalysis) {
    aiAnalysis = generateBuiltInAnalysis({ ...video, ctr, avg_view_percentage: retention });
  }

  const recommendations = [];
  if (ctr < 4) recommendations.push("Redesign thumbnail with brighter colors and clearer face emotion");
  if (ctr < 4) recommendations.push("Rewrite title with numbers and curiosity gap");
  if (retention < 30) recommendations.push("Fix the hook - first 30 seconds must be most engaging");
  if (retention < 30) recommendations.push("Cut unnecessary intro - get straight to value");
  if ((video.impressions || 0) < 2000) recommendations.push("Improve SEO - add more relevant tags");
  if (score >= 70) recommendations.push("This video works! Create a follow-up in same format");

  const strengths = [];
  if (ctr >= 7) strengths.push("Excellent CTR - thumbnail and title are very effective");
  if (retention >= 40) strengths.push("Strong retention - content is engaging");
  if (video.views >= 10000) strengths.push("Solid view count showing good reach");
  if ((video.likes / Math.max(video.views, 1)) >= 0.05) strengths.push("High engagement rate");

  return {
    performance_score: score,
    ctr_rating: ctrRating.label,
    retention_rating: retentionRating.label,
    issues,
    strengths,
    recommendations,
    ai: aiAnalysis,
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
    reason: "Story-based titles with time commitments perform 40% better than tutorials",
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
      { type: "curiosity", script: "In the next 5 minutes, I am going to show you exactly how to " + videoTitle + ". And by the end, you will never look at this the same way again. But first, let me show you what most people get completely wrong..." },
      { type: "shocking-stat", script: "97% of people fail at this. And the reason is so simple, you will be shocked. I spent 6 months researching " + videoTitle + " and the truth nobody talks about is..." },
      { type: "story", script: "Last month, something happened that completely changed how I think about " + videoTitle + ". I lost everything. But what I discovered next changed my life. Here is the full story..." },
      { type: "direct-value", script: "By the end of this video, you will know exactly how to " + videoTitle + ". No fluff, no theory - just step by step what actually works in 2025. Let us start with step one..." },
      { type: "controversial", script: "Everything you have been told about " + videoTitle + " is WRONG. The gurus are lying to you. And in the next 5 minutes, I will prove it with real data..." },
      { type: "mrbeast", script: "I just spent $10,000 testing " + videoTitle + " so you do not have to. The results were INSANE. And what I am about to show you will change everything..." },
    ],
    ai: false,
  };
}
