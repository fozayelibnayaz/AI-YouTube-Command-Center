import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const eq = trimmed.indexOf("=");
        process.env[trimmed.substring(0, eq).trim()] = trimmed.substring(eq + 1).trim();
      }
    }
  } catch { console.error("ERROR: .env.local not found"); process.exit(1); }
}

async function test(name, fn) {
  process.stdout.write("  Testing " + name + "... ");
  try {
    const result = await fn();
    console.log("OK - " + result);
    return true;
  } catch (e) {
    console.log("FAIL - " + e.message);
    return false;
  }
}

async function run() {
  console.log("");
  console.log("================================================");
  console.log("  AI YOUTUBE COMMAND CENTER - TEST SUITE");
  console.log("================================================");
  console.log("");

  loadEnv();
  const results = {};

  console.log("TELEGRAM");
  results.telegram = await test("Connection", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const apiUrl = process.env.TELEGRAM_API_URL || "https://api.telegram.org";
    
    if (!token || token.includes("your_")) throw new Error("Token not set");
    if (!chatId || chatId.includes("your_")) throw new Error("Chat ID not set");

    const usingProxy = apiUrl.includes("workers.dev") || !apiUrl.includes("api.telegram.org");
    
    const res = await fetch(apiUrl + "/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Test message from AI YouTube Command Center\nTime: " + new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }) + "\nVia: " + (usingProxy ? "Cloudflare Proxy" : "Direct"),
      }),
    });
    
    const json = await res.json();
    if (!json.ok) throw new Error(json.description || "Unknown error");
    return usingProxy ? "Via Cloudflare proxy" : "Direct connection";
  });

  console.log("");
  console.log("YOUTUBE");
  results.youtube = await test("API Key", async () => {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key || key.includes("your_")) throw new Error("API key not set");
    const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=" + key);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return "Working";
  });

  console.log("");
  console.log("SUPABASE");
  results.supabase = await test("Connection", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || url.includes("your_")) throw new Error("URL not set");
    if (!anonKey || anonKey.includes("your_")) throw new Error("Anon key not set");
    
    const res = await fetch(url + "/rest/v1/videos?select=count", {
      headers: { 
        apikey: anonKey, 
        Authorization: "Bearer " + anonKey,
        Prefer: "count=exact",
      },
    });
    
    if (res.status === 401) throw new Error("Invalid anon key");
    if (res.status === 404) throw new Error("Tables not created - run SQL schema");
    if (!res.ok) throw new Error("HTTP " + res.status);
    return "Connected with tables ready";
  });

  console.log("");
  console.log("AI");
  results.ai = await test("AI API", async () => {
    const groq = process.env.GROQ_API_KEY;
    const openai = process.env.OPENAI_API_KEY;
    if (groq && !groq.includes("your_")) {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: "Bearer " + groq },
      });
      if (!res.ok) throw new Error("Invalid Groq key");
      return "Groq working (FREE)";
    }
    if (openai && !openai.includes("your_")) {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: "Bearer " + openai },
      });
      if (!res.ok) throw new Error("Invalid OpenAI key");
      return "OpenAI working";
    }
    throw new Error("No AI key");
  });

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.values(results).length;

  console.log("");
  console.log("================================================");
  console.log("  RESULTS: " + passed + "/" + total + " services connected");
  console.log("================================================");
  
  if (passed === total) {
    console.log("  ALL SYSTEMS GO! Check Telegram for test message.");
  }
  
  console.log("");
  console.log("  Next: npm run dev");
  console.log("  Open: http://localhost:3000/dashboard");
  console.log("");
}

run().catch(console.error);
