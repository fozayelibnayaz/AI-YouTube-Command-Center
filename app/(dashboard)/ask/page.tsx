"use client";
import { useState, useRef, useEffect } from "react";
import { Brain, Send, User, Bot, Sparkles, Loader2, Trash2, Copy, Check } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  source?: string;
  timestamp: string;
}

const SUGGESTED = [
  "How is my channel doing overall?",
  "What's my best performing video and why?",
  "Which videos have the worst retention?",
  "What content should I create next based on my data?",
  "Show me engagement breakdown",
  "What's my average watch time?",
  "Compare my top 5 vs bottom 5 videos",
  "What patterns do you see in my viral videos?",
  "Why are some videos getting 0 views?",
  "Give me a 30-day action plan",
  "What times should I upload?",
  "Which videos should I make Part 2 of?",
];

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function askQuestion(question: string) {
    if (!question.trim()) return;
    const q = question.trim();
    setInput("");
    const newMsgs = [...messages, { role: "user" as const, content: q, timestamp: new Date().toLocaleTimeString() }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history: newMsgs.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const text = await res.text();
      let json: any;
      try { json = JSON.parse(text); }
      catch {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Server error - returned invalid response. Please try again or contact support.",
          timestamp: new Date().toLocaleTimeString(),
        }]);
        return;
      }
      setMessages(prev => [...prev, {
        role: "assistant",
        content: json.success ? json.answer : "Error: " + (json.error || "Failed to get answer"),
        source: json.source,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error: " + String(e), timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setLoading(false);
    }
  }

  function copyMessage(i: number, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function clearChat() {
    if (confirm("Clear conversation?")) setMessages([]);
  }

  return (
    <div className="flex flex-col min-h-screen p-3 sm:p-4 lg:p-6">
      <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0">
        <div className="mb-4 sm:mb-6 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <Brain className="text-purple-400 flex-shrink-0" size={24} />
              Ask AI About Your Channel
            </h1>
            <p className="text-gray-400 mt-1 text-xs sm:text-sm">AI analyzes all your real video data. Conversation has memory.</p>
          </div>
          {messages.length > 0 && (
            <button onClick={clearChat} className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded border border-white/10">
              <Trash2 size={12} /> Clear
            </button>
          )}
        </div>

        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-2 py-8">
            <Sparkles size={40} className="text-purple-400 mb-3 opacity-50" />
            <p className="text-gray-400 text-sm sm:text-base lg:text-lg mb-4 sm:mb-6 text-center">Ask me anything about your channel</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTED.map((q, i) => (
                <button key={i} onClick={() => askQuestion(q)}
                  className="text-left text-xs sm:text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 mb-3 sm:mb-4 pr-1 sm:pr-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-600/30 flex items-center justify-center">
                    <Bot size={14} className="text-purple-400" />
                  </div>
                )}
                <div className={`max-w-[85%] sm:max-w-[80%] rounded-xl p-3 sm:p-4 ${msg.role === "user" ? "bg-blue-600/20 border border-blue-500/30" : "bg-white/5 border border-white/10"}`}>
                  <p className="text-xs sm:text-sm text-gray-200 whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] sm:text-xs text-gray-600">{msg.timestamp}</span>
                    {msg.source && <span className="text-[10px] sm:text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{msg.source}</span>}
                    {msg.role === "assistant" && (
                      <button onClick={() => copyMessage(i, msg.content)} className="text-[10px] text-gray-500 hover:text-white ml-auto">
                        {copiedIdx === i ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600/30 flex items-center justify-center">
                    <User size={14} className="text-blue-400" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-600/30 flex items-center justify-center">
                  <Loader2 size={14} className="text-purple-400 animate-spin" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-gray-400">Analyzing your channel data...</p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        <div className="flex gap-2 items-center sticky bottom-0 bg-gray-950 pt-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && askQuestion(input)}
            placeholder="Ask about your channel..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 text-xs sm:text-sm"
            disabled={loading}
          />
          <button onClick={() => askQuestion(input)} disabled={loading || !input.trim()}
            className="px-3 sm:px-4 py-2.5 sm:py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white disabled:opacity-50 transition-all flex-shrink-0">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
