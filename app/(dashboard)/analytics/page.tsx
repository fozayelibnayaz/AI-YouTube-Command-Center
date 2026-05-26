"use client";
import { useState, useEffect } from "react";
import { OAuthBanner } from "@/components/oauth-banner";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange, getPresetRanges } from "@/lib/date-ranges";
import {
  BarChart3, Users, Globe, Smartphone, TrendingUp, DollarSign,
  Eye, Clock, Loader2, AlertCircle, Heart, MessageSquare, Share2,
  UserPlus, Search, Trophy, Monitor, ListVideo, Activity, Download,
  RefreshCw
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const defaultRange = getPresetRanges().find(r => r.label === "Last 30 Days")!;
  const [range, setRange] = useState<DateRange>(defaultRange);

  async function fetchData(r: DateRange = range) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analytics?action=all&startDate=${r.startDate}&endDate=${r.endDate}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || "Failed");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function onRangeChange(r: DateRange) {
    setRange(r);
    fetchData(r);
  }

  function exportCSV() {
    if (!data?.daily) return;
    const headers = ["Date", "Views", "Watch Minutes", "Avg Duration", "Likes", "Comments", "Shares", "Subs Gained"];
    const rows = data.daily.map((d: any) => [
      d.day, d.views || 0, d.estimatedMinutesWatched || 0, d.averageViewDuration || 0,
      d.likes || 0, d.comments || 0, d.shares || 0, d.subscribersGained || 0,
    ]);
    const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${range.startDate}_to_${range.endDate}.csv`;
    a.click();
  }

  useEffect(() => { fetchData(range); }, []);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <BarChart3 className="text-blue-400 flex-shrink-0" size={24} />
              Real Analytics
            </h1>
            <p className="text-gray-400 mt-1 text-xs sm:text-sm">100% real data: retention, demographics, traffic, revenue, playlists & more</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => fetchData(range)} disabled={loading} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs disabled:opacity-50">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button onClick={exportCSV} disabled={!data?.daily} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-white text-xs disabled:opacity-50">
              <Download size={12} /> CSV
            </button>
          </div>
        </div>

        <OAuthBanner />
        <DateRangePicker value={range} onChange={onRangeChange} />

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-blue-400" size={32} />
            <p className="text-gray-400 mt-3 text-sm">Loading {range.label}...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {data && !loading && (
          <>
            {data.daily?.length > 0 && <KPISection daily={data.daily} subs={data.subscribers} />}
            {data.subscribers?.length > 0 && <SubscriberSection subs={data.subscribers} />}
            {data.revenue && <RevenueSection revenue={data.revenue} />}
            {data.daily?.length > 0 && <DailyChart daily={data.daily} />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
              {data.topViews?.length > 0 && <TopVideosCard title="Top by Views" icon={<Eye size={14} />} videos={data.topViews} metric="views" color="blue" />}
              {data.topWatch?.length > 0 && <TopVideosCard title="Top by Watch Time" icon={<Clock size={14} />} videos={data.topWatch} metric="estimatedMinutesWatched" color="green" suffix="m" />}
              {data.topLikes?.length > 0 && <TopVideosCard title="Top by Likes" icon={<Heart size={14} />} videos={data.topLikes} metric="likes" color="red" />}
            </div>

            {data.demographics && <DemographicsSection demo={data.demographics} />}
            {data.traffic?.length > 0 && <TrafficSection traffic={data.traffic} />}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {data.playback?.length > 0 && <PlaybackLocationCard playback={data.playback} />}
              {data.sharing?.length > 0 && <SharingCard sharing={data.sharing} />}
            </div>

            {data.searchTerms?.length > 0 && <SearchTermsCard terms={data.searchTerms} />}
            {data.playlists?.length > 0 && <PlaylistsCard playlists={data.playlists} />}
          </>
        )}
      </div>
    </div>
  );
}

function KPISection({ daily, subs }: any) {
  const totals = daily.reduce((acc: any, d: any) => ({
    views: acc.views + (d.views || 0),
    watch: acc.watch + (d.estimatedMinutesWatched || 0),
    likes: acc.likes + (d.likes || 0),
    comments: acc.comments + (d.comments || 0),
    shares: acc.shares + (d.shares || 0),
    subsGained: acc.subsGained + (d.subscribersGained || 0),
  }), { views: 0, watch: 0, likes: 0, comments: 0, shares: 0, subsGained: 0 });
  const avgDur = daily.length > 0 ? daily.reduce((s: number, d: any) => s + (d.averageViewDuration || 0), 0) / daily.length : 0;
  const subsLost = subs ? subs.reduce((s: number, d: any) => s + (d.subscribersLost || 0), 0) : 0;
  const engRate = totals.views > 0 ? ((totals.likes + totals.comments + totals.shares) / totals.views) * 100 : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
      <KPI icon={<Eye size={14} />} title="Views" value={formatNumber(totals.views)} color="blue" />
      <KPI icon={<Clock size={14} />} title="Watch Hrs" value={Math.round(totals.watch / 60).toLocaleString()} color="green" />
      <KPI icon={<TrendingUp size={14} />} title="Avg Dur" value={Math.round(avgDur) + "s"} color="purple" />
      <KPI icon={<Heart size={14} />} title="Likes" value={formatNumber(totals.likes)} color="red" />
      <KPI icon={<MessageSquare size={14} />} title="Comments" value={formatNumber(totals.comments)} color="yellow" />
      <KPI icon={<Share2 size={14} />} title="Shares" value={formatNumber(totals.shares)} color="pink" />
      <KPI icon={<UserPlus size={14} />} title="Net Subs" value={(totals.subsGained - subsLost).toString()} color="cyan" subtitle={`+${totals.subsGained}/-${subsLost}`} />
      <KPI icon={<Activity size={14} />} title="Eng Rate" value={engRate.toFixed(2) + "%"} color="orange" />
    </div>
  );
}

function KPI({ icon, title, value, color, subtitle }: any) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-400",
    green: "border-green-500/20 bg-green-500/5 text-green-400",
    purple: "border-purple-500/20 bg-purple-500/5 text-purple-400",
    red: "border-red-500/20 bg-red-500/5 text-red-400",
    yellow: "border-yellow-500/20 bg-yellow-500/5 text-yellow-400",
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400",
    pink: "border-pink-500/20 bg-pink-500/5 text-pink-400",
    orange: "border-orange-500/20 bg-orange-500/5 text-orange-400",
  };
  return (
    <div className={`rounded-xl border p-2 sm:p-3 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] sm:text-xs text-gray-400">{title}</p>
        {icon}
      </div>
      <p className="text-lg sm:text-xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-[9px] text-gray-500 mt-0.5 truncate">{subtitle}</p>}
    </div>
  );
}

