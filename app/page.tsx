import Link from "next/link";
import { BarChart3, Brain, Bell, TrendingUp, Zap, Users } from "lucide-react";

export default function HomePage() {
  const features = [
    { icon: <BarChart3 size={24} />, title: "Deep Analytics", desc: "Views, CTR, retention, revenue - all in one place with AI interpretation" },
    { icon: <Brain size={24} />, title: "AI Video Analysis", desc: "Know exactly WHY each video succeeded or failed with specific fixes" },
    { icon: <TrendingUp size={24} />, title: "Performance Ranking", desc: "See your best and worst videos ranked by AI performance score" },
    { icon: <Bell size={24} />, title: "Telegram Alerts", desc: "Instant notifications for viral videos, low CTR, milestones" },
    { icon: <Zap size={24} />, title: "Title & Hook Generator", desc: "AI generates optimized titles and powerful video hooks" },
    { icon: <Users size={24} />, title: "Works in Demo Mode", desc: "Try everything immediately with demo data - no API keys needed" },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-gray-950 to-purple-900/20" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 text-sm mb-8">
            <Zap size={14} />
            AI-Powered YouTube Operating System
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Know exactly why your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-purple-400">
              videos win or lose
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
            AI analyzes every video CTR, retention, thumbnail, title, description.
            Get specific fixes, not vague advice. Built for serious YouTube creators.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/dashboard" className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 flex items-center gap-2">
              <BarChart3 size={20} />
              Open Dashboard
            </Link>
            <Link href="/insights" className="px-8 py-4 border border-white/20 hover:bg-white/10 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2">
              <Brain size={20} />
              AI Tools
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-4">Everything in one place</h2>
        <p className="text-gray-400 text-center mb-12">No more switching between 10 different tools</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:scale-105">
              <div className="text-red-400 mb-4">{f.icon}</div>
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
