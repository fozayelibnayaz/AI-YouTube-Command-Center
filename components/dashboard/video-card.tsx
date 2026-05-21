"use client";
import { useState } from "react";
import { formatNumber, formatDuration, getCTRRating, getRetentionRating, calculatePerformanceScore } from "@/lib/utils";
import { Eye, ThumbsUp, MessageSquare, Clock, Brain, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  video: any;
  rank?: number;
  onAnalyze?: (id: string) => void;
  analysis?: any;
  analyzing?: boolean;
}

export function VideoCard({ video, rank, onAnalyze, analysis, analyzing }: Props) {
  const [expanded, setExpanded] = useState(false);

  const score = calculatePerformanceScore({
    ctr: video.ctr || 0,
    avg_view_percentage: video.avg_view_percentage || 0,
    likes: video.likes || 0,
    views: video.views || 0,
    comments: video.comments || 0,
  });

  const ctrRating = getCTRRating(video.ctr || 0);
  const retentionRating = getRetentionRating(video.avg_view_percentage || 0);

  const scoreColor = score >= 70 ? "text-green-400 bg-green-500/10 border-green-500/30"
                   : score >= 50 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                   : score >= 30 ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
                   : "text-red-400 bg-red-500/10 border-red-500/30";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition-all">
      <div className="flex items-start gap-3 p-4">
        {rank && (
          <div className={"flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold " + (
            rank === 1 ? "bg-yellow-500/20 text-yellow-400" :
            rank === 2 ? "bg-gray-400/20 text-gray-400" :
            rank === 3 ? "bg-orange-600/20 text-orange-400" :
            "bg-white/10 text-gray-500"
          )}>{rank}</div>
        )}

        <div className="flex-shrink-0 w-24 h-14 rounded-lg overflow-hidden bg-gray-800 relative">
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No thumb</div>
          )}
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
            {formatDuration(video.duration_seconds || 0)}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm leading-tight line-clamp-2 mb-2">{video.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={"text-xs font-bold px-2 py-0.5 rounded border " + scoreColor}>
              Score {score}/100
            </span>
            <span className="text-xs text-gray-400">CTR <span className={ctrRating.color}>{video.ctr || 0}%</span></span>
            <span className="text-xs text-gray-400">Retention <span className={retentionRating.color}>{video.avg_view_percentage || 0}%</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-0 border-t border-white/5">
        {[
          { label: "Views", value: formatNumber(video.views || 0), icon: <Eye size={12} />, color: "text-blue-400" },
          { label: "Likes", value: formatNumber(video.likes || 0), icon: <ThumbsUp size={12} />, color: "text-green-400" },
          { label: "Comments", value: formatNumber(video.comments || 0), icon: <MessageSquare size={12} />, color: "text-purple-400" },
          { label: "Avg View", value: formatDuration(video.avg_view_duration_seconds || 0), icon: <Clock size={12} />, color: "text-yellow-400" },
        ].map(m => (
          <div key={m.label} className="flex flex-col items-center py-3 border-r border-white/5 last:border-r-0">
            <div className={"flex items-center gap-1 " + m.color + " mb-1"}>{m.icon}<span className="text-xs">{m.label}</span></div>
            <span className="text-white text-sm font-semibold">{m.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 border-t border-white/5">
        <div className="bg-black/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">CTR Performance</span>
            <span className={"text-xs font-bold " + ctrRating.color}>{ctrRating.label}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div className={"h-1.5 rounded-full " + (
              (video.ctr || 0) >= 7 ? "bg-green-500" : (video.ctr || 0) >= 4 ? "bg-yellow-500" : "bg-red-500"
            )} style={{ width: Math.min(((video.ctr || 0) / 10) * 100, 100) + "%" }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{ctrRating.description}</p>
        </div>

        <div className="bg-black/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Retention</span>
            <span className={"text-xs font-bold " + retentionRating.color}>{retentionRating.label}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div className={"h-1.5 rounded-full " + (
              (video.avg_view_percentage || 0) >= 40 ? "bg-green-500" :
              (video.avg_view_percentage || 0) >= 25 ? "bg-yellow-500" : "bg-red-500"
            )} style={{ width: Math.min(((video.avg_view_percentage || 0) / 60) * 100, 100) + "%" }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{retentionRating.description}</p>
        </div>
      </div>

      {analysis && (
        <div className="border-t border-white/5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors w-full text-left p-4"
          >
            <Brain size={14} />
            <span className="font-medium">AI Analysis Ready - Click to View</span>
            {expanded ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3">
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
                  {analysis.ai.main_reason && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-purple-400 mb-1">WHY This Performed This Way</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{analysis.ai.main_reason}</p>
                    </div>
                  )}
                  {analysis.ai.thumbnail_analysis && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-400 mb-1">THUMBNAIL Analysis</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{analysis.ai.thumbnail_analysis}</p>
                    </div>
                  )}
                  {analysis.ai.title_analysis && (
                    <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-cyan-400 mb-1">TITLE Analysis</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{analysis.ai.title_analysis}</p>
                    </div>
                  )}
                  {analysis.ai.retention_analysis && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-yellow-400 mb-1">RETENTION Analysis</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{analysis.ai.retention_analysis}</p>
                    </div>
                  )}
                  {analysis.ai.seo_analysis && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-orange-400 mb-1">SEO Analysis</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{analysis.ai.seo_analysis}</p>
                    </div>
                  )}
                  {analysis.ai.improved_title && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-green-400 mb-1">SUGGESTED Better Title</p>
                      <p className="text-sm text-white font-medium">"{analysis.ai.improved_title}"</p>
                    </div>
                  )}
                  {analysis.ai.next_video_advice && (
                    <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-pink-400 mb-1">NEXT Video Strategy</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{analysis.ai.next_video_advice}</p>
                    </div>
                  )}
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
          )}
        </div>
      )}

      <div className="flex gap-2 p-4 pt-0 border-t border-white/5 mt-2">
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
              {analysis ? "Re-analyze" : "Analyze with AI"}
            </>
          )}
        </button>
        <a
          href={"https://youtube.com/watch?v=" + video.youtube_id}
          target="_blank"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-xs"
        >
          <Eye size={12} /> Watch
        </a>
      </div>
    </div>
  );
}
