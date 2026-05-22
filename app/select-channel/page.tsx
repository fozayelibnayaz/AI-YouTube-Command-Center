"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tv, CheckCircle, Loader2, Users, Eye, Video } from "lucide-react";

export default function SelectChannelPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/channels").then(r => r.json()),
      fetch("/api/auth/status").then(r => r.json()),
    ]).then(([ch, st]) => {
      if (ch.success) setChannels(ch.channels || []);
      else setError(ch.error || "Failed to load channels");
      setCurrentId(st.channelId || null);
      setLoading(false);
    }).catch(e => {
      setError(String(e));
      setLoading(false);
    });
  }, []);

  async function selectChannel(channel: any) {
    setSelecting(channel.id);
    try {
      await fetch("/api/auth/select-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id, channelTitle: channel.title }),
      });
      router.push("/dashboard?channel_changed=1");
    } catch (e) {
      setError(String(e));
      setSelecting(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-3 sm:p-4 lg:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Tv className="text-red-400 flex-shrink-0" size={24} />
            Select Your YouTube Channel
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">
            Your Google account manages multiple channels. Choose which one to analyze.
          </p>
        </div>

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-blue-400" size={32} />
            <p className="text-gray-400 mt-3 text-sm">Loading your channels...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 mb-4">
            ❌ {error}
          </div>
        )}

        {!loading && channels.length === 0 && !error && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-400">
            ⚠️ No channels found. Your Google account may not manage any YouTube channels yet.
          </div>
        )}

        {channels.length > 0 && (
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
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
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
                      <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1"><Users size={11} /> {(ch.subscribers || 0).toLocaleString()} subs</span>
                        <span className="flex items-center gap-1"><Eye size={11} /> {(ch.totalViews || 0).toLocaleString()} views</span>
                        <span className="flex items-center gap-1"><Video size={11} /> {(ch.videoCount || 0).toLocaleString()} videos</span>
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
