// GET /api/callback: GitHub redirects here; swap the code for a token and hand it to Decap.
import { STATE_COOKIE, handshakePage, missingConfig } from "./_oauth.js";

export async function onRequestGet({ request, env }) {
  if (missingConfig(env)) {
    return handshakePage("error", { message: "GitHub OAuth isn't configured on this site yet." });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = request.headers.get("cookie") || "";
  const expected = cookies.match(new RegExp(`(?:^|;\s*)${STATE_COOKIE}=([^;]+)`))?.[1];

  // reject forged or replayed callbacks
  if (!code || !state || !expected || state !== expected) {
    return handshakePage("error", { message: "Sign-in expired or was tampered with. Try again." });
  }

  let data;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "user-agent": "decap-cms-oauth" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/callback`,
      }),
    });
    data = await res.json();
  } catch {
    return handshakePage("error", { message: "Couldn't reach GitHub. Try again." });
  }

  if (!data?.access_token) {
    return handshakePage("error", { message: data?.error_description || "GitHub didn't return a token." });
  }
  return handshakePage("success", { token: data.access_token, provider: "github" });
}