function SubscriberSection({ subs }: any) {
  const totalGained = subs.reduce((s: number, d: any) => s + (d.subscribersGained || 0), 0);
  const totalLost = subs.reduce((s: number, d: any) => s + (d.subscribersLost || 0), 0);
  const net = totalGained - totalLost;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <Users size={16} className="text-cyan-400" /> Subscriber Activity
      </h3>
      <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          <p className="text-gray-400">Gained</p>
          <p className="text-xl sm:text-2xl font-bold text-green-400">+{totalGained}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-gray-400">Lost</p>
          <p className="text-xl sm:text-2xl font-bold text-red-400">-{totalLost}</p>
        </div>
        <div className={`border rounded-lg p-3 ${net >= 0 ? "bg-blue-500/10 border-blue-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          <p className="text-gray-400">Net</p>
          <p className={`text-xl sm:text-2xl font-bold ${net >= 0 ? "text-blue-400" : "text-red-400"}`}>{net >= 0 ? "+" : ""}{net}</p>
        </div>
      </div>
    </div>
  );
}

function RevenueSection({ revenue }: any) {
  if (!revenue || revenue.estimatedRevenue == null) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-400">
        💰 Revenue data unavailable (channel may not be monetized)
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 sm:p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <DollarSign size={16} className="text-green-400" /> Revenue
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
        <div>
          <p className="text-gray-400">Estimated Revenue</p>
          <p className="text-xl sm:text-2xl font-bold text-green-400">${(revenue.estimatedRevenue || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-400">Ad Revenue</p>
          <p className="text-xl sm:text-2xl font-bold text-white">${(revenue.estimatedAdRevenue || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-400">CPM</p>
          <p className="text-xl sm:text-2xl font-bold text-white">${(revenue.cpm || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-400">Monetized Plays</p>
          <p className="text-xl sm:text-2xl font-bold text-white">{(revenue.monetizedPlaybacks || 0).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function DailyChart({ daily }: any) {
  const maxViews = Math.max(...daily.map((d: any) => d.views || 0));
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <TrendingUp size={16} className="text-blue-400" /> Daily Views Trend
      </h3>
      <div className="flex items-end gap-0.5 h-32 sm:h-40">
        {daily.map((d: any, i: number) => {
          const h = maxViews > 0 ? ((d.views || 0) / maxViews) * 100 : 0;
          return (
            <div key={i} className="flex-1 group relative" title={`${d.day}: ${d.views} views, ${d.likes} likes, ${d.comments} comments`}>
              <div className="bg-blue-500/50 hover:bg-blue-500 rounded-t transition-all" style={{ height: h + "%" }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-gray-500 mt-2">
        <span>{daily[0]?.day}</span>
        <span>{daily[Math.floor(daily.length / 2)]?.day}</span>
        <span>{daily[daily.length - 1]?.day}</span>
      </div>
    </div>
  );
}

function TopVideosCard({ title, icon, videos, metric, color, suffix = "" }: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm">
        <span className={`text-${color}-400`}>{icon}</span> {title}
      </h3>
      <div className="space-y-2">
        {videos.slice(0, 5).map((v: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="text-gray-600 w-4">{i + 1}.</span>
            <a href={`https://youtube.com/watch?v=${v.video}`} target="_blank" rel="noopener" className="flex-1 text-gray-300 hover:text-white truncate">
              {v.video}
            </a>
            <span className={`text-${color}-400 font-bold whitespace-nowrap`}>
              {formatNumber(v[metric] || 0)}{suffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemographicsSection({ demo }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm">
          <Users size={14} className="text-purple-400" /> Age & Gender
        </h3>
        {demo.ageGender?.length > 0 ? (
          <div className="space-y-2">
            {demo.ageGender.slice(0, 12).map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{d.ageGroup?.replace("age", "")} {d.gender}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-white/10 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-purple-500" style={{ width: Math.min(d.viewerPercentage * 2, 100) + "%" }} />
                  </div>
                  <span className="text-white font-medium w-10 text-right">{d.viewerPercentage?.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-xs">No data</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm">
          <Globe size={14} className="text-blue-400" /> Top Countries
        </h3>
        {demo.geography?.length > 0 ? (
          <div className="space-y-1.5">
            {demo.geography.slice(0, 10).map((g: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{g.country}</span>
                <span className="text-white font-medium">{formatNumber(g.views || 0)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-xs">No data</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 space-y-3">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2 mb-2 text-sm">
            <Smartphone size={14} className="text-green-400" /> Devices
          </h3>
          {demo.devices?.length > 0 ? (
            <div className="space-y-1">
              {demo.devices.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 capitalize">{d.deviceType?.toLowerCase()}</span>
                  <span className="text-white font-medium">{formatNumber(d.views || 0)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-xs">No data</p>}
        </div>
        {demo.os?.length > 0 && (
          <div className="pt-2 border-t border-white/5">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-2 text-sm">
              <Monitor size={14} className="text-cyan-400" /> Operating Systems
            </h3>
            <div className="space-y-1">
              {demo.os.slice(0, 5).map((o: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">{o.operatingSystem}</span>
                  <span className="text-white">{formatNumber(o.views || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrafficSection({ traffic }: any) {
  const total = traffic.reduce((s: number, t: any) => s + (t.views || 0), 0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <TrendingUp size={16} className="text-orange-400" /> Traffic Sources
      </h3>
      <div className="space-y-2">
        {traffic.slice(0, 15).map((t: any, i: number) => {
          const pct = total > 0 ? ((t.views || 0) / total) * 100 : 0;
          return (
            <div key={i} className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-300">{t.insightTrafficSourceType?.replace(/_/g, " ")}</span>
                <span className="text-white font-medium">{formatNumber(t.views || 0)} ({pct.toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-orange-500" style={{ width: pct + "%" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaybackLocationCard({ playback }: any) {
  const total = playback.reduce((s: number, p: any) => s + (p.views || 0), 0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm">
        <Monitor size={14} className="text-cyan-400" /> Where Videos Are Watched
      </h3>
      <div className="space-y-2">
        {playback.map((p: any, i: number) => {
          const pct = total > 0 ? ((p.views || 0) / total) * 100 : 0;
          return (
            <div key={i} className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-300">{p.insightPlaybackLocationType?.replace(/_/g, " ")}</span>
                <span className="text-white">{pct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: pct + "%" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SharingCard({ sharing }: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm">
        <Share2 size={14} className="text-pink-400" /> Shared To
      </h3>
      <div className="space-y-1.5">
        {sharing.slice(0, 10).map((s: any, i: number) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-gray-300">{s.sharingService?.replace(/_/g, " ")}</span>
            <span className="text-white font-medium">{s.shares || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchTermsCard({ terms }: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <Search size={14} className="text-yellow-400" /> YouTube Search Terms (How viewers find you)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
        {terms.slice(0, 30).map((t: any, i: number) => (
          <div key={i} className="flex justify-between text-xs bg-black/20 rounded px-2 py-1">
            <span className="text-gray-300 truncate">{t.insightTrafficSourceDetail || "—"}</span>
            <span className="text-yellow-400 font-medium ml-2">{t.views || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaylistsCard({ playlists }: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <ListVideo size={14} className="text-purple-400" /> Playlist Performance
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 text-left border-b border-white/10">
              <th className="pb-2">Playlist</th>
              <th className="pb-2 text-right">Views</th>
              <th className="pb-2 text-right">Watch Min</th>
              <th className="pb-2 text-right">Avg Time</th>
            </tr>
          </thead>
          <tbody>
            {playlists.slice(0, 10).map((p: any, i: number) => (
              <tr key={i} className="border-b border-white/5">
                <td className="py-2 text-gray-300 truncate max-w-xs">{p.playlist_title || p.playlist}</td>
                <td className="py-2 text-right text-white">{formatNumber(p.views || 0)}</td>
                <td className="py-2 text-right text-white">{Math.round(p.estimatedMinutesWatched || 0)}</td>
                <td className="py-2 text-right text-cyan-400">{Math.round(p.averageTimeInPlaylist || 0)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
