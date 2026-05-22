"use client";
import { useState } from "react";
import { Brain, Sparkles, Zap, Copy, Check } from "lucide-react";

export default function InsightsPage() {
  const [topic, setTopic] = useState("");
  const [titles, setTitles] = useState<any>(null);
  const [hooks, setHooks] = useState<any>(null);
  const [loadingT, setLoadingT] = useState(false);
  const [loadingH, setLoadingH] = useState(false);
  const [copied, setCopied] = useState("");

  async function genTitles() {
    if (!topic) return;
    setLoadingT(true);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_titles", payload: { topic } }) });
      const json = await res.json();
      if (json.success) setTitles(json.data);
    } finally { setLoadingT(false); }
  }

  async function genHooks() {
    if (!topic) return;
    setLoadingH(true);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_hooks", payload: { videoTitle: topic } }) });
      const json = await res.json();
      if (json.success) setHooks(json.data);
    } finally { setLoadingH(false); }
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Brain className="text-purple-400 flex-shrink-0" size={24} />
            AI Content Tools
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">Generate viral titles and powerful hooks</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 lg:p-6">
          <label className="text-xs sm:text-sm text-gray-400 mb-2 block">Video Topic or Title</label>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., How to grow YouTube channel"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 text-xs sm:text-sm mb-3 sm:mb-4" />
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:gap-3">
            <button onClick={genTitles} disabled={!topic || loadingT} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-medium disabled:opacity-50">
              {loadingT ? "Generating..." : <><Sparkles size={14} /> Generate 10 Titles</>}
            </button>
            <button onClick={genHooks} disabled={!topic || loadingH} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-white text-xs sm:text-sm font-medium disabled:opacity-50">
              {loadingH ? "Generating..." : <><Zap size={14} /> Generate 6 Hooks</>}
            </button>
          </div>
        </div>

        {titles && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 lg:p-6">
            <h3 className="text-white font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
              <Sparkles size={16} className="text-yellow-400" />
              AI-Generated Titles
              {!titles.ai && <span className="text-xs text-gray-500">(Templates)</span>}
            </h3>
            {titles.best_pick && (
              <div className="mb-3 sm:mb-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                <p className="text-xs text-yellow-400 mb-1">BEST PICK</p>
                <p className="text-white font-medium text-xs sm:text-sm break-words">"{titles.best_pick}"</p>
                {titles.reason && <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{titles.reason}</p>}
              </div>
            )}
            <div className="space-y-2">
              {(titles.titles || []).map((t: string, i: number) => (
                <div key={i} className="flex items-start gap-2 sm:gap-3 bg-white/5 rounded-lg px-3 sm:px-4 py-2 sm:py-3 group hover:bg-white/10">
                  <span className="text-gray-600 text-xs w-5 flex-shrink-0">{i + 1}.</span>
                  <span className="text-white text-xs sm:text-sm flex-1 break-words">{t}</span>
                  <button onClick={() => copyText(t, "t" + i)} className="text-gray-400 hover:text-white flex-shrink-0">
                    {copied === "t" + i ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {hooks && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 lg:p-6">
            <h3 className="text-white font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
              <Zap size={16} className="text-orange-400" />
              Video Hook Scripts
              {!hooks.ai && <span className="text-xs text-gray-500">(Templates)</span>}
            </h3>
            <div className="space-y-3 sm:space-y-4">
              {(hooks.hooks || []).map((h: any, i: number) => (
                <div key={i} className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-medium text-purple-400 capitalize">{h.type} Style</span>
                    <button onClick={() => copyText(h.script, "h" + i)} className="text-gray-400 hover:text-white">
                      {copied === "h" + i ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-gray-300 text-xs sm:text-sm leading-relaxed italic break-words">"{h.script}"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
