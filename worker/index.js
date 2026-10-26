// Cloudflare Worker: serves the built site from ./dist and handles the two
// GitHub sign-in routes Decap CMS needs. wrangler.jsonc runs this only for
// /api/*; every other request goes straight to the static assets.
import { onRequestGet as auth } from "./auth.js";
import { onRequestGet as callback } from "./callback.js";

const routes = { "/api/auth": auth, "/api/callback": callback };

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const handler = routes[pathname];
    if (handler) {
      if (request.method !== "GET") return new Response("method not allowed", { status: 405, headers: { allow: "GET" } });
      return handler({ request, env, ctx });
    }
    return env.ASSETS.fetch(request);
  },
};
