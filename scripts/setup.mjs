import { createInterface } from "readline";
import { writeFileSync } from "fs";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function run() {
  console.log("\n================================================");
  console.log("  AI YOUTUBE COMMAND CENTER - SETUP");
  console.log("================================================\n");

  console.log("STEP 1: TELEGRAM");
  console.log("1. Open Telegram > Search @BotFather");
  console.log("2. Send /newbot > follow steps");
  console.log("3. Copy the token\n");
  const tgToken = await ask("Telegram Bot Token: ");

  console.log("\nNow send /start to your bot then visit:");
  console.log("https://api.telegram.org/bot" + (tgToken || "TOKEN") + "/getUpdates");
  console.log("Find the id number inside chat{}\n");
  const tgChatId = await ask("Telegram Chat ID: ");

  console.log("\nSTEP 2: YOUTUBE API");
  console.log("1. console.cloud.google.com");
  console.log("2. Create project > Enable YouTube Data API v3");
  console.log("3. Credentials > Create API Key\n");
  const ytKey = await ask("YouTube API Key (ENTER to skip): ");

  console.log("\nChannel ID is at youtube.com/account_advanced\n");
  const ytChannel = await ask("YouTube Channel ID (ENTER to skip): ");

  console.log("\nSTEP 3: SUPABASE");
  console.log("1. supabase.com > Sign up free");
  console.log("2. New project > Settings > API\n");
  const sbUrl = await ask("Supabase Project URL (ENTER to skip): ");
  const sbAnon = await ask("Supabase Anon Key (ENTER to skip): ");
  const sbService = await ask("Supabase Service Role Key (ENTER to skip): ");

  console.log("\nSTEP 4: OPENAI");
  console.log("1. platform.openai.com");
  console.log("2. API Keys > Create new key\n");
  const openaiKey = await ask("OpenAI API Key (ENTER to skip): ");

  const env = [
    "# AI YOUTUBE COMMAND CENTER",
    "# Generated: " + new Date().toISOString(),
    "",
    "# TELEGRAM",
    "TELEGRAM_BOT_TOKEN=" + (tgToken || "your_telegram_bot_token_here"),
    "TELEGRAM_CHAT_ID=" + (tgChatId || "your_telegram_chat_id_here"),
    "",
    "# YOUTUBE",
    "YOUTUBE_API_KEY=" + (ytKey || "your_youtube_api_key_here"),
    "YOUTUBE_CHANNEL_ID=" + (ytChannel || "your_youtube_channel_id_here"),
    "",
    "# SUPABASE",
    "NEXT_PUBLIC_SUPABASE_URL=" + (sbUrl || "your_supabase_url_here"),
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=" + (sbAnon || "your_supabase_anon_key_here"),
    "SUPABASE_SERVICE_ROLE_KEY=" + (sbService || "your_service_role_key_here"),
    "",
    "# OPENAI",
    "OPENAI_API_KEY=" + (openaiKey || "your_openai_key_here"),
    "",
    "# APP",
    "NEXT_PUBLIC_APP_URL=http://localhost:3000",
    "NODE_ENV=development"
  ].join("\n");

  writeFileSync(".env.local", env);

  console.log("\n================================================");
  console.log("  SETUP COMPLETE!");
  console.log("  .env.local created successfully");
  console.log("  Next: node scripts/test-all.mjs");
  console.log("================================================\n");

  rl.close();
}

run().catch(console.error);
