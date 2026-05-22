"use client";
import { useState, useEffect } from "react";
import { OAuthBanner } from "@/components/oauth-banner";
import {
  BarChart3, Users, Globe, Smartphone, TrendingUp, DollarSign,
  PlayCircle, Eye, Clock, Loader2, AlertCircle
} from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analytics?action=all&days=${days}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to load");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [days]);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <BarChart3 className="text-blue-400 flex-shrink-0" size={24} />
            Real Analytics (YouTube Analytics API)
          </h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">100% real data: CTR, retention, demographics, traffic sources</p>
        </div>

        <OAuthBanner />

        <div className="flex gap-2 flex-wrap">
          {[7, 30, 90, 365].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all ${
              days === d ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}>
              Last {d} days
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-blue-400" size={32} />
            <p className="text-gray-400 mt-3 text-sm">Loading analytics...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Channel Totals */}
            {data.daily && data.daily.length > 0 && (
              <ChannelTotals daily={data.daily} />
            )}

            {/* Revenue (if monetized) */}
            {data.revenue && (
              <RevenueSection revenue={data.revenue} />
            )}

            {/* Demographics */}
            {data.demographics && (
              <DemographicsSection demo={data.demographics} />
            )}

            {/* Traffic Sources */}
            {data.traffic && data.traffic.length > 0 && (
              <TrafficSection traffic={data.traffic} />
            )}

            {/* Subscriber Growth */}
            {data.subscribers && data.subscribers.length > 0 && (
              <SubscriberSection subs={data.subscribers} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChannelTotals({ daily }: { daily: any[] }) {
  const totals = daily.reduce((acc, d) => ({
    views: acc.views + (d.views || 0),
    watch: acc.watch + (d.estimatedMinutesWatched || 0),
    likes: acc.likes + (d.likes || 0),
    comments: acc.comments + (d.comments || 0),
  }), { views: 0, watch: 0, likes: 0, comments: 0 });

  const avgDuration = daily.reduce((s, d) => s + (d.averageViewDuration || 0), 0) / daily.length;
  const watchHours = (totals.watch / 60).toFixed(0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatBox icon={<Eye size={16} />} title="Total Views" value={totals.views.toLocaleString()} color="blue" />
      <StatBox icon={<Clock size={16} />} title="Watch Hours" value={parseInt(watchHours).toLocaleString()} color="green" subtitle="real" />
      <StatBox icon={<TrendingUp size={16} />} title="Avg Watch" value={Math.round(avgDuration) + "s"} color="purple" subtitle="per view" />
      <StatBox icon={<PlayCircle size={16} />} title="Total Likes" value={totals.likes.toLocaleString()} color="red" />
      <StatBox icon={<Users size={16} />} title="Comments" value={totals.comments.toLocaleString()} color="yellow" />
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

function RevenueSection({ revenue }: { revenue: any }) {
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

function DemographicsSection({ demo }: { demo: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
          <Users size={16} className="text-purple-400" /> Age & Gender
        </h3>
        {demo.ageGender?.length > 0 ? (
          <div className="space-y-2">
            {demo.ageGender.slice(0, 8).map((d: any, i: number) => (
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
        ) : <p className="text-gray-500 text-xs">No demographic data available</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
          <Globe size={16} className="text-blue-400" /> Top Countries
        </h3>
        {demo.geography?.length > 0 ? (
          <div className="space-y-2">
            {demo.geography.slice(0, 8).map((g: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-gray-300">{g.country}</span>
                <span className="text-white font-medium">{(g.views || 0).toLocaleString()} views</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-xs">No geography data available</p>}
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
        ) : <p className="text-gray-500 text-xs">No device data</p>}
      </div>
    </div>
  );
}

function TrafficSection({ traffic }: { traffic: any[] }) {
  const total = traffic.reduce((s, t) => s + (t.views || 0), 0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <TrendingUp size={16} className="text-orange-400" /> Traffic Sources (REAL)
      </h3>
      <div className="space-y-2">
        {traffic.slice(0, 10).map((t: any, i: number) => {
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

function SubscriberSection({ subs }: { subs: any[] }) {
  const totalGained = subs.reduce((s, d) => s + (d.subscribersGained || 0), 0);
  const totalLost = subs.reduce((s, d) => s + (d.subscribersLost || 0), 0);
  const net = totalGained - totalLost;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm sm:text-base">
        <Users size={16} className="text-cyan-400" /> Subscriber Activity (REAL)
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
