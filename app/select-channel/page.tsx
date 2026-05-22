"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tv, CheckCircle, Loader2, Users, Eye, Video, Link2, AlertCircle, Plus, Info } from "lucide-react";

export default function SelectChannelPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notAuthed, setNotAuthed] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [debugInfo, setDebugInfo] = useState<any>(null);

  async function load() {
    setLoading(true);
    setError("");
    setNotAuthed(false);

    try {
      const statusRes = await fetch("/api/auth/status");
      const statusJson = await statusRes.json();
      if (!statusJson.connected) {
        setNotAuthed(true);
        setLoading(false);
        return;
      }
      setCurrentId(statusJson.channelId || null);

      const chRes = await fetch("/api/auth/channels");
      const chJson = await chRes.json();
      if (chJson.success) {
        setChannels(chJson.channels || []);
        setDebugInfo({ mineCount: chJson.mineCount, managedCount: chJson.managedCount, note: chJson.note });
      } else {
        setError(chJson.error || "Failed to load channels");
      }
    } catch (e) {
      setError("Network error: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  async function selectChannel(channel: any) {
    setSelecting(channel.id);
    try {
      const res = await fetch("/api/auth/select-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id, channelTitle: channel.title }),
      });
      const json = await res.json();
      if (json.success) router.push("/dashboard?channel_changed=1");
      else { setError("Failed: " + (json.error || "Unknown")); setSelecting(null); }
    } catch (e) {
      setError(String(e));
      setSelecting(null);
    }
  }

  async function lookupAndAddChannel() {
    if (!manualId.trim()) return;
    setManualLoading(true);
    setManualError("");
    try {
      const res = await fetch("/api/auth/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: manualId.trim() }),
      });
      const json = await res.json();
      if (json.success && json.channel) {
        // Add to list AND auto-select
        setChannels(prev => {
          const exists = prev.find(c => c.id === json.channel.id);
          if (exists) return prev;
          return [json.channel, ...prev];
        });
        setShowManualInput(false);
        setManualId("");
        // Auto-select
        await selectChannel(json.channel);
      } else {
        setManualError(json.error || "Channel not found. Check the ID.");
      }
    } catch (e) {
      setManualError(String(e));
    } finally {
      setManualLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-gray-950 p-3 sm:p-4 lg:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Tv className="text-red-400 flex-shrink-0" size={24} />
            Select Your YouTube Channel
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">Choose which channel to analyze.</p>
        </div>

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-blue-400" size={32} />
            <p className="text-gray-400 mt-3 text-sm">Loading channels...</p>
          </div>
        )}

        {notAuthed && !loading && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 sm:p-6 text-center">
            <AlertCircle size={32} className="text-blue-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Not Connected to YouTube</h3>
            <a href="/api/auth/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
              <Link2 size={14} /> Connect YouTube Account
            </a>
          </div>
        )}

        {error && !notAuthed && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 mb-4 break-words">
            <p className="font-medium mb-1">❌ Error</p>
            <p className="text-xs">{error}</p>
            <button onClick={load} className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10">Try Again</button>
          </div>
        )}

        {!loading && !notAuthed && (
          <>
            {/* Brand Account Notice */}
            {(channels.length === 0 || (channels.length === 1 && channels[0].subscribers === 0)) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4 text-xs sm:text-sm">
                <p className="text-yellow-400 font-medium mb-2 flex items-center gap-2">
                  <Info size={14} /> Brand Account Not Auto-Detected
                </p>
                <p className="text-gray-400 mb-3">
                  Google's API only shows your personal channel by default. Brand accounts like "Eagle 3D Streaming" need to be added manually using the channel ID.
                </p>
                <p className="text-gray-400 mb-3">
                  <strong>Add your Eagle 3D Streaming channel:</strong>
                </p>
                <button
                  onClick={() => setShowManualInput(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium"
                >
                  <Plus size={14} /> Add Brand Channel by ID
                </button>
              </div>
            )}

            {/* Manual Input */}
            {showManualInput && (
              <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-4 mb-4">
                <h3 className="text-white font-semibold mb-2 text-sm">Enter Channel ID</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Get your channel ID from: <a href="https://www.youtube.com/account_advanced" target="_blank" className="text-blue-400 underline">YouTube Account Advanced</a>
                  <br />
                  Or paste your existing one: <code className="bg-black/30 px-1.5 py-0.5 rounded text-cyan-400">UCA_NxRFfbYSG3kOeHak0BjQ</code> (Eagle 3D Streaming)
                </p>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={manualId}
                    onChange={e => setManualId(e.target.value)}
                    placeholder="UCxxxxxxxxxxxxxxxxxx"
                    className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-sm"
                    disabled={manualLoading}
                  />
                  <button
                    onClick={() => { setManualId("UCA_NxRFfbYSG3kOeHak0BjQ"); }}
                    className="px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-white text-xs"
                    type="button"
                  >
                    Use Eagle 3D
                  </button>
                  <button
                    onClick={lookupAndAddChannel}
                    disabled={manualLoading || !manualId.trim()}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {manualLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {manualLoading ? "Adding..." : "Add & Select"}
                  </button>
                  <button
                    onClick={() => { setShowManualInput(false); setManualError(""); }}
                    className="px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>
                {manualError && (
                  <p className="text-xs text-red-400 mt-2">❌ {manualError}</p>
                )}
              </div>
            )}

            {channels.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Found {channels.length} channel{channels.length === 1 ? "" : "s"}:</p>
                  {!showManualInput && (
                    <button onClick={() => setShowManualInput(true)} className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                      <Plus size={11} /> Add another by ID
                    </button>
                  )}
                </div>
                {channels.map(ch => {
                  const isCurrent = currentId === ch.id;
                  const isSelecting = selecting === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => selectChannel(ch)}
                      disabled={isSelecting}
                      className={`w-full text-left rounded-xl border p-3 sm:p-4 transition-all ${
                        isCurrent ? "border-green-500/40 bg-green-500/10" : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/30"
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        {ch.thumbnail ? (
                          <img src={ch.thumbnail} alt="" className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-red-600/30 flex items-center justify-center flex-shrink-0">
                            <Tv size={20} className="text-red-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <h3 className="text-white font-semibold text-sm sm:text-base truncate">{ch.title}</h3>
                            {isCurrent && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1 flex-shrink-0">
                                <CheckCircle size={10} /> Active
                              </span>
                            )}
                          </div>
                          {ch.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ch.description}</p>}
                          <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                            <span className="flex items-center gap-1"><Users size={11} /> {(ch.subscribers || 0).toLocaleString()}</span>
                            <span className="flex items-center gap-1"><Eye size={11} /> {(ch.totalViews || 0).toLocaleString()}</span>
                            <span className="flex items-center gap-1"><Video size={11} /> {(ch.videoCount || 0).toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] text-gray-600 mt-1 truncate">ID: {ch.id}</p>
                        </div>
                        {isSelecting && <Loader2 size={20} className="animate-spin text-blue-400 flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {debugInfo && (
              <p className="text-[10px] text-gray-700 mt-4 text-center">
                Debug: mine={debugInfo.mineCount} · managed={debugInfo.managedCount}
              </p>
            )}
          </>
        )}

        <div className="mt-6 text-center">
          <a href="/dashboard" className="text-xs text-gray-500 hover:text-white">← Back to dashboard</a>
        </div>
      </div>
    </div>
  );
}
