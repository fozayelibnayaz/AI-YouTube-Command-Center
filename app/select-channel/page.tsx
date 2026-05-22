"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tv, CheckCircle, Loader2, Users, Eye, Video, Link2, AlertCircle, Plus, ArrowRight } from "lucide-react";

export default function SelectChannelPage() {
  const router = useRouter();
  const [oauthChannels, setOauthChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<any>(null);

  const [manualId, setManualId] = useState("UCA_NxRFfbYSG3kOeHak0BjQ");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [selecting, setSelecting] = useState(false);
  const [pageError, setPageError] = useState("");

  async function loadStatus() {
    try {
      const res = await fetch("/api/auth/status");
      const json = await res.json();
      setOauthStatus(json);
      setCurrentId(json.channelId || null);
    } catch (e) {
      setPageError("Could not load status: " + String(e));
    }
  }

  async function loadChannels() {
    setLoadingChannels(true);
    try {
      const res = await fetch("/api/auth/channels");
      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); }
      catch {
        setPageError("Channels endpoint returned non-JSON. Response: " + text.substring(0, 200));
        setLoadingChannels(false);
        return;
      }
      if (json.success && json.channels) {
        setOauthChannels(json.channels);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChannels(false);
    }
  }

  async function lookupChannel() {
    if (!manualId.trim()) return;
    setLookingUp(true);
    setLookupError("");
    setLookupResult(null);
    try {
      const res = await fetch("/api/auth/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: manualId.trim() }),
      });
      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); }
      catch {
        setLookupError("Server error. Response: " + text.substring(0, 200));
        setLookingUp(false);
        return;
      }
      if (json.success && json.channel) {
        setLookupResult(json.channel);
      } else {
        setLookupError(json.error || "Channel not found");
      }
    } catch (e) {
      setLookupError("Network error: " + String(e));
    } finally {
      setLookingUp(false);
    }
  }

  async function selectAndGo(channel: any) {
    setSelecting(true);
    try {
      const res = await fetch("/api/auth/select-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id, channelTitle: channel.title }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/dashboard?channel_changed=1");
      } else {
        setPageError("Could not save selection: " + (json.error || "Unknown"));
        setSelecting(false);
      }
    } catch (e) {
      setPageError(String(e));
      setSelecting(false);
    }
  }

  useEffect(() => {
    loadStatus();
    loadChannels();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 p-3 sm:p-4 lg:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Tv className="text-red-400 flex-shrink-0" size={24} />
            Select Your YouTube Channel
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">
            Choose which channel to analyze.
            {oauthStatus?.email && <span className="ml-2 text-green-400">Signed in: {oauthStatus.email}</span>}
          </p>
        </div>

        {pageError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 mb-4 break-words">
            ❌ {pageError}
          </div>
        )}

        {/* ━━━ MAIN ACTION: Enter Channel ID directly ━━━ */}
        <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-4 sm:p-6 mb-4">
          <h2 className="text-white font-semibold text-base sm:text-lg mb-2 flex items-center gap-2">
            <Plus className="text-blue-400" size={20} />
            Add Your Channel by ID
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mb-4">
            This works for BOTH personal channels AND brand accounts (like Eagle 3D Streaming).
            <br />
            Find your channel ID at: <a href="https://www.youtube.com/account_advanced" target="_blank" rel="noopener" className="text-blue-400 underline">youtube.com/account_advanced</a>
          </p>

          <div className="flex gap-2 flex-wrap mb-3">
            <input
              type="text"
              value={manualId}
              onChange={e => { setManualId(e.target.value); setLookupResult(null); setLookupError(""); }}
              placeholder="UCxxxxxxxxxxxxxxxxxx"
              className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-sm font-mono"
              disabled={lookingUp || selecting}
            />
            <button
              onClick={() => { setManualId("UCA_NxRFfbYSG3kOeHak0BjQ"); setLookupResult(null); setLookupError(""); }}
              className="px-3 py-2.5 rounded-lg border border-white/20 hover:bg-white/10 text-white text-xs whitespace-nowrap"
              type="button"
              disabled={lookingUp || selecting}
            >
              Use Eagle 3D
            </button>
            <button
              onClick={lookupChannel}
              disabled={lookingUp || selecting || !manualId.trim()}
              className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
            >
              {lookingUp ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {lookingUp ? "Looking up..." : "Look up channel"}
            </button>
          </div>

          {lookupError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-xs text-red-400 mb-3">
              ❌ {lookupError}
            </div>
          )}

          {lookupResult && (
            <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 sm:p-4">
              <p className="text-xs text-green-400 mb-3 font-medium">✓ Channel Found!</p>
              <div className="flex items-start gap-3 sm:gap-4">
                {lookupResult.thumbnail ? (
                  <img src={lookupResult.thumbnail} alt="" className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-red-600/30 flex items-center justify-center flex-shrink-0">
                    <Tv size={20} className="text-red-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm sm:text-base truncate">{lookupResult.title}</h3>
                  <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><Users size={11} /> {(lookupResult.subscribers || 0).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Eye size={11} /> {(lookupResult.totalViews || 0).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Video size={11} /> {(lookupResult.videoCount || 0).toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1 truncate font-mono">ID: {lookupResult.id}</p>
                </div>
              </div>
              <button
                onClick={() => selectAndGo(lookupResult)}
                disabled={selecting}
                className="mt-3 w-full px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {selecting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {selecting ? "Saving..." : "Use This Channel →"}
              </button>
            </div>
          )}
        </div>

        {/* ━━━ OAuth-detected channels (optional) ━━━ */}
        {oauthChannels.length > 0 && !loadingChannels && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
            <h3 className="text-white text-sm font-semibold mb-3">Or pick from OAuth-detected channels:</h3>
            <div className="space-y-2">
              {oauthChannels.map(ch => {
                const isCurrent = currentId === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => selectAndGo(ch)}
                    disabled={selecting}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${
                      isCurrent ? "border-green-500/40 bg-green-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-start gap-3">
                      {ch.thumbnail && <img src={ch.thumbnail} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium truncate">{ch.title}</span>
                          {isCurrent && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Active</span>}
                        </div>
                        <div className="flex gap-3 text-xs text-gray-500 mt-1">
                          <span>{(ch.subscribers || 0).toLocaleString()} subs</span>
                          <span>{(ch.videoCount || 0).toLocaleString()} videos</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* OAuth status info */}
        {!oauthStatus?.connected && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-400 mb-4">
            <p className="font-medium mb-1">⚠️ For REAL CTR/Retention data:</p>
            <p className="text-gray-400 mb-2">You need to connect your YouTube account via OAuth. Without OAuth, you'll still see views/likes/comments (which are public) but not CTR or retention.</p>
            <a href="/api/auth/login" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
              <Link2 size={12} /> Connect YouTube OAuth
            </a>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/dashboard" className="text-xs text-gray-500 hover:text-white">← Back to dashboard</a>
        </div>
      </div>
    </div>
  );
}
