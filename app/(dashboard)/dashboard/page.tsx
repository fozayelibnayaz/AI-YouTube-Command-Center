"use client";
import { useState, useEffect } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { VideoCard } from "@/components/dashboard/video-card";
import { OAuthBanner } from "@/components/oauth-banner";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ComparisonCard } from "@/components/ui/comparison-card";
import { calculatePerformanceScore, formatNumber } from "@/lib/utils";
import { DateRange, getPresetRanges } from "@/lib/date-ranges";
import {
  Eye, Users, Heart, MessageSquare, TrendingUp, Clock, Share2,
  Bell, RefreshCw, Trophy, AlertTriangle, Brain, BarChart3, Zap,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle, Activity, X, Send,
  GitCompareArrows
} from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);
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
  const [hasRealData, setHasRealData] = useState(false);

  // Default to "Last 3 Months"
  const defaultRange = getPresetRanges().find(r => r.label === "Last 3 Months")!;
  const [range, setRange] = useState<DateRange>(defaultRange);

  async function fetchData(r: DateRange = range) {
    setLoading(true);
    try {
      // Fetch current period
      const [chRes, vidRes] = await Promise.all([
        fetch("/api/youtube?action=channel"),
        fetch(`/api/youtube?action=videos&max=500&startDate=${r.startDate}&endDate=${r.endDate}`),
      ]);
      const ch = await chRes.json();
      const vid = await vidRes.json();
      const subs = ch.data?.subscribers || 1000;

      const videos = (vid.data || []).map((v: any) => ({
        ...v, ...(v.analytics || {}),
        score: calculatePerformanceScore({
          views: v.views || 0, likes: v.likes || 0, comments: v.comments || 0,
          publishedAt: v.published_at, channelSubscribers: subs,
          ctr: v.analytics?.ctr ?? null,
          retention: v.analytics?.avg_view_percentage ?? null,
        }),
      })).sort((a: any, b: any) => b.score - a.score);

      const realCount = videos.filter((v: any) => v.has_real_analytics).length;
      setHasRealData(realCount > 0);

      const stats = computeStats(videos);

      setData({ channel: ch.data, videos, stats, range: r });

      // If comparison range, fetch previous period too
      if (r.type === "comparison" && r.comparison) {
        const cmpRes = await fetch(`/api/youtube?action=videos&max=500&startDate=${r.comparison.startDate}&endDate=${r.comparison.endDate}`);
        const cmpJson = await cmpRes.json();
        const cmpVideos = (cmpJson.data || []).map((v: any) => ({ ...v, ...(v.analytics || {}) }));
        const cmpStats = computeStats(cmpVideos);
        setComparisonData({ videos: cmpVideos, stats: cmpStats, range: r.comparison });
      } else {
        setComparisonData(null);
      }

      setLastSync(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function computeStats(videos: any[]) {
    const totalViews = videos.reduce((s: number, v: any) => s + (v.views || 0), 0);
    const totalLikes = videos.reduce((s: number, v: any) => s + (v.likes || 0), 0);
    const totalComments = videos.reduce((s: number, v: any) => s + (v.comments || 0), 0);
    const totalShares = videos.reduce((s: number, v: any) => s + (v.shares || 0), 0);
    const totalWatchTime = videos.reduce((s: number, v: any) => s + (v.watch_time_minutes || 0), 0);
    const totalSubsGained = videos.reduce((s: number, v: any) => s + (v.subscribers_gained || 0), 0);
    const avgEng = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
    const retVids = videos.filter((v: any) => v.avg_view_percentage !== null && v.avg_view_percentage !== undefined);
    const avgRetention = retVids.length > 0 ? retVids.reduce((s: number, v: any) => s + v.avg_view_percentage, 0) / retVids.length : 0;

    return {
      totalViews, totalLikes, totalComments, totalShares, totalWatchTime,
      totalSubsGained, avgEng, avgRetention,
      activeVideos: videos.filter((v: any) => (v.views || 0) > 0).length,
    };
  }

  function onRangeChange(r: DateRange) {
    setRange(r);
    fetchData(r);
  }

  async function analyzeVideo(id: string) {
    const video = data?.videos?.find((v: any) => v.youtube_id === id);
    if (!video) return;
    setAnalyzing(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze_video", payload: { video, channelSubscribers: data?.channel?.subscribers } }),
      });
      const json = await res.json();
      if (json.success) {
        setAnalyses(prev => ({ ...prev, [id]: json.data }));
        const bw = getBestWorst();
        if (id === bw.best?.youtube_id) setTopExpanded(true);
        if (id === bw.worst?.youtube_id) setWorstExpanded(true);
      }
    } finally {
      setAnalyzing(prev => ({ ...prev, [id]: false }));
    }
  }

  async function previewEvents() {
    setEventsLoading(true); setStatus("🔍 Detecting...");
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) { setEvents(json.events || []); setShowEvents(true); setStatus(`📊 ${json.eventsDetected} events`); }
      else setStatus("❌ " + (json.error || "Unknown"));
    } catch (e) { setStatus("❌ " + String(e)); }
    finally { setEventsLoading(false); setTimeout(() => setStatus(""), 8000); }
  }

  async function sendSmartAlerts() {
    setEventsLoading(true); setStatus("📤 Sending...");
    try {
      const res = await fetch("/api/notifications?send=true");
      const json = await res.json();
      if (json.success) {
        setEvents(json.events || []); setShowEvents(true);
        if (json.sentSuccess === json.sent) setStatus(`✅ All ${json.sentSuccess} alerts sent!`);
        else setStatus(`⚠️ ${json.sentSuccess}/${json.sent} sent`);
      } else setStatus("❌ " + (json.error || "Unknown"));
    } catch (e) { setStatus("❌ " + String(e)); }
    finally { setEventsLoading(false); setTimeout(() => setStatus(""), 10000); }
  }

  async function sendTelegramTest() {
    setSyncing(true); setStatus("📤 Testing...");
    try {
      const res = await fetch("/api/telegram");
      const json = await res.json();
      setStatus(json.success ? "✅ Telegram works!" : "❌ " + (json.error || "Failed"));
    } catch (e) { setStatus("❌ " + String(e)); }
    finally { setSyncing(false); setTimeout(() => setStatus(""), 5000); }
  }

  function getBestWorst() {
    if (!data?.videos?.length) return { best: null, worst: null };
    const active = data.videos.filter((v: any) => (v.views || 0) > 0);
    if (active.length === 0) return { best: null, worst: null };
    const sorted = [...active].sort((a, b) => (b.score || 0) - (a.score || 0));
    return { best: sorted[0], worst: sorted.length > 1 ? sorted[sorted.length - 1] : null };
  }

  useEffect(() => {
    fetchData(range);
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth_success")) setStatus("✅ YouTube connected!");
    if (params.get("oauth_error")) setStatus("❌ OAuth: " + params.get("oauth_error"));
    window.history.replaceState({}, "", "/dashboard");
    const i = setInterval(() => fetchData(range), 5 * 60 * 1000);
    return () => clearInterval(i);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const { best: topVideo, worst: worstVideo } = getBestWorst();
  const isComparison = range.type === "comparison" && comparisonData;

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        <div className="space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <BarChart3 className="text-red-400 flex-shrink-0" size={24} />
              <span className="leading-tight">AI YouTube Command Center</span>
            </h1>
            <p className="text-gray-400 mt-1 text-xs sm:text-sm">
              {data?.channel?.title} · {formatNumber(data?.channel?.subscribers || 0)} subs · {data?.videos?.length || 0} videos
              ({data?.stats?.activeVideos || 0} with views)
              {hasRealData && <span className="ml-2 text-green-400 text-[10px] bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">✓ REAL</span>}
              {lastSync && <span className="text-gray-600 ml-2">Synced: {lastSync}</span>}
            </p>
          </div>

          <OAuthBanner />

          {/* Date Range Picker */}
          <DateRangePicker value={range} onChange={onRangeChange} />

          <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-2">
            <button onClick={previewEvents} disabled={eventsLoading} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs sm:text-sm disabled:opacity-50">
              <Activity size={14} className={eventsLoading ? "animate-pulse" : ""} />
              {eventsLoading ? "..." : "Preview Events"}
            </button>
            <button onClick={sendSmartAlerts} disabled={eventsLoading} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm disabled:opacity-50">
              <Send size={14} /> Send Alerts
            </button>
            <button onClick={sendTelegramTest} disabled={syncing} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-white text-xs sm:text-sm disabled:opacity-50">
              <Bell size={14} /> Test
            </button>
            <button onClick={() => fetchData(range)} disabled={loading} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm disabled:opacity-50">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync
            </button>
          </div>
        </div>

        {status && (
          <div className={`p-3 rounded-lg text-xs sm:text-sm whitespace-pre-wrap break-words ${
            status.includes("❌") ? "bg-red-500/10 border border-red-500/30 text-red-400" :
            status.includes("✅") ? "bg-green-500/10 border border-green-500/30 text-green-400" :
            status.includes("⚠️") ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400" :
            "bg-blue-500/10 border border-blue-500/30 text-blue-400"
          }`}>{status}</div>
        )}

        {showEvents && events.length > 0 && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
                <Activity size={16} className="text-purple-400" />Events ({events.length})
              </h3>
              <button onClick={() => setShowEvents(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map((e: any, i: number) => (
                <div key={i} className={`flex items-start gap-2 p-2 sm:p-3 rounded-lg border ${
                  e.severity === "critical" ? "bg-red-500/10 border-red-500/20" :
                  e.severity === "warning" ? "bg-yellow-500/10 border-yellow-500/20" :
                  e.severity === "success" ? "bg-green-500/10 border-green-500/20" :
                  "bg-blue-500/10 border-blue-500/20"
                }`}>
                  <span className="text-base sm:text-lg flex-shrink-0">{e.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium text-gray-300">{e.type.replace(/_/g, " ").toUpperCase()}</p>
                    <p className="text-xs sm:text-sm text-white mt-0.5">{e.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comparison View or Single Period View */}
        {isComparison ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <GitCompareArrows size={16} className="text-purple-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">Period Comparison</h2>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              <span className="text-blue-400">{range.startDate} → {range.endDate}</span>
              {" vs "}
              <span className="text-purple-400">{range.comparison?.startDate} → {range.comparison?.endDate}</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              <ComparisonCard title="Total Views" current={data?.stats?.totalViews || 0} previous={comparisonData?.stats?.totalViews || 0} icon={<Eye size={16} />} color="blue" />
              <ComparisonCard title="Total Likes" current={data?.stats?.totalLikes || 0} previous={comparisonData?.stats?.totalLikes || 0} icon={<Heart size={16} />} color="red" />
              <ComparisonCard title="Comments" current={data?.stats?.totalComments || 0} previous={comparisonData?.stats?.totalComments || 0} icon={<MessageSquare size={16} />} color="purple" />
              <ComparisonCard title="Engagement" current={parseFloat((data?.stats?.avgEng || 0).toFixed(2))} previous={parseFloat((comparisonData?.stats?.avgEng || 0).toFixed(2))} format="percent" icon={<TrendingUp size={16} />} color="yellow" />
              {hasRealData && <ComparisonCard title="Avg Retention" current={parseFloat((data?.stats?.avgRetention || 0).toFixed(1))} previous={parseFloat((comparisonData?.stats?.avgRetention || 0).toFixed(1))} format="percent" icon={<Clock size={16} />} color="green" />}
              {hasRealData && <ComparisonCard title="Watch Hours" current={Math.round((data?.stats?.totalWatchTime || 0) / 60)} previous={Math.round((comparisonData?.stats?.totalWatchTime || 0) / 60)} icon={<Clock size={16} />} color="cyan" />}
              {hasRealData && <ComparisonCard title="Shares" current={data?.stats?.totalShares || 0} previous={comparisonData?.stats?.totalShares || 0} icon={<Share2 size={16} />} color="purple" />}
              {hasRealData && <ComparisonCard title="Subs Gained" current={data?.stats?.totalSubsGained || 0} previous={comparisonData?.stats?.totalSubsGained || 0} icon={<Users size={16} />} color="green" />}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <StatCard title="Total Views" value={data?.stats?.totalViews || 0} icon={<Eye size={16} />} color="blue" format="number" />
            <StatCard title="Subscribers" value={data?.channel?.subscribers || 0} icon={<Users size={16} />} color="green" format="number" />
            <StatCard title="Total Likes" value={data?.stats?.totalLikes || 0} icon={<Heart size={16} />} color="red" format="number" />
            <StatCard title="Comments" value={data?.stats?.totalComments || 0} icon={<MessageSquare size={16} />} color="purple" format="number" />
            {data?.stats?.avgRetention > 0 ? (
              <StatCard title="Avg Retention" value={parseFloat(data.stats.avgRetention.toFixed(1))} icon={<Clock size={16} />} color={data.stats.avgRetention >= 35 ? "green" : "yellow"} format="percent" subtitle="✓ REAL" />
            ) : (
              <StatCard title="Engagement" value={parseFloat((data?.stats?.avgEng || 0).toFixed(2))} icon={<TrendingUp size={16} />} color="yellow" format="percent" subtitle="real calc" />
            )}
            <StatCard title={hasRealData ? "Watch Hrs" : "Shares"} value={hasRealData ? Math.round((data?.stats?.totalWatchTime || 0) / 60) : (data?.stats?.totalShares || 0)} icon={hasRealData ? <Clock size={16} /> : <Share2 size={16} />} color="cyan" format="number" subtitle={hasRealData ? "✓ REAL" : ""} />
          </div>
        )}

        {topVideo && worstVideo && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <BestWorstCard video={topVideo} type="best" expanded={topExpanded} setExpanded={setTopExpanded} analysis={analyses[topVideo.youtube_id]} analyzing={analyzing[topVideo.youtube_id]} onAnalyze={analyzeVideo} />
            <BestWorstCard video={worstVideo} type="worst" expanded={worstExpanded} setExpanded={setWorstExpanded} analysis={analyses[worstVideo.youtube_id]} analyzing={analyzing[worstVideo.youtube_id]} onAnalyze={analyzeVideo} />
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
            <div className="text-center py-16 text-gray-500"><BarChart3 size={48} className="mx-auto mb-4 opacity-30" /><p>No videos</p></div>
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

function BestWorstCard({ video, type, expanded, setExpanded, analysis, analyzing, onAnalyze }: any) {
  const isBest = type === "best";
  const engRate = video.views > 0 ? ((video.likes + video.comments) / video.views) * 100 : 0;
  return (
    <div className={`rounded-xl border ${isBest ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          {isBest ? <Trophy size={16} className="text-yellow-400" /> : <AlertTriangle size={16} className="text-red-400" />}
          <span className={`text-xs sm:text-sm font-medium ${isBest ? "text-green-400" : "text-red-400"}`}>{isBest ? "BEST" : "WORST"} Performing</span>
          {video.has_real_analytics && <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">REAL</span>}
        </div>
        <p className="text-white font-medium text-xs sm:text-sm mb-2 line-clamp-2">{video.title}</p>
        <div className="flex gap-2 text-[10px] sm:text-xs text-gray-400 flex-wrap">
          <span>Views: {formatNumber(video.views)}</span>
          {video.avg_view_percentage !== null && video.avg_view_percentage !== undefined && <span className="text-cyan-400">Ret: {video.avg_view_percentage.toFixed(1)}%</span>}
          <span>Eng: {engRate.toFixed(2)}%</span>
          <span>Likes: {formatNumber(video.likes)}</span>
          {video.watch_time_minutes != null && <span className="text-cyan-400">Watch: {Math.round(video.watch_time_minutes)}m</span>}
          <span className={`${isBest ? "text-green-400" : "text-red-400"} font-bold`}>Score: {video.score}/100</span>
        </div>
        <button onClick={() => onAnalyze(video.youtube_id)} disabled={analyzing} className={`mt-3 text-xs ${isBest ? "text-green-400 hover:text-green-300" : "text-red-400 hover:text-red-300"} flex items-center gap-1 disabled:opacity-50`}>
          <Brain size={12} />
          {analyzing ? "Analyzing..." : analysis ? "Re-analyze" : isBest ? "Why did this work?" : "Why did this fail?"}
        </button>
      </div>
      {analysis && (
        <div className={`border-t ${isBest ? "border-green-500/20" : "border-red-500/20"}`}>
          <button onClick={() => setExpanded(!expanded)} className={`flex items-center gap-2 text-xs sm:text-sm ${isBest ? "text-green-400" : "text-red-400"} w-full text-left px-3 sm:px-4 py-3`}>
            {isBest ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            <span className="font-medium">AI Analysis {expanded ? "▲" : "▼"}</span>
          </button>
          {expanded && <div className="px-3 sm:px-4 pb-3 sm:pb-4"><AnalysisPanel analysis={analysis} /></div>}
        </div>
      )}
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
  const m: Record<string, string> = { purple: "bg-purple-500/10 border-purple-500/20 text-purple-400", blue: "bg-blue-500/10 border-blue-500/20 text-blue-400", cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400", yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400", orange: "bg-orange-500/10 border-orange-500/20 text-orange-400", pink: "bg-pink-500/10 border-pink-500/20 text-pink-400" };
  const cls = m[c] || m.blue;
  return <div className={"border rounded-lg p-2 sm:p-3 " + cls.split(" ").slice(0, 2).join(" ")}><p className={"text-xs font-medium mb-1 " + cls.split(" ")[2]}>{l}</p><p className="text-xs text-gray-300 leading-relaxed">{t}</p></div>;
}
