// Shared bits for the Decap CMS ↔ GitHub OAuth handshake (Cloudflare Pages Functions).
// Files starting with "_" aren't routed, so this is import-only.

export const STATE_COOKIE = "decap_oauth_state";

// Decap opens /api/auth in a popup and waits for this exact postMessage protocol:
//   popup → opener: "authorizing:github"
//   opener → popup: "authorizing:github" (echo)
//   popup → opener: "authorization:github:<success|error>:<json>"
// The result (which may carry the token) is only ever posted to this site's own origin.
export function handshakePage(status, content) {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html><meta charset="utf-8"><title>signing in…</title>
<p style="font-family:system-ui,sans-serif">${status === "success" ? "signed in, you can close this window." : "sign-in failed, you can close this window."}</p>
<script>
  (function () {
    var message = ${JSON.stringify(message)};
    var origin = window.location.origin;
    window.addEventListener("message", function (e) {
      if (e.origin !== origin || e.data !== "authorizing:github") return;
      window.opener && window.opener.postMessage(message, origin);
    });
    window.opener && window.opener.postMessage("authorizing:github", origin);
  })();
</script>`;
  return new Response(html, {
    status: status === "success" ? 200 : 400,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      // the state cookie is single-use
      "set-cookie": `${STATE_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

export function missingConfig(env) {
  return !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET;
}
