/**
 * Placeholder Worker when Cloudflare Build root is `telegram-learning-agent/`.
 * The real Telegram bot runs as Node (polling); use a VPS/Railway or webhooks on Workers.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        package: "telegram-learning-agent",
        hint: "Run the bot with: npm install && npm start (Node host).",
      });
    }

    return new Response(
      [
        "telegram-learning-agent",
        "",
        "This Worker is a deploy placeholder for Cloudflare.",
        "Start the bot locally or on a Node host: npm start",
      ].join("\n"),
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  },
};
