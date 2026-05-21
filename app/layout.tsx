import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI YouTube Command Center",
  description: "AI-powered YouTube analytics and growth system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-gray-950 text-white min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
