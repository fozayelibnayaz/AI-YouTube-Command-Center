import Link from "next/link";
import { LayoutDashboard, Brain, Tv } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <aside className="fixed left-0 top-0 bottom-0 w-56 bg-gray-900/80 backdrop-blur-sm border-r border-white/5 flex flex-col z-40">
        <div className="p-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Tv size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-bold">YT Command</p>
              <p className="text-gray-500 text-xs">AI System</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
            <LayoutDashboard size={18} />
            Dashboard
          </Link>
          <Link href="/insights" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
            <Brain size={18} />
            AI Tools
          </Link>
        </nav>

        <div className="p-3 border-t border-white/5">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-white/5 transition-all">
            <span>Home</span>
          </Link>
        </div>
      </aside>
      <main className="flex-1 ml-56">{children}</main>
    </div>
  );
}
