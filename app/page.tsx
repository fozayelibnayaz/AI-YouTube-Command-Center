import Link from "next/link";
import { BarChart3, Brain, Bell, TrendingUp, Zap, Users, MessageCircle } from "lucide-react";

export default function HomePage() {
  const features = [
    { icon: <BarChart3 size={24} />, title: "Deep Analytics", desc: "Views, CTR, retention - all with AI interpretation" },
    { icon: <Brain size={24} />, title: "AI Video Analysis", desc: "Know exactly WHY each video succeeded or failed" },
    { icon: <MessageCircle size={24} />, title: "Ask AI Anything", desc: "Chat with AI about your channel data" },
    { icon: <Bell size={24} />, title: "Smart Telegram Alerts", desc: "25+ event types - viral, milestones, warnings" },
    { icon: <TrendingUp size={24} />, title: "Performance Ranking", desc: "All videos ranked by AI score" },
    { icon: <Zap size={24} />, title: "Title & Hook Generator", desc: "AI generates optimized titles and hooks" },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-gray-950 to-purple-900/20" />
        <div className="absolute top-20 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-red-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-purple-600/10 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 text-xs sm:text-sm mb-6 sm:mb-8">
            <Zap size={12} />
            AI-Powered YouTube Operating System
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight">
            Know exactly why your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-purple-400">
              videos win or lose
            </span>
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-gray-400 max-w-3xl mx-auto mb-6 sm:mb-10 px-2">
            AI analyzes every video CTR, retention, thumbnail, title. Get specific fixes, not vague advice.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/dashboard" className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm sm:text-lg transition-all hover:scale-105 flex items-center justify-center gap-2">
              <BarChart3 size={20} />
              Open Dashboard
            </Link>
            <Link href="/ask" className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 border border-white/20 hover:bg-white/10 text-white rounded-xl font-semibold text-sm sm:text-lg transition-all flex items-center justify-center gap-2">
              <MessageCircle size={20} />
              Ask AI
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-3 sm:mb-4">Everything in one place</h2>
        <p className="text-gray-400 text-center mb-8 sm:mb-12 text-sm sm:text-base">No more switching between 10 different tools</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {features.map((f, i) => (
            <div key={i} className="p-4 sm:p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:scale-105">
              <div className="text-red-400 mb-3 sm:mb-4">{f.icon}</div>
              <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">{f.title}</h3>
              <p className="text-gray-400 text-xs sm:text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
