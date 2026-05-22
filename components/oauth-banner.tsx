"use client";
import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Link2, Unlink, Loader2, RefreshCw } from "lucide-react";

export function OAuthBanner() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/status");
      const json = await res.json();
      setStatus(json);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect YouTube account? You'll lose access to REAL CTR/retention data.")) return;
    setDisconnecting(true);
    await fetch("/api/auth/disconnect", { method: "POST" });
    await fetchStatus();
    setDisconnecting(false);
  }

  useEffect(() => { fetchStatus(); }, []);

  if (loading) return null;

  if (!status?.oauthConfigured) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs sm:text-sm">
        <p className="text-yellow-400 font-medium mb-1">⚠️ OAuth Not Configured</p>
        <p className="text-gray-400">Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.</p>
      </div>
    );
  }

  if (status.connected) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-green-400 font-medium">YouTube Connected - REAL Data Active</p>
            <p className="text-gray-400 truncate">
              {status.email}
              {status.channelTitle && <span className="ml-2 text-white">→ {status.channelTitle}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href="/select-channel" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs">
            <RefreshCw size={12} /> Switch Channel
          </a>
          <button onClick={disconnect} disabled={disconnecting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs disabled:opacity-50">
            {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-xs sm:text-sm">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-blue-400 font-semibold mb-1">Get REAL CTR, Retention, Demographics & More</p>
          <p className="text-gray-400 mb-3">
            Connect your YouTube to unlock real metrics: CTR, retention, impressions, demographics, traffic sources, revenue, watch time.
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2 text-xs text-yellow-400 mb-3">
            <strong>Brand Account note:</strong> When the Google popup appears, click your Google account, then choose the brand account that owns your YouTube channel.
          </div>
          <a href="/api/auth/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all">
            <Link2 size={14} />
            Connect YouTube Account
          </a>
          <p className="text-gray-600 text-xs mt-2">Uses Google OAuth - secure, read-only access</p>
        </div>
      </div>
    </div>
  );
}
