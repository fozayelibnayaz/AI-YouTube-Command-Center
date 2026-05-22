"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tv, CheckCircle, Loader2, Users, Eye, Video, Link2, AlertCircle } from "lucide-react";

export default function SelectChannelPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notAuthed, setNotAuthed] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    setNotAuthed(false);

    try {
      // Check status first
      const statusRes = await fetch("/api/auth/status");
      const statusText = await statusRes.text();
      let statusJson: any = {};
      try { statusJson = JSON.parse(statusText); }
      catch { setError("Server returned invalid response. Status endpoint failed."); setLoading(false); return; }

      if (!statusJson.connected) {
        setNotAuthed(true);
        setLoading(false);
        return;
      }
      setCurrentId(statusJson.channelId || null);

      // Fetch channels
      const chRes = await fetch("/api/auth/channels");
      const chText = await chRes.text();
      let chJson: any = {};
      try { chJson = JSON.parse(chText); }
      catch {
        setError("Channels endpoint returned invalid response (status " + chRes.status + "). Try disconnecting and reconnecting.");
        setLoading(false);
        return;
      }

      if (chJson.success && chJson.channels) {
        setChannels(chJson.channels);
      } else if (chRes.status === 401) {
        setNotAuthed(true);
      } else {
        setError(chJson.error || "Failed to load channels (HTTP " + chRes.status + ")");
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
      if (json.success) {
        router.push("/dashboard?channel_changed=1");
      } else {
        setError("Failed to save: " + (json.error || "Unknown"));
        setSelecting(null);
      }
    } catch (e) {
      setError(String(e));
      setSelecting(null);
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
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">
            Choose which channel to analyze.
          </p>
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
            <p className="text-gray-400 text-xs sm:text-sm mb-4">
              You need to sign in with Google first to see your channels.
            </p>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-xs text-yellow-400 mb-4 text-left">
              <strong>Brand Account Tip:</strong> When the Google popup appears:
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Click your personal Google account</li>
                <li>Google will show "Choose an account to continue"</li>
                <li>Select <strong>Eagle 3D Streaming (Brand Account)</strong></li>
                <li>Approve all permissions</li>
              </ol>
            </div>
            <a href="/api/auth/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
              <Link2 size={14} /> Connect YouTube Account
            </a>
          </div>
        )}

        {error && !notAuthed && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 mb-4 break-words">
            <p className="font-medium mb-1">❌ Error</p>
            <p className="text-xs">{error}</p>
            <button onClick={load} className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10">
              Try Again
            </button>
          </div>
        )}

        {!loading && !notAuthed && channels.length === 0 && !error && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-400">
            <p className="font-medium mb-2">⚠️ No channels found</p>
            <p className="text-xs text-gray-400 mb-3">
              Your Google account doesn't manage any YouTube channels, OR you signed in with the wrong account.
            </p>
            <p className="text-xs text-gray-400 mb-3">
              <strong>To fix:</strong> Disconnect, then reconnect choosing your <strong>Eagle 3D Streaming (Brand Account)</strong> in Google's chooser.
            </p>
            <div className="flex gap-2 flex-wrap">
              <a href="/api/auth/login" className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
                Reconnect
              </a>
              <a href="/dashboard" className="text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10">
                Back to Dashboard
              </a>
            </div>
          </div>
        )}

        {channels.length > 0 && !loading && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-2">Found {channels.length} channel{channels.length === 1 ? "" : "s"}:</p>
            {channels.map(ch => {
              const isCurrent = currentId === ch.id;
              const isSelecting = selecting === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => selectChannel(ch)}
                  disabled={isSelecting}
                  className={`w-full text-left rounded-xl border p-3 sm:p-4 transition-all ${
                    isCurrent
                      ? "border-green-500/40 bg-green-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/30"
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
                      {ch.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ch.description}</p>
                      )}
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

        <div className="mt-6 text-center">
          <a href="/dashboard" className="text-xs text-gray-500 hover:text-white">← Back to dashboard</a>
        </div>
      </div>
    </div>
  );
}
