"use client";
import { useState, useEffect } from "react";
import {
  Brain, TrendingUp, Target, Lightbulb, BarChart3, FileText,
  Copy, Check, Loader2, Sparkles, Calendar, Users, MessageCircle, Zap
} from "lucide-react";

interface Tool {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
}

const TOOLS: Tool[] = [
  { id: "content_strategy", name: "Content Strategy", icon: Target, color: "purple", description: "Get personalized content strategy based on your actual data" },
  { id: "competitor_gap", name: "Competitive Gap Analysis", icon: TrendingUp, color: "blue", description: "Find content opportunities you're missing" },
  { id: "thumbnail_audit", name: "Thumbnail Audit", icon: BarChart3, color: "pink", description: "AI audit your top vs bottom thumbnails - what works" },
  { id: "title_optimizer", name: "Title Optimizer", icon: Sparkles, color: "yellow", description: "Rewrite weak titles for max CTR" },
  { id: "upload_schedule", name: "Best Upload Times", icon: Calendar, color: "green", description: "Data-driven upload schedule for your audience" },
  { id: "audience_persona", name: "Audience Persona Builder", icon: Users, color: "cyan", description: "Build viewer persona from engagement patterns" },
  { id: "viral_pattern", name: "Viral Pattern Detector", icon: Zap, color: "orange", description: "What patterns made your top videos succeed" },
  { id: "comment_insights", name: "Comment Insights", icon: MessageCircle, color: "indigo", description: "AI analyzes top comments to find content ideas" },
  { id: "weekly_report", name: "Weekly Performance Report", icon: FileText, color: "red", description: "Full executive report ready to share" },
  { id: "improvement_plan", name: "30-Day Improvement Plan", icon: Lightbulb, color: "green", description: "Actionable 30-day plan to grow your channel" },
];

export default function InsightsPage() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function runTool(toolId: string) {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/ai-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolId, topic }),
      });
      const text = await res.text();
      let json: any;
      try { json = JSON.parse(text); }
      catch { setError("Server error: " + text.substring(0, 200)); setLoading(false); return; }
      if (json.success) setResult(json.result);
      else setError(json.error || "Failed");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function copyResult() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tool = TOOLS.find(t => t.id === selectedTool);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Brain className="text-purple-400 flex-shrink-0" size={24} />
            AI Power Tools
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">10 AI tools that analyze YOUR real channel data to help grow</p>
        </div>

        {!selectedTool && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const colors: Record<string, string> = {
                purple: "border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40",
                blue: "border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40",
                pink: "border-pink-500/20 bg-pink-500/5 hover:border-pink-500/40",
                yellow: "border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/40",
                green: "border-green-500/20 bg-green-500/5 hover:border-green-500/40",
                cyan: "border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40",
                orange: "border-orange-500/20 bg-orange-500/5 hover:border-orange-500/40",
                indigo: "border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/40",
                red: "border-red-500/20 bg-red-500/5 hover:border-red-500/40",
              };
              const iconColors: Record<string, string> = {
                purple: "text-purple-400", blue: "text-blue-400", pink: "text-pink-400",
                yellow: "text-yellow-400", green: "text-green-400", cyan: "text-cyan-400",
                orange: "text-orange-400", indigo: "text-indigo-400", red: "text-red-400",
              };
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTool(t.id)}
                  className={`text-left rounded-xl border ${colors[t.color]} p-4 transition-all`}
                >
                  <Icon size={24} className={`${iconColors[t.color]} mb-3`} />
                  <h3 className="text-white font-semibold text-sm mb-1">{t.name}</h3>
                  <p className="text-xs text-gray-400">{t.description}</p>
                </button>
              );
            })}
          </div>
        )}

        {selectedTool && tool && (
          <div className="space-y-4">
            <button
              onClick={() => { setSelectedTool(null); setResult(""); setError(""); setTopic(""); }}
              className="text-xs text-gray-400 hover:text-white"
            >
              ← Back to tools
            </button>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <tool.icon size={24} className={`text-${tool.color}-400`} />
                <h2 className="text-white font-bold text-lg">{tool.name}</h2>
              </div>
              <p className="text-gray-400 text-sm mb-4">{tool.description}</p>

              {["title_optimizer", "competitor_gap"].includes(tool.id) && (
                <div className="mb-3">
                  <label className="text-xs text-gray-400 mb-1 block">
                    {tool.id === "title_optimizer" ? "Enter title to optimize" : "Enter competitor channel name (optional)"}
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={tool.id === "title_optimizer" ? "Paste your video title here" : "e.g., MrBeast (or leave blank)"}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              )}

              <button
                onClick={() => runTool(tool.id)}
                disabled={loading || (tool.id === "title_optimizer" && !topic)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {loading ? "Analyzing your channel data..." : "Run Analysis"}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                ❌ {error}
              </div>
            )}

            {result && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-400" /> AI Analysis Result
                  </h3>
                  <button
                    onClick={copyResult}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white px-2 py-1 rounded border border-white/10"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-black/20 rounded-lg p-3 sm:p-4">
                  {result}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
