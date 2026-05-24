"use client";
import { useState, useEffect } from "react";
import { OAuthBanner } from "@/components/oauth-banner";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange, getPresetRanges } from "@/lib/date-ranges";
import {
  BarChart3, Users, Globe, Smartphone, TrendingUp, DollarSign,
  PlayCircle, Eye, Clock, Loader2, AlertCircle, Calendar, Heart,
  MessageSquare, Share2, UserPlus, Search, Trophy
} from "lucide-react";

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
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Failed");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(range); }, []);

  function onRangeChange(r: DateRange) {
    setRange(r);
    fetchData(r);
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <BarChart3 className="text-blue-400 flex-shrink-0" size={24} />
            Real Analytics (YouTube Analytics API)
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">100% real data: retention, demographics, traffic sources, revenue</p>
        </div>

        <OAuthBanner />

        <DateRangePicker value={range} onChange={onRangeChange} />

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-blue-400" size={32} />
            <p className="text-gray-400 mt-3 text-sm">Loading analytics for {range.label}...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {data && !loading && (
          <>
            {data.daily && data.daily.length > 0 && (
              <ChannelTotals daily={data.daily} subs={data.subscribers} />
            )}

            {data.subscribers && data.subscribers.length > 0 && (
              <SubscriberSection subs={data.subscribers} />
            )}

            {data.revenue && (
              <RevenueSection revenue={data.revenue} />
            )}

            {data.daily && data.daily.length > 0 && (
              <DailyChart daily={data.daily} />
            )}

            {data.demographics && (
              <DemographicsSection demo={data.demographics} />
            )}

            {data.traffic && data.traffic.length > 0 && (
              <TrafficSection traffic={data.traffic} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChannelTotals({ daily, subs }: any) {
  const totals = daily.reduce((acc: any, d: any) => ({
    views: acc.views + (d.views || 0),
    watch: acc.watch + (d.estimatedMinutesWatched || 0),
    likes: acc.likes + (d.likes || 0),
    comments: acc.comments + (d.comments || 0),
  }), { views: 0, watch: 0, likes: 0, comments: 0 });
  const avgDuration = daily.length > 0 ? daily.reduce((s: number, d: any) => s + (d.averageViewDuration || 0), 0) / daily.length : 0;
  const subsGained = subs ? subs.reduce((s: number, d: any) => s + (d.subscribersGained || 0), 0) : 0;
  const subsLost = subs ? subs.reduce((s: number, d: any) => s + (d.subscribersLost || 0), 0) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatBox icon={<Eye size={16} />} title="Views" value={totals.views.toLocaleString()} color="blue" />
      <StatBox icon={<Clock size={16} />} title="Watch Hours" value={Math.round(totals.watch / 60).toLocaleString()} color="green" subtitle="✓ REAL" />
      <StatBox icon={<TrendingUp size={16} />} title="Avg Watch" value={Math.round(avgDuration) + "s"} color="purple" subtitle="per view" />
      <StatBox icon={<Heart size={16} />} title="Likes" value={totals.likes.toLocaleString()} color="red" />
      <StatBox icon={<MessageSquare size={16} />} title="Comments" value={totals.comments.toLocaleString()} color="yellow" />
      <StatBox icon={<UserPlus size={16} />} title="Net Subs" value={(subsGained - subsLost).toString()} color="cyan" subtitle={`+${subsGained} / -${subsLost}`} />
    </div>
  );
}

function StatBox({ icon, title, value, color, subtitle }: any) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-400",
    green: "border-green-500/20 bg-green-500/5 text-green-400",
    purple: "border-purple-500/20 bg-purple-500/5 text-purple-400",
    red: "border-red-500/20 bg-red-500/5 text-red-400",
    yellow: "border-yellow-500/20 bg-yellow-500/5 text-yellow-400",
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400",
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">{title}</p>
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-[10px] text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function SubscriberSection({ subs }: any) {
  const totalGained = subs.reduce((s: number, d: any) => s + (d.subscribersGained || 0), 0);
  const totalLost = subs.reduce((s: number, d: any) => s + (d.subscribersLost || 0), 0);
  const net = totalGained - totalLost;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
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
        💰 Revenue data not available (channel may not be monetized)
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <DollarSign size={16} className="text-green-400" /> Revenue (REAL)
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <TrendingUp size={16} className="text-blue-400" /> Daily Views Trend
      </h3>
      <div className="flex items-end gap-1 h-32 sm:h-40">
        {daily.map((d: any, i: number) => {
          const h = maxViews > 0 ? ((d.views || 0) / maxViews) * 100 : 0;
          return (
            <div key={i} className="flex-1 group relative" title={`${d.day}: ${d.views} views`}>
              <div className="bg-blue-500/50 hover:bg-blue-500 rounded-t transition-all" style={{ height: h + "%" }} />
              {i % Math.ceil(daily.length / 10) === 0 && (
                <p className="text-[8px] text-gray-500 mt-1 text-center truncate">{d.day?.substring(5)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DemographicsSection({ demo }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
          <Users size={16} className="text-purple-400" /> Age & Gender
        </h3>
        {demo.ageGender?.length > 0 ? (
          <div className="space-y-2">
            {demo.ageGender.slice(0, 10).map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-gray-300">{d.ageGroup?.replace("age", "")} {d.gender}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 sm:w-32 bg-white/10 rounded-full h-2">
                    <div className="h-2 rounded-full bg-purple-500" style={{ width: Math.min(d.viewerPercentage * 2, 100) + "%" }} />
                  </div>
                  <span className="text-white font-medium w-12 text-right">{d.viewerPercentage?.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-xs">No demographic data</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
          <Globe size={16} className="text-blue-400" /> Top Countries
        </h3>
        {demo.geography?.length > 0 ? (
          <div className="space-y-2">
            {demo.geography.slice(0, 10).map((g: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-gray-300">{g.country}</span>
                <span className="text-white font-medium">{(g.views || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-xs">No data</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
          <Smartphone size={16} className="text-green-400" /> Devices
        </h3>
        {demo.devices?.length > 0 ? (
          <div className="space-y-2">
            {demo.devices.map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-gray-300 capitalize">{d.deviceType?.toLowerCase()}</span>
                <span className="text-white font-medium">{(d.views || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-xs">No data</p>}
      </div>
    </div>
  );
}

function TrafficSection({ traffic }: any) {
  const total = traffic.reduce((s: number, t: any) => s + (t.views || 0), 0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <TrendingUp size={16} className="text-orange-400" /> Traffic Sources
      </h3>
      <div className="space-y-2">
        {traffic.slice(0, 15).map((t: any, i: number) => {
          const pct = total > 0 ? ((t.views || 0) / total) * 100 : 0;
          return (
            <div key={i} className="text-xs sm:text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-300">{t.insightTrafficSourceType?.replace(/_/g, " ")}</span>
                <span className="text-white font-medium">{(t.views || 0).toLocaleString()} ({pct.toFixed(1)}%)</span>
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
