"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Brain, Tv, MessageCircle, Menu, X, Home, BarChart3 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/analytics", icon: BarChart3, label: "Real Analytics" },
    { href: "/ask", icon: MessageCircle, label: "Ask AI" },
    { href: "/insights", icon: Brain, label: "AI Tools" },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="lg:hidden sticky top-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
            <Tv size={14} className="text-white" />
          </div>
          <span className="text-white text-sm font-bold">YT Command</span>
        </Link>
        <button onClick={() => setOpen(!open)} className="p-2 text-white rounded-lg hover:bg-white/10 transition-colors">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {open && <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />}

      <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-gray-900/95 backdrop-blur-md border-r border-white/5 flex flex-col z-50 transition-transform duration-300 ${
        open ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 lg:w-56`}>
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Tv size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-bold">YT Command</p>
              <p className="text-gray-500 text-xs">AI System</p>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(link => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-red-600/20 text-red-400 border border-red-500/30" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}>
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-white/5 transition-all">
            <Home size={18} /> Home
          </Link>
        </div>
      </aside>

      <main className="lg:ml-56 min-h-screen">{children}</main>
    </div>
  );
}
