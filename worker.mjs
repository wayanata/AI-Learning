/**
 * Minimal Cloudflare Worker so `wrangler deploy` from the repo root succeeds.
 * The Telegram bot in telegram-learning-agent/ is a long-running Node process;
 * run it on a VPS, Fly.io, Railway, etc., or refactor it to use Telegram webhooks here.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        repo: "AI-Learning",
        hint: "Telegram bot: telegram-learning-agent/",
      });
    }

    return new Response(
      [
        "AI-Learning",
        "",
        "This deploy is a placeholder Worker for Cloudflare Builds.",
        "Telegram learning bot: see folder telegram-learning-agent/ (Node.js + polling).",
      ].join("\n"),
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  },
};
