"use client";
import { useState, useEffect } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { VideoCard } from "@/components/dashboard/video-card";
import { calculatePerformanceScore, formatNumber } from "@/lib/utils";
import {
  Eye, Users, TrendingUp, Clock, Video,
  Bell, RefreshCw, Trophy, AlertTriangle, Brain, BarChart3, Zap,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle, Activity
} from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [analyses, setAnalyses] = useState<Record<string, any>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState("");
  const [topExpanded, setTopExpanded] = useState(false);
  const [worstExpanded, setWorstExpanded] = useState(false);
  const [lastSync, setLastSync] = useState<string>("");

  async function fetchData() {
    setLoading(true);
    try {
      const [chRes, vidRes] = await Promise.all([
        fetch("/api/youtube?action=channel"),
        fetch("/api/youtube?action=videos&max=500"),
      ]);
      const ch = await chRes.json();
      const vid = await vidRes.json();

      const videos = (vid.data || []).map((v: any) => ({
        ...v,
        ...(v.analytics || {}),
        score: calculatePerformanceScore({
          ctr: v.analytics?.ctr || 0,
          avg_view_percentage: v.analytics?.avg_view_percentage || 0,
          likes: v.likes || 0,
          views: v.views || 0,
          comments: v.comments || 0,
        }),
      })).sort((a: any, b: any) => b.score - a.score);

      // Calculate total engagement (likes + comments) as real, useful metric
      const totalEngagement = videos.reduce(
        (s: number, v: any) => s + (v.likes || 0) + (v.comments || 0),
        0
      );

      const stats = {
        totalViews: videos.reduce((s: number, v: any) => s + (v.views || 0), 0),
        avgCTR: videos.length ? videos.reduce((s: number, v: any) => s + (v.ctr || 0), 0) / videos.length : 0,
        avgRetention: videos.length ? videos.reduce((s: number, v: any) => s + (v.avg_view_percentage || 0), 0) / videos.length : 0,
        totalEngagement,
        videoCount: videos.length,
      };

      setData({ channel: ch.data, videos, stats });
      setLastSync(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("fetchData error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeVideo(id: string) {
    const video = data?.videos?.find((v: any) => v.youtube_id === id);
    if (!video) return;
    setAnalyzing(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze_video", payload: { video } }),
      });
      const json = await res.json();
      if (json.success) {
        setAnalyses(prev => ({ ...prev, [id]: json.data }));
        const topId = data?.videos?.[0]?.youtube_id;
        const worstId = data?.videos?.[data?.videos?.length - 1]?.youtube_id;
        if (id === topId) setTopExpanded(true);
        if (id === worstId) setWorstExpanded(true);
      }
    } finally {
      setAnalyzing(prev => ({ ...prev, [id]: false }));
    }
  }

  async function sendTelegramTest() {
    setSyncing(true);
    setStatus("Sending test...");
    try {
      const res = await fetch("/api/telegram");
      const json = await res.json();
      setStatus(json.success ? "✅ Test sent to Telegram!" : "❌ Telegram not configured");
    } catch {
      setStatus("❌ Error sending");
    } finally {
      setSyncing(false);
      setTimeout(() => setStatus(""), 4000);
    }
  }

  async function checkAndSendNotifications() {
    setSyncing(true);
    setStatus("Detecting events...");
    try {
      const res = await fetch("/api/notifications?send=true");
      const json = await res.json();
      if (json.success) {
        setStatus(`✅ ${json.eventsDetected} events detected, ${json.sent} sent to Telegram`);
      } else {
        setStatus("❌ " + (json.error || "Failed"));
      }
    } catch (e) {
      setStatus("❌ Error: " + String(e));
    } finally {
      setSyncing(false);
      setTimeout(() => setStatus(""), 6000);
    }
  }

  async function previewEvents() {
    setSyncing(true);
    setStatus("Detecting...");
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) {
        setStatus(`📊 ${json.eventsDetected} events detected (dry-run, not sent)`);
      }
    } finally {
      setSyncing(false);
      setTimeout(() => setStatus(""), 6000);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading all YouTube videos...</p>
        </div>
      </div>
    );
  }

  const topVideo = data?.videos?.[0];
  const worstVideo = data?.videos?.[data?.videos?.length - 1];
  const isDemo = data?.channel?.demo;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="text-red-400" size={32} />
              AI YouTube Command Center
            </h1>
            <p className="text-gray-400 mt-1">
              {data?.channel?.title || "Loading"} &mdash;{" "}
              {formatNumber(data?.channel?.subscribers || 0)} subscribers
              {" "}&middot; {data?.videos?.length || 0} videos tracked
              {lastSync && <span className="ml-2 text-gray-600 text-xs">Last sync: {lastSync}</span>}
              {isDemo && (
                <span className="ml-2 text-yellow-400 text-xs bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                  DEMO MODE
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {status && <span className="text-sm text-green-400">{status}</span>}
            <button onClick={previewEvents} disabled={syncing} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm disabled:opacity-50">
              <Activity size={14} /> Preview Events
            </button>
            <button onClick={checkAndSendNotifications} disabled={syncing} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm disabled:opacity-50">
              <Bell size={14} /> Send Smart Alerts
            </button>
            <button onClick={sendTelegramTest} disabled={syncing} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-white text-sm disabled:opacity-50">
              <Bell size={14} /> Test Telegram
            </button>
            <button onClick={fetchData} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard title="Total Views" value={data?.stats?.totalViews || 0} icon={<Eye size={18} />} color="blue" change={12} format="number" />
          <StatCard title="Subscribers" value={data?.channel?.subscribers || 0} icon={<Users size={18} />} color="green" change={8} format="number" />
          <StatCard title="Avg CTR" value={parseFloat((data?.stats?.avgCTR || 0).toFixed(1))} icon={<TrendingUp size={18} />} color={(data?.stats?.avgCTR || 0) >= 5 ? "green" : "yellow"} format="percent" subtitle="Target: >5%" />
          <StatCard title="Avg Retention" value={parseFloat((data?.stats?.avgRetention || 0).toFixed(1))} icon={<Clock size={18} />} color={(data?.stats?.avgRetention || 0) >= 35 ? "green" : "yellow"} format="percent" subtitle="Target: >35%" />
          <StatCard title="Total Engagement" value={data?.stats?.totalEngagement || 0} icon={<Video size={18} />} color="purple" format="number" subtitle="Likes + Comments" />
        </div>

        {topVideo && worstVideo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-green-500/20 bg-green-500/5">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={16} className="text-yellow-400" />
                  <span className="text-sm font-medium text-green-400">BEST Performing Video</span>
                </div>
                <p className="text-white font-medium text-sm mb-2 line-clamp-2">{topVideo.title}</p>
                <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                  <span>Views: {formatNumber(topVideo.views)}</span>
                  <span>CTR: {topVideo.ctr}%</span>
                  <span>Retention: {topVideo.avg_view_percentage}%</span>
                  <span className="text-green-400 font-bold">Score: {topVideo.score}/100</span>
                </div>
                <button onClick={() => analyzeVideo(topVideo.youtube_id)} disabled={analyzing[topVideo.youtube_id]} className="mt-3 text-xs text-green-400 hover:text-green-300 flex items-center gap-1 disabled:opacity-50">
                  <Brain size={12} />
                  {analyzing[topVideo.youtube_id] ? "Analyzing..." : analyses[topVideo.youtube_id] ? "Re-analyze" : "Why did this work?"}
                </button>
              </div>
              {analyses[topVideo.youtube_id] && (
                <div className="border-t border-green-500/20">
                  <button onClick={() => setTopExpanded(!topExpanded)} className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300 w-full text-left px-4 py-3">
                    <CheckCircle size={14} />
                    <span className="font-medium">AI Analysis Ready - Click to {topExpanded ? "Hide" : "View"}</span>
                    {topExpanded ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
                  </button>
                  {topExpanded && <div className="px-4 pb-4"><AnalysisPanel analysis={analyses[topVideo.youtube_id]} /></div>}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/5">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-sm font-medium text-red-400">WORST Performing Video</span>
                </div>
                <p className="text-white font-medium text-sm mb-2 line-clamp-2">{worstVideo.title}</p>
                <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                  <span>Views: {formatNumber(worstVideo.views)}</span>
                  <span>CTR: {worstVideo.ctr}%</span>
                  <span>Retention: {worstVideo.avg_view_percentage}%</span>
                  <span className="text-red-400 font-bold">Score: {worstVideo.score}/100</span>
                </div>
                <button onClick={() => analyzeVideo(worstVideo.youtube_id)} disabled={analyzing[worstVideo.youtube_id]} className="mt-3 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50">
                  <Brain size={12} />
                  {analyzing[worstVideo.youtube_id] ? "Analyzing..." : analyses[worstVideo.youtube_id] ? "Re-analyze" : "Why did this fail?"}
                </button>
              </div>
              {analyses[worstVideo.youtube_id] && (
                <div className="border-t border-red-500/20">
                  <button onClick={() => setWorstExpanded(!worstExpanded)} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 w-full text-left px-4 py-3">
                    <AlertCircle size={14} />
                    <span className="font-medium">AI Analysis Ready - Click to {worstExpanded ? "Hide" : "View"}</span>
                    {worstExpanded ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
                  </button>
                  {worstExpanded && <div className="px-4 pb-4"><AnalysisPanel analysis={analyses[worstVideo.youtube_id]} /></div>}
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap size={20} className="text-red-400" />
              All Videos Ranked by AI Score
            </h2>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400">
              {data?.videos?.length || 0} videos
            </span>
          </div>

          {(!data?.videos || data.videos.length === 0) ? (
            <div className="text-center py-20 text-gray-500">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">No videos found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.videos.map((video: any, i: number) => (
                <VideoCard key={video.youtube_id} video={video} rank={i + 1} onAnalyze={analyzeVideo} analysis={analyses[video.youtube_id]} analyzing={analyzing[video.youtube_id]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: any }) {
  if (!analysis) return null;
  return (
    <div className="space-y-3">
      {analysis.issues?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-red-400 flex items-center gap-1">
            <AlertTriangle size={12} /> Issues Detected ({analysis.issues.length})
          </p>
          {analysis.issues.map((issue: any, i: number) => (
            <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-red-300 font-medium">{issue.issue}</p>
              <p className="text-xs text-gray-400 mt-1"><strong>Fix:</strong> {issue.fix}</p>
            </div>
          ))}
        </div>
      )}
      {analysis.strengths?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-green-400 flex items-center gap-1">
            <CheckCircle size={12} /> Strengths
          </p>
          {analysis.strengths.map((s: string, i: number) => (
            <p key={i} className="text-xs text-gray-300 bg-green-500/10 rounded px-2 py-1.5">+ {s}</p>
          ))}
        </div>
      )}
      {analysis.ai && (
        <div className="space-y-2">
          {analysis.ai.main_reason && <Block color="purple" label="WHY This Performed This Way" text={analysis.ai.main_reason} />}
          {analysis.ai.thumbnail_analysis && <Block color="blue" label="THUMBNAIL Analysis" text={analysis.ai.thumbnail_analysis} />}
          {analysis.ai.title_analysis && <Block color="cyan" label="TITLE Analysis" text={analysis.ai.title_analysis} />}
          {analysis.ai.retention_analysis && <Block color="yellow" label="RETENTION Analysis" text={analysis.ai.retention_analysis} />}
          {analysis.ai.seo_analysis && <Block color="orange" label="SEO Analysis" text={analysis.ai.seo_analysis} />}
          {analysis.ai.improved_title && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs font-medium text-green-400 mb-1">SUGGESTED Better Title</p>
              <p className="text-sm text-white font-medium">&ldquo;{analysis.ai.improved_title}&rdquo;</p>
            </div>
          )}
          {analysis.ai.next_video_advice && <Block color="pink" label="NEXT Video Strategy" text={analysis.ai.next_video_advice} />}
          {analysis.ai.source && (
            <p className="text-xs text-gray-600 text-center">
              Powered by {analysis.ai.source === "ai-powered" ? "AI (Groq/OpenAI)" : "Built-in expert system"}
            </p>
          )}
        </div>
      )}
      {analysis.recommendations?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-orange-400 mb-2">QUICK Recommendations</p>
          <ul className="space-y-1">
            {analysis.recommendations.map((r: string, i: number) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                <span className="text-orange-400 mt-0.5">→</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Block({ color, label, text }: { color: string; label: string; text: string }) {
  const colors: Record<string, string> = {
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    pink: "bg-pink-500/10 border-pink-500/20 text-pink-400",
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={"border rounded-lg p-3 " + c.split(" ").slice(0, 2).join(" ")}>
      <p className={"text-xs font-medium mb-1 " + c.split(" ")[2]}>{label}</p>
      <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
    </div>
  );
}
