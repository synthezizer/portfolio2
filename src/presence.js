// Live Discord presence via Lanyard (https://github.com/Phineas/lanyard).
// It only works once the Discord account has joined Lanyard's server, and needs no token.
const SOCKET_URL = "wss://api.lanyard.rest/socket";
const OP = { EVENT: 0, HELLO: 1, INITIALIZE: 2, HEARTBEAT: 3 };
const MAX_RETRY_MS = 60000;
const STALE_MS = 15000; // don't keep showing a status we can no longer confirm

// Calls onChange with Lanyard's presence object, or null when it's unknown
// (not monitored, offline network, socket blocked). Reconnects with backoff.
export function watchPresence(id, onChange, Socket = globalThis.WebSocket) {
  let retries = 0;
  let staleTimer = 0;

  function connect() {
    let socket;
    let heartbeat = 0;
    try {
      socket = new Socket(SOCKET_URL);
    } catch {
      scheduleRetry();
      return;
    }

    socket.addEventListener("message", (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.op === OP.HELLO) {
        heartbeat = setInterval(() => {
          if (socket.readyState === 1) socket.send(JSON.stringify({ op: OP.HEARTBEAT }));
        }, msg.d.heartbeat_interval);
        socket.send(JSON.stringify({ op: OP.INITIALIZE, d: { subscribe_to_id: id } }));
      } else if (msg.op === OP.EVENT && (msg.t === "INIT_STATE" || msg.t === "PRESENCE_UPDATE")) {
        retries = 0;
        clearTimeout(staleTimer);
        staleTimer = 0;
        onChange(msg.d?.discord_status ? msg.d : null);
      }
    });

    socket.addEventListener("close", () => {
      clearInterval(heartbeat);
      if (!staleTimer) staleTimer = setTimeout(() => onChange(null), retries ? 0 : STALE_MS);
      scheduleRetry();
    });
  }

  function scheduleRetry() {
    const delay = Math.min(2000 * 2 ** retries, MAX_RETRY_MS);
    retries += 1;
    setTimeout(connect, delay);
  }

  connect();
}

const STATUS_WORDS = { online: "online", idle: "idle", dnd: "busy", offline: "offline" };
const ACTIVITY_VERBS = { 0: "playing", 1: "streaming", 2: "listening to", 3: "watching", 5: "competing in" };
const LISTENING = 2;
const CUSTOM_STATUS = 4;

const artistName = (v) => (typeof v === "string" ? v.replaceAll(";", ",") : "");

// Anything Discord reports as listening: Spotify, or any other app with a listening activity.
function findMusic(data, activities) {
  if (data.listening_to_spotify && data.spotify?.song) {
    const { song, artist, timestamps } = data.spotify;
    return { source: "Spotify", song, artist: artistName(artist), start: timestamps?.start, end: timestamps?.end };
  }
  const a = activities.find((x) => x.type === LISTENING && (x.details || x.name));
  if (!a) return null;
  return { source: a.name || "music", song: a.details || a.name, artist: artistName(a.state), start: a.timestamps?.start, end: a.timestamps?.end };
}

// Lanyard presence -> what the page shows: { status, word, activity, music }.
export function describePresence(data, { showActivity = true } = {}) {
  const word = STATUS_WORDS[data?.discord_status];
  if (!word) return null;
  const status = data.discord_status === "dnd" ? "busy" : data.discord_status;
  if (!showActivity || status === "offline") return { status, word, activity: "", music: null };

  const activities = Array.isArray(data.activities) ? data.activities : [];
  const music = findMusic(data, activities);
  if (music) return { status, word, activity: "", music };

  const doing = activities.find((a) => a.type in ACTIVITY_VERBS && a.type !== LISTENING && a.name);
  const custom = activities.find((a) => a.type === CUSTOM_STATUS && a.state);
  const activity = doing ? `${ACTIVITY_VERBS[doing.type]} ${doing.name}` : custom ? custom.state : "";
  return { status, word, activity, since: doing?.timestamps?.start ?? null, music: null };
}

// "for how long" for a game, in the page's casual voice.
export function howLong(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "under a minute";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
