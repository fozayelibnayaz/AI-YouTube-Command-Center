"use client";
import { useState, useEffect } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { VideoCard } from "@/components/dashboard/video-card";
import { calculatePerformanceScore, formatNumber } from "@/lib/utils";
import {
  Eye, Users, Heart, MessageSquare, TrendingUp,
  Bell, RefreshCw, Trophy, AlertTriangle, Brain, BarChart3, Zap,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle, Activity, X, Send, Info
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
  const [lastSync, setLastSync] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showDataInfo, setShowDataInfo] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [chRes, vidRes] = await Promise.all([
        fetch("/api/youtube?action=channel"),
        fetch("/api/youtube?action=videos&max=500"),
      ]);
      const ch = await chRes.json();
      const vid = await vidRes.json();
      const subs = ch.data?.subscribers || 1000;

      const videos = (vid.data || []).map((v: any) => ({
        ...v, ...(v.analytics || {}),
        score: calculatePerformanceScore({
          views: v.views || 0, likes: v.likes || 0, comments: v.comments || 0,
          publishedAt: v.published_at, channelSubscribers: subs,
        }),
      })).sort((a: any, b: any) => b.score - a.score);

      const totalViews = videos.reduce((s: number, v: any) => s + (v.views || 0), 0);
      const totalLikes = videos.reduce((s: number, v: any) => s + (v.likes || 0), 0);
      const totalComments = videos.reduce((s: number, v: any) => s + (v.comments || 0), 0);
      const avgEng = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

      const stats = {
        totalViews,
        totalLikes,
        totalComments,
        avgEngagement: avgEng,
        totalEngagement: totalLikes + totalComments,
      };
      setData({ channel: ch.data, videos, stats });
      setLastSync(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed to load data");
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
        body: JSON.stringify({ action: "analyze_video", payload: { video, channelSubscribers: data?.channel?.subscribers } }),
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

  async function previewEvents() {
    setEventsLoading(true);
    setStatus("🔍 Detecting events...");
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) {
        setEvents(json.events || []);
        setShowEvents(true);
        setStatus(`�� ${json.eventsDetected} events detected`);
      } else {
        setStatus("❌ " + (json.error || "Unknown"));
      }
    } catch (e) {
      setStatus("❌ " + String(e));
    } finally {
      setEventsLoading(false);
      setTimeout(() => setStatus(""), 8000);
    }
  }

  async function sendSmartAlerts() {
    setEventsLoading(true);
    setStatus("📤 Sending alerts...");
    try {
      const res = await fetch("/api/notifications?send=true");
      const json = await res.json();
      if (json.success) {
        setEvents(json.events || []);
        setShowEvents(true);
        const ok = (json.sentResults || []).filter((r: any) => r.success).length;
        setStatus(`✅ ${ok}/${json.sent} alerts sent!`);
      } else {
        setStatus("❌ " + (json.error || "Unknown"));
      }
    } catch (e) {
      setStatus("❌ " + String(e));
    } finally {
      setEventsLoading(false);
      setTimeout(() => setStatus(""), 8000);
    }
  }

  async function sendTelegramTest() {
    setSyncing(true);
    setStatus("📤 Testing...");
    try {
      const res = await fetch("/api/telegram");
      const json = await res.json();
      setStatus(json.success ? "✅ Telegram works!" : "❌ " + (json.error || "Failed"));
    } catch (e) {
      setStatus("❌ " + String(e));
    } finally {
      setSyncing(false);
      setTimeout(() => setStatus(""), 5000);
    }
  }

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 5 * 60 * 1000); return () => clearInterval(i); }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading all videos...</p>
        </div>
      </div>
    );
  }

  const topVideo = data?.videos?.[0];
  const worstVideo = data?.videos?.[data?.videos?.length - 1];

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <BarChart3 className="text-red-400 flex-shrink-0" size={24} />
              <span className="leading-tight">AI YouTube Command Center</span>
            </h1>
            <p className="text-gray-400 mt-1 text-xs sm:text-sm">
              {data?.channel?.title || "Loading"} · {formatNumber(data?.channel?.subscribers || 0)} subs · {data?.videos?.length || 0} videos
              {lastSync && <span className="text-gray-600 ml-2">Synced: {lastSync}</span>}
            </p>
          </div>

          {/* Data Transparency Banner */}
          <button onClick={() => setShowDataInfo(!showDataInfo)} className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300">
            <Info size={12} /> {showDataInfo ? "Hide" : "Show"} data source info
          </button>
          {showDataInfo && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs space-y-2">
              <p className="text-green-400"><strong>✅ 100% REAL data:</strong> Views, Likes, Comments, Subscribers, Engagement Rate, Views/Day</p>
              <p className="text-yellow-400"><strong>⚠️ NOT available:</strong> CTR, Retention, Impressions, Watch Time, Revenue</p>
              <p className="text-gray-400">These require YouTube Analytics API (OAuth) which needs channel owner verification. The current YouTube Data API v3 (your free API key) does NOT provide these metrics.</p>
              <p className="text-gray-400">All scoring and alerts use ONLY verified real data.</p>
            </div>
          )}

          <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-2">
            <button onClick={previewEvents} disabled={eventsLoading} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs sm:text-sm disabled:opacity-50">
              <Activity size={14} className={eventsLoading ? "animate-pulse" : ""} />
              <span className="truncate">{eventsLoading ? "Detecting..." : "Preview Events"}</span>
            </button>
            <button onClick={sendSmartAlerts} disabled={eventsLoading} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm disabled:opacity-50">
              <Send size={14} className={eventsLoading ? "animate-pulse" : ""} />
              <span className="truncate">{eventsLoading ? "Sending..." : "Send Alerts"}</span>
            </button>
            <button onClick={sendTelegramTest} disabled={syncing} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-white text-xs sm:text-sm disabled:opacity-50">
              <Bell size={14} /> Test
            </button>
            <button onClick={fetchData} disabled={loading} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm disabled:opacity-50">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync
            </button>
          </div>
        </div>

        {status && (
          <div className={`p-3 rounded-lg text-xs sm:text-sm whitespace-pre-wrap break-words ${
            status.includes("❌") ? "bg-red-500/10 border border-red-500/30 text-red-400" :
            status.includes("✅") ? "bg-green-500/10 border border-green-500/30 text-green-400" :
            "bg-blue-500/10 border border-blue-500/30 text-blue-400"
          }`}>{status}</div>
        )}

        {showEvents && events.length > 0 && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
                <Activity size={16} className="text-purple-400" />
                Events ({events.length}) <span className="text-xs text-gray-500">- all real data</span>
              </h3>
              <button onClick={() => setShowEvents(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-2 max-h-80 sm:max-h-96 overflow-y-auto">
              {events.map((e: any, i: number) => (
                <div key={i} className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border ${
                  e.severity === "critical" ? "bg-red-500/10 border-red-500/20" :
                  e.severity === "warning" ? "bg-yellow-500/10 border-yellow-500/20" :
                  e.severity === "success" ? "bg-green-500/10 border-green-500/20" :
                  "bg-blue-500/10 border-blue-500/20"
                }`}>
                  <span className="text-base sm:text-lg flex-shrink-0">{e.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium text-gray-300">{e.type.replace(/_/g, " ").toUpperCase()}</p>
                    <p className="text-xs sm:text-sm text-white mt-0.5">{e.message}</p>
                    {e.data && <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
                      {Object.entries(e.data).slice(0, 6).map(([k, v]) => (
                        <span key={k} className="text-[10px] sm:text-xs bg-black/30 px-1.5 sm:px-2 py-0.5 rounded text-gray-400 truncate max-w-full">
                          {k}: <span className="text-white">{String(v).substring(0, 35)}</span>
                        </span>
                      ))}
                    </div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats - ALL REAL */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          <StatCard title="Total Views" value={data?.stats?.totalViews || 0} icon={<Eye size={16} />} color="blue" format="number" subtitle="100% real" />
          <StatCard title="Subscribers" value={data?.channel?.subscribers || 0} icon={<Users size={16} />} color="green" format="number" subtitle="100% real" />
          <StatCard title="Total Likes" value={data?.stats?.totalLikes || 0} icon={<Heart size={16} />} color="red" format="number" subtitle="100% real" />
          <StatCard title="Total Comments" value={data?.stats?.totalComments || 0} icon={<MessageSquare size={16} />} color="purple" format="number" subtitle="100% real" />
          <StatCard title="Avg Engagement" value={parseFloat((data?.stats?.avgEngagement || 0).toFixed(2))} icon={<TrendingUp size={16} />} color={(data?.stats?.avgEngagement || 0) >= 3 ? "green" : "yellow"} format="percent" subtitle="Likes+Comments/Views" />
        </div>

        {/* Best/Worst */}
        {topVideo && worstVideo && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl border border-green-500/20 bg-green-500/5">
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Trophy size={16} className="text-yellow-400" />
                  <span className="text-xs sm:text-sm font-medium text-green-400">BEST Performing (Real Score)</span>
                </div>
                <p className="text-white font-medium text-xs sm:text-sm mb-2 line-clamp-2">{topVideo.title}</p>
                <div className="flex gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-400 flex-wrap">
                  <span>Views: {formatNumber(topVideo.views)}</span>
                  <span>Likes: {formatNumber(topVideo.likes)}</span>
                  <span>Comments: {formatNumber(topVideo.comments)}</span>
                  <span className="text-green-400 font-bold">Score: {topVideo.score}/100</span>
                </div>
                <button onClick={() => analyzeVideo(topVideo.youtube_id)} disabled={analyzing[topVideo.youtube_id]} className="mt-3 text-xs text-green-400 hover:text-green-300 flex items-center gap-1 disabled:opacity-50">
                  <Brain size={12} />
                  {analyzing[topVideo.youtube_id] ? "Analyzing..." : analyses[topVideo.youtube_id] ? "Re-analyze" : "Why did this work?"}
                </button>
              </div>
              {analyses[topVideo.youtube_id] && (
                <div className="border-t border-green-500/20">
                  <button onClick={() => setTopExpanded(!topExpanded)} className="flex items-center gap-2 text-xs sm:text-sm text-green-400 w-full text-left px-3 sm:px-4 py-3">
                    <CheckCircle size={14} />
                    <span className="font-medium">AI Analysis {topExpanded ? "▲" : "▼"}</span>
                  </button>
                  {topExpanded && <div className="px-3 sm:px-4 pb-3 sm:pb-4"><AnalysisPanel analysis={analyses[topVideo.youtube_id]} /></div>}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5">
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-xs sm:text-sm font-medium text-red-400">WORST Performing (Real Score)</span>
                </div>
                <p className="text-white font-medium text-xs sm:text-sm mb-2 line-clamp-2">{worstVideo.title}</p>
                <div className="flex gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-400 flex-wrap">
                  <span>Views: {formatNumber(worstVideo.views)}</span>
                  <span>Likes: {formatNumber(worstVideo.likes)}</span>
                  <span>Comments: {formatNumber(worstVideo.comments)}</span>
                  <span className="text-red-400 font-bold">Score: {worstVideo.score}/100</span>
                </div>
                <button onClick={() => analyzeVideo(worstVideo.youtube_id)} disabled={analyzing[worstVideo.youtube_id]} className="mt-3 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50">
                  <Brain size={12} />
                  {analyzing[worstVideo.youtube_id] ? "Analyzing..." : analyses[worstVideo.youtube_id] ? "Re-analyze" : "Why did this fail?"}
                </button>
              </div>
              {analyses[worstVideo.youtube_id] && (
                <div className="border-t border-red-500/20">
                  <button onClick={() => setWorstExpanded(!worstExpanded)} className="flex items-center gap-2 text-xs sm:text-sm text-red-400 w-full text-left px-3 sm:px-4 py-3">
                    <AlertCircle size={14} />
                    <span className="font-medium">AI Analysis {worstExpanded ? "▲" : "▼"}</span>
                  </button>
                  {worstExpanded && <div className="px-3 sm:px-4 pb-3 sm:pb-4"><AnalysisPanel analysis={analyses[worstVideo.youtube_id]} /></div>}
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white flex items-center gap-2">
              <Zap size={18} className="text-red-400" />All Videos
            </h2>
            <span className="text-[10px] sm:text-xs px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400">
              {data?.videos?.length || 0} videos
            </span>
          </div>
          {(!data?.videos || data.videos.length === 0) ? (
            <div className="text-center py-16 sm:py-20 text-gray-500">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">No videos found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
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
      {analysis.issues?.length > 0 && <div className="space-y-2">
        <p className="text-xs font-medium text-red-400 flex items-center gap-1"><AlertTriangle size={12} /> Issues ({analysis.issues.length})</p>
        {analysis.issues.map((issue: any, i: number) => (
          <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 sm:p-3">
            <p className="text-xs text-red-300 font-medium">{issue.issue}</p>
            <p className="text-xs text-gray-400 mt-1"><strong>Fix:</strong> {issue.fix}</p>
          </div>
        ))}
      </div>}
      {analysis.strengths?.length > 0 && <div className="space-y-1">
        <p className="text-xs font-medium text-green-400 flex items-center gap-1"><CheckCircle size={12} /> Strengths</p>
        {analysis.strengths.map((s: string, i: number) => <p key={i} className="text-xs text-gray-300 bg-green-500/10 rounded px-2 py-1.5">+ {s}</p>)}
      </div>}
      {analysis.ai && <div className="space-y-2">
        {analysis.ai.main_reason && <B c="purple" l="WHY" t={analysis.ai.main_reason} />}
        {analysis.ai.thumbnail_analysis && <B c="blue" l="THUMBNAIL" t={analysis.ai.thumbnail_analysis} />}
        {analysis.ai.title_analysis && <B c="cyan" l="TITLE" t={analysis.ai.title_analysis} />}
        {analysis.ai.engagement_analysis && <B c="yellow" l="ENGAGEMENT" t={analysis.ai.engagement_analysis} />}
        {analysis.ai.seo_analysis && <B c="orange" l="SEO" t={analysis.ai.seo_analysis} />}
        {analysis.ai.improved_title && <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 sm:p-3"><p className="text-xs font-medium text-green-400 mb-1">BETTER TITLE</p><p className="text-xs sm:text-sm text-white font-medium">{analysis.ai.improved_title}</p></div>}
        {analysis.ai.next_video_advice && <B c="pink" l="NEXT VIDEO" t={analysis.ai.next_video_advice} />}
      </div>}
      {analysis.recommendations?.length > 0 && <div>
        <p className="text-xs font-medium text-orange-400 mb-2">RECOMMENDATIONS</p>
        {analysis.recommendations.map((r: string, i: number) => <p key={i} className="text-xs text-gray-400">→ {r}</p>)}
      </div>}
    </div>
  );
}

function B({ c, l, t }: { c: string; l: string; t: string }) {
  const m: Record<string, string> = {
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    pink: "bg-pink-500/10 border-pink-500/20 text-pink-400"
  };
  const cls = m[c] || m.blue;
  return <div className={"border rounded-lg p-2 sm:p-3 " + cls.split(" ").slice(0, 2).join(" ")}><p className={"text-xs font-medium mb-1 " + cls.split(" ")[2]}>{l}</p><p className="text-xs text-gray-300 leading-relaxed">{t}</p></div>;
}
