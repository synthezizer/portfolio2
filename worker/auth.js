// GET /api/auth: start GitHub sign-in for Decap CMS.
// Needs GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET set on the Worker (Settings → Variables and Secrets).
import { STATE_COOKIE, handshakePage, missingConfig } from "./oauth.js";

export async function onRequestGet({ request, env }) {
  if (missingConfig(env)) {
    return handshakePage("error", { message: "GitHub OAuth isn't configured on this site yet." });
  }

  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${origin}/api/callback`);
  // "repo" works for public and private repos; set GITHUB_OAUTH_SCOPE=public_repo to narrow it for a public repo.
  authorize.searchParams.set("scope", env.GITHUB_OAUTH_SCOPE || "repo");
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      "cache-control": "no-store",
      "set-cookie": `${STATE_COOKIE}=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
