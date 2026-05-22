"use client";
import { useState } from "react";
import { formatNumber, formatDuration, getCTRRating, getRetentionRating, getEngagementRating, getViewsPerDayRating } from "@/lib/utils";
import { Eye, ThumbsUp, MessageSquare, Clock, Brain, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Lock } from "lucide-react";

interface Props {
  video: any;
  rank?: number;
  onAnalyze?: (id: string) => void;
  analysis?: any;
  analyzing?: boolean;
}

export function VideoCard({ video, rank, onAnalyze, analysis, analyzing }: Props) {
  const [expanded, setExpanded] = useState(false);

  const views = video.views || 0;
  const likes = video.likes || 0;
  const comments = video.comments || 0;
  const score = video.score || 0;
  const hasRealAnalytics = video.has_real_analytics === true;
  const ctr = video.ctr; // null when no OAuth
  const retention = video.avg_view_percentage; // null when no OAuth

  // Real calculated metrics (always available)
  const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const daysSince = video.published_at
    ? Math.max(1, (Date.now() - new Date(video.published_at).getTime()) / 86400000)
    : 1;
  const viewsPerDay = views / daysSince;

  const engRating = getEngagementRating(engRate);
  const vpdRating = getViewsPerDayRating(viewsPerDay);

  const scoreColor = score >= 70 ? "text-green-400 bg-green-500/10 border-green-500/30"
                   : score >= 50 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                   : score >= 30 ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
                   : "text-red-400 bg-red-500/10 border-red-500/30";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition-all">
      <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4">
        {rank && (
          <div className={"flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold " + (
            rank === 1 ? "bg-yellow-500/20 text-yellow-400" :
            rank === 2 ? "bg-gray-400/20 text-gray-400" :
            rank === 3 ? "bg-orange-600/20 text-orange-400" :
            "bg-white/10 text-gray-500"
          )}>{rank}</div>
        )}

        <div className="flex-shrink-0 w-20 h-12 sm:w-24 sm:h-14 rounded-lg overflow-hidden bg-gray-800 relative">
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No thumb</div>
          )}
          <div className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 bg-black/80 text-white text-[10px] sm:text-xs px-1 rounded">
            {formatDuration(video.duration_seconds || 0)}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-xs sm:text-sm leading-tight line-clamp-2 mb-2">{video.title}</h3>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className={"text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded border " + scoreColor}>
              {score}/100
            </span>
            <span className="text-[10px] sm:text-xs text-gray-400">
              Eng <span className={engRating.color}>{engRate.toFixed(2)}%</span>
            </span>
            <span className="text-[10px] sm:text-xs text-gray-400">
              {Math.round(viewsPerDay)}/day
            </span>
            {hasRealAnalytics && (
              <span className="text-[9px] sm:text-[10px] bg-green-500/10 text-green-400 px-1 py-0.5 rounded border border-green-500/20">REAL DATA</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid - 4 columns of REAL data */}
      <div className="grid grid-cols-4 gap-0 border-t border-white/5">
        {[
          { label: "Views", value: formatNumber(views), icon: <Eye size={10} />, color: "text-blue-400" },
          { label: "Likes", value: formatNumber(likes), icon: <ThumbsUp size={10} />, color: "text-green-400" },
          { label: "Comments", value: formatNumber(comments), icon: <MessageSquare size={10} />, color: "text-purple-400" },
          {
            label: "Watch Time",
            value: hasRealAnalytics && video.watch_time_minutes
              ? Math.round(video.watch_time_minutes) + "m"
              : Math.round(viewsPerDay) + "/d",
            icon: <Clock size={10} />,
            color: "text-yellow-400"
          },
        ].map(m => (
          <div key={m.label} className="flex flex-col items-center py-2 sm:py-3 border-r border-white/5 last:border-r-0">
            <div className={"flex items-center gap-1 " + m.color + " mb-0.5 sm:mb-1"}>
              {m.icon}
              <span className="text-[9px] sm:text-xs">{m.label}</span>
            </div>
            <span className="text-white text-xs sm:text-sm font-semibold">{m.value}</span>
          </div>
        ))}
      </div>

      {/* Performance bars - CONDITIONALLY show CTR/Retention only if REAL data exists */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 p-3 sm:p-4 border-t border-white/5">
        {/* CTR Section - Real or Locked */}
        {hasRealAnalytics && ctr !== null && ctr !== undefined ? (
          <PerformanceBar
            label="CTR"
            badge="✓ REAL"
            rating={getCTRRating(ctr)}
            value={ctr}
            max={10}
            colorThresholds={{ good: 7, ok: 4 }}
            displayValue={ctr.toFixed(2) + "%"}
          />
        ) : (
          <div className="bg-black/20 rounded-lg p-2 sm:p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1">
                <Lock size={9} /> CTR
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-gray-600">Locked</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-gray-700" style={{ width: "100%" }} />
            </div>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-1 truncate">Connect YouTube to unlock</p>
          </div>
        )}

        {/* Retention - Real or Engagement Rate fallback */}
        {hasRealAnalytics && retention !== null && retention !== undefined ? (
          <PerformanceBar
            label="Retention"
            badge="✓ REAL"
            rating={getRetentionRating(retention)}
            value={retention}
            max={60}
            colorThresholds={{ good: 40, ok: 25 }}
            displayValue={retention.toFixed(1) + "%"}
          />
        ) : (
          <PerformanceBar
            label="Engagement"
            badge="calc"
            rating={engRating}
            value={engRate}
            max={10}
            colorThresholds={{ good: 5, ok: 2 }}
            displayValue={engRate.toFixed(2) + "%"}
          />
        )}
      </div>

      {analysis && (
        <div className="border-t border-white/5">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-xs sm:text-sm text-purple-400 hover:text-purple-300 transition-colors w-full text-left p-3 sm:p-4">
            <Brain size={14} />
            <span className="font-medium">AI Analysis</span>
            {expanded ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
          </button>

          {expanded && (
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">
              {analysis.issues?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                    <AlertTriangle size={12} /> Issues ({analysis.issues.length})
                  </p>
                  {analysis.issues.map((issue: any, i: number) => (
                    <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 sm:p-3">
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
                  {analysis.ai.main_reason && <AIBlock c="purple" l="WHY" t={analysis.ai.main_reason} />}
                  {analysis.ai.thumbnail_analysis && <AIBlock c="blue" l="THUMBNAIL" t={analysis.ai.thumbnail_analysis} />}
                  {analysis.ai.title_analysis && <AIBlock c="cyan" l="TITLE" t={analysis.ai.title_analysis} />}
                  {analysis.ai.engagement_analysis && <AIBlock c="yellow" l="ENGAGEMENT" t={analysis.ai.engagement_analysis} />}
                  {analysis.ai.retention_analysis && <AIBlock c="yellow" l="RETENTION" t={analysis.ai.retention_analysis} />}
                  {analysis.ai.seo_analysis && <AIBlock c="orange" l="SEO" t={analysis.ai.seo_analysis} />}
                  {analysis.ai.improved_title && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 sm:p-3">
                      <p className="text-xs font-medium text-green-400 mb-1">BETTER TITLE</p>
                      <p className="text-xs sm:text-sm text-white font-medium">"{analysis.ai.improved_title}"</p>
                    </div>
                  )}
                  {analysis.ai.next_video_advice && <AIBlock c="pink" l="NEXT VIDEO" t={analysis.ai.next_video_advice} />}
                </div>
              )}

              {analysis.recommendations?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-orange-400 mb-2">RECOMMENDATIONS</p>
                  <ul className="space-y-1">
                    {analysis.recommendations.map((r: string, i: number) => (
                      <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                        <span className="text-orange-400 mt-0.5">→</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 p-3 sm:p-4 pt-0 border-t border-white/5 mt-2">
        <button
          onClick={() => onAnalyze?.(video.youtube_id)}
          disabled={analyzing}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 text-xs font-medium transition-all disabled:opacity-50"
        >
          {analyzing ? (
            <>
              <div className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain size={12} />
              {analysis ? "Re-analyze" : "Analyze"}
            </>
          )}
        </button>
        <a
          href={"https://youtube.com/watch?v=" + video.youtube_id}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-xs"
        >
          <Eye size={12} /> Watch
        </a>
      </div>
    </div>
  );
}

function PerformanceBar({ label, badge, rating, value, max, colorThresholds, displayValue }: any) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = value >= colorThresholds.good ? "bg-green-500"
                 : value >= colorThresholds.ok ? "bg-yellow-500"
                 : "bg-red-500";
  return (
    <div className="bg-black/20 rounded-lg p-2 sm:p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1">
          {label}
          {badge && <span className={`text-[8px] sm:text-[9px] px-1 py-0.5 rounded ${badge === "✓ REAL" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}`}>{badge}</span>}
        </span>
        <span className={"text-[10px] sm:text-xs font-bold " + rating.color}>{displayValue}</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-1.5">
        <div className={"h-1.5 rounded-full " + barColor} style={{ width: pct + "%" }} />
      </div>
      <p className="text-[10px] sm:text-xs text-gray-500 mt-1 truncate">{rating.label} - {rating.description}</p>
    </div>
  );
}

function AIBlock({ c, l, t }: { c: string; l: string; t: string }) {
  const m: Record<string, string> = {
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    pink: "bg-pink-500/10 border-pink-500/20 text-pink-400",
  };
  const cls = m[c] || m.blue;
  return (
    <div className={"border rounded-lg p-2 sm:p-3 " + cls.split(" ").slice(0, 2).join(" ")}>
      <p className={"text-xs font-medium mb-1 " + cls.split(" ")[2]}>{l}</p>
      <p className="text-xs text-gray-300 leading-relaxed">{t}</p>
    </div>
  );
}
