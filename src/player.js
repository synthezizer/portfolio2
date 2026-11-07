import { gsap } from "gsap";

// A Frutiger Aero media player, rendered like it's 2003: the art is painted at a tiny
// resolution, crushed to the 216 web-safe colors with ordered dithering, then scaled
// up with hard pixels. The controls are drawn, not functional: the song, clock and
// seek bar are the live parts.
const VIEW = { x: -24, y: -36, w: 1272, h: 456 };
const ART_PIXEL = 2; // one art pixel is at most this many CSS pixels
const MIN_ART_WIDTH = 250; // narrower than this and the text no longer fits the display
const RIGHT_OVERHANG = 1.06; // the canvas is wider than the column so bubbles can hang off
let W = 265;
let H = 95;
let K = W / VIEW.w;
const px = (u) => Math.round((u - VIEW.x) * K);
const py = (v) => Math.round((v - VIEW.y) * K);

// the display's inside, in art units: no dither here, so the text stays readable
const LCD = { x0: 380, y0: 50, x1: 1128, y1: 214 };

const KNOB = [
  "..NNNNN..",
  ".NWWWCCN.",
  "NWWCCCCBN",
  "NWCCCCCBN",
  "NCCCCCBBN",
  "NCCCCBBBN",
  "NCCBBBBBN",
  ".NBBBBBN.",
  "..NNNNN..",
];
const KNOB_COLORS = { N: "#003399", W: "#ffffff", C: "#33ccff", B: "#0066cc" };
const FILL_ROWS = ["#99ffff", "#33ccff", "#0099ff"];

const defs = `
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0060e0" /><stop offset=".45" stop-color="#16a8f8" /><stop offset=".75" stop-color="#a8ecff" /></linearGradient>
  <radialGradient id="wisp"><stop offset="0" stop-color="#fff" /><stop offset=".55" stop-color="#fff" stop-opacity=".75" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></radialGradient>
  <radialGradient id="sun"><stop offset="0" stop-color="#fff" /><stop offset=".22" stop-color="#fffbe0" stop-opacity=".85" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></radialGradient>
  <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6ff4f" /><stop offset=".32" stop-color="#7ee81e" /><stop offset="1" stop-color="#0d9a2c" /></linearGradient>
  <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6f53e" /><stop offset="1" stop-color="#2cc23a" /></linearGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85" /><stop offset="1" stop-color="#fff" stop-opacity=".1" /></linearGradient>
  <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" /><stop offset=".42" stop-color="#d3e2f8" /><stop offset=".55" stop-color="#a9c2ea" /><stop offset="1" stop-color="#eef5ff" /></linearGradient>
  <linearGradient id="lcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#003399" /><stop offset="1" stop-color="#003399" /></linearGradient>
  <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8ff5a" /><stop offset=".5" stop-color="#5fd62a" /><stop offset="1" stop-color="#0e8f3a" /></linearGradient>
  <radialGradient id="orb" cx=".5" cy=".85" r=".95"><stop offset="0" stop-color="#a8ffd8" /><stop offset=".3" stop-color="#2fd6e6" /><stop offset=".68" stop-color="#0a84e0" /><stop offset="1" stop-color="#034aa8" /></radialGradient>
  <radialGradient id="bub"><stop offset="0" stop-color="#bff4ff" stop-opacity=".05" /><stop offset=".68" stop-color="#7fe0ff" stop-opacity=".25" /><stop offset=".9" stop-color="#2a9dfa" stop-opacity=".85" /><stop offset="1" stop-color="#003399" /></radialGradient>
  <linearGradient id="close" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb4a0" /><stop offset=".5" stop-color="#d82a14" /><stop offset="1" stop-color="#f06a4a" /></linearGradient>
  <clipPath id="body"><rect x="8" y="8" width="1184" height="368" rx="184" /></clipPath>`;

const svg = (content) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}"><defs>${defs}</defs>${content}</svg>`;

const wisp = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#wisp)" />`;
const bubble = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#bub)" /><ellipse cx="${x - r * 0.34}" cy="${y - r * 0.38}" rx="${r * 0.3}" ry="${r * 0.22}" fill="#fff" />`;
const drop = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" /><circle cx="${x + r * 0.25}" cy="${y + r * 0.3}" r="${r * 0.5}" fill="#9dffd0" />`;

const art = () => svg(`
  <g clip-path="url(#body)">
    <rect width="1200" height="400" fill="url(#sky)" />
    <circle cx="1150" cy="30" r="260" fill="url(#sun)" />
    ${wisp(520, 254, 170, 30)}${wisp(800, 244, 210, 34)}${wisp(1080, 250, 170, 34)}
    <path d="M0 288C200 232 470 244 700 288S1060 306 1200 246V400H0Z" fill="url(#hill)" />
    <path d="M0 336C240 268 520 282 760 326S1080 358 1200 306V400H0Z" fill="url(#grass)" />
    <path d="M0 336C240 268 520 282 760 326S1080 358 1200 306" fill="none" stroke="#f8ffc0" stroke-width="7" />
    ${bubble(600, 252, 17)}${bubble(946, 256, 20)}
    <path d="M0 0H1200V128C900 188 400 188 0 128Z" fill="url(#gloss)" />
  </g>
  <rect x="8" y="8" width="1184" height="368" rx="184" fill="none" stroke="#003399" stroke-width="7" />
  <rect x="17" y="17" width="1166" height="350" rx="175" fill="none" stroke="#fff" stroke-width="7" />

  <rect x="362" y="34" width="784" height="196" rx="52" fill="url(#bezel)" stroke="#003399" stroke-width="6" />
  <rect x="380" y="50" width="748" height="164" rx="38" fill="url(#lcd)" stroke="#003399" stroke-width="6" />

  <rect x="1036" y="60" width="78" height="34" rx="7" fill="url(#close)" stroke="#fff" stroke-width="5" />

  <path d="M394 284h14l20-16v60l-20-16h-14z" fill="#fff" stroke="#003399" stroke-width="5" />
  <rect x="442" y="286" width="160" height="24" fill="#fff" stroke="#003399" stroke-width="5" />
  <rect x="448" y="292" width="110" height="12" fill="#0099ff" />
  <rect x="640" y="286" width="490" height="24" fill="#fff" stroke="#003399" stroke-width="5" />

  <circle cx="192" cy="192" r="176" fill="#fff" stroke="#003399" stroke-width="7" />
  <circle cx="192" cy="192" r="152" fill="url(#orb)" stroke="#003399" stroke-width="7" />
  <rect x="136" y="134" width="44" height="126" fill="#003399" opacity=".45" />
  <rect x="212" y="134" width="44" height="126" fill="#003399" opacity=".45" />
  <rect x="130" y="126" width="44" height="126" fill="#fff" />
  <rect x="206" y="126" width="44" height="126" fill="#fff" />
  <path d="M52 170C58 92 120 48 192 48s134 44 140 122c-40-30-86-44-140-44s-100 14-140 44z" fill="url(#gloss)" />

  <path d="M1056 16C1094-34 1178-30 1234-14 1222 50 1138 92 1056 16Z" fill="url(#leaf)" stroke="#006600" stroke-width="6" />
  <path d="M1056 16C1110 8 1170 2 1234-14" fill="none" stroke="#f0ffb0" stroke-width="6" />
  ${drop(1122, -8, 12)}${drop(1178, 22, 10)}
`);

// these three hang off the edges and bob a pixel at a time
const floaters = () => svg(`${bubble(1164, 322, 58)}${bubble(1218, 208, 24)}${bubble(366, 372, 28)}`);

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Hard edges, flattened over the page's white, snapped to the web-safe palette with Bayer dithering.
function crush(ctx) {
  let image;
  try {
    image = ctx.getImageData(0, 0, W, H);
  } catch {
    return; // browser won't let us read it back: stay low-res without the dither
  }
  const d = image.data;
  const lcd = { x0: px(LCD.x0) + 2, y0: py(LCD.y0) + 2, x1: px(LCD.x1) - 2, y1: py(LCD.y1) - 2 };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = d[i + 3] / 255;
      if (a < 0.38) {
        d[i + 3] = 0;
        continue;
      }
      const flatBand = x >= lcd.x0 && x <= lcd.x1 && y >= lcd.y0 && y <= lcd.y1;
      const threshold = flatBand ? 0 : (BAYER[y % 4][x % 4] + 0.5) / 16 - 0.5;
      for (let c = 0; c < 3; c++) {
        const flat = d[i + c] * a + 255 * (1 - a);
        d[i + c] = Math.max(0, Math.min(5, Math.round(flat / 51 + threshold * 0.85))) * 51;
      }
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function layer() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

function paintArt(markup) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = layer();
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      crush(ctx);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml,${encodeURIComponent(markup)}`;
  });
}

// One-bit text on its own fine grid: aliased like an old skin, but sharp enough to read.
// Tahoma is the period UI font, built to stay legible on a pixel grid.
const TEXT_FAMILY = 'Tahoma, Verdana, "Segoe UI", sans-serif';

function textStrip(text, weight, size) {
  const font = `${weight} ${size}px ${TEXT_FAMILY}`;
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = font;
  const width = Math.max(1, Math.ceil(measure.measureText(text).width) + 2);
  const height = Math.ceil(size * 1.5);
  const baseline = Math.round(size * 1.1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.fillText(text, 0, baseline);

  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 100 ? 255 : 0;
  ctx.putImageData(image, 0, 0);
  return { canvas, baseline };
}

const clock = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export function createPlayer(reduced) {
  const root = document.createElement("div");
  root.className = "wmp";
  root.hidden = true;
  const spoken = document.createElement("p");
  spoken.className = "sr-only";
  const screen = layer();
  screen.setAttribute("aria-hidden", "true");
  const words = document.createElement("canvas");
  words.className = "wmp__text";
  words.setAttribute("aria-hidden", "true");
  root.append(spoken, screen, words);
  const ctx = screen.getContext("2d");
  const wordsCtx = words.getContext("2d");
  let pixel = 2; // CSS pixels per art pixel
  let fine = 1; // device pixels per CSS pixel on the text layer
  let textScale = 1;

  let base = null;
  let bubbles = null;
  let music = null;
  let source = null;
  let song = null;
  let ticker = 0;
  let scroller = 0;
  let offset = 0;
  let pause = 0;
  let direction = 1;
  let bob = 0;

  let builtFor = 0;

  // Fits the column at an exact whole-number scale, so every art pixel is the same size.
  function fit() {
    const width = root.clientWidth;
    if (!width || width === builtFor) return;
    builtFor = width;
    const dpr = window.devicePixelRatio || 1;
    const target = Math.min(ART_PIXEL, (width * RIGHT_OVERHANG) / MIN_ART_WIDTH);
    pixel = Math.max(1, Math.round(target * dpr)) / dpr; // a whole number of device pixels
    fine = Math.max(1, Math.round(dpr));
    textScale = (width * RIGHT_OVERHANG) / 530;
    W = Math.round((width * RIGHT_OVERHANG) / pixel);
    H = Math.round((W * VIEW.h) / VIEW.w);
    K = W / VIEW.w;
    screen.width = W;
    screen.height = H;
    screen.style.width = `${W * pixel}px`;
    screen.style.height = `${H * pixel}px`;
    words.width = Math.round(W * pixel * fine);
    words.height = Math.round(H * pixel * fine);
    words.style.width = `${W * pixel}px`;
    words.style.height = `${H * pixel}px`;
    writeStrips();
    base = null;
    bubbles = null;
    const build = builtFor;
    Promise.all([paintArt(art()), paintArt(floaters())])
      .then(([a, b]) => {
        if (build !== builtFor) return;
        base = a;
        bubbles = b;
        draw();
      })
      .catch(() => {}); // the song is still in the screen-reader text
  }
  new ResizeObserver(fit).observe(root);

  const songWidth = () => Math.round((px(900) - px(408)) * pixel * fine);
  const sizes = () => ({
    source: Math.round(Math.max(13, 21 * textScale) * fine),
    song: Math.round(Math.max(16, 28 * textScale) * fine),
    time: Math.round(Math.max(15, 26 * textScale) * fine),
  });

  function writeStrips() {
    if (!music) return;
    source = textStrip(music.artist || music.source, 400, sizes().source);
    song = textStrip(music.song, 600, sizes().song);
  }


  function draw() {
    if (!base || !music) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);

    const { start, end } = music;
    const elapsed = start ? Date.now() - start : 0;
    const length = start && end ? end - start : 0;
    const progress = length > 0 ? Math.min(1, Math.max(0, elapsed / length)) : 0;
    const seek = { x: px(640), y: py(298), length: px(1130) - px(640) };
    const knobX = seek.x + Math.round(progress * (seek.length - KNOB[0].length));
    FILL_ROWS.forEach((color, row) => {
      ctx.fillStyle = color;
      ctx.fillRect(seek.x + 1, seek.y - 1 + row, Math.max(0, knobX - seek.x), 1);
    });
    KNOB.forEach((line, y) => {
      [...line].forEach((cell, x) => {
        if (cell === ".") return;
        ctx.fillStyle = KNOB_COLORS[cell];
        ctx.fillRect(knobX + x, seek.y - 4 + y, 1, 1);
      });
    });

    if (bubbles) ctx.drawImage(bubbles, 0, bob);

    const toFine = pixel * fine;
    const textX = Math.round(px(408) * toFine);
    wordsCtx.clearRect(0, 0, words.width, words.height);
    if (source) {
      const w = Math.min(source.canvas.width, Math.round((px(1020) - px(408)) * toFine));
      wordsCtx.drawImage(source.canvas, 0, 0, w, source.canvas.height, textX, Math.round(py(112) * toFine) - source.baseline, w, source.canvas.height);
    }
    if (song) {
      const w = Math.min(song.canvas.width, songWidth());
      wordsCtx.drawImage(song.canvas, offset, 0, w, song.canvas.height, textX, Math.round(py(192) * toFine) - song.baseline, w, song.canvas.height);
    }
    if (start) {
      const time = textStrip(clock(elapsed), 600, sizes().time);
      wordsCtx.drawImage(time.canvas, Math.round(px(1108) * toFine) - time.canvas.width, Math.round(py(192) * toFine) - time.baseline);
    }
  }

  // Long titles step across the display a pixel at a time, waiting at each end.
  function stepSong() {
    if (!music || !song || !root.offsetParent || reduced()) return;
    const max = song.canvas.width - songWidth();
    if (max <= 0) return;
    if (pause > 0) {
      pause -= 1;
      return;
    }
    offset += direction * 2 * fine;
    if (offset <= 0 || offset >= max) {
      offset = Math.max(0, Math.min(max, offset));
      direction = -direction;
      pause = 12;
    }
    draw();
  }

  function tick() {
    if (!music || !root.offsetParent) return; // on another page: catch up when it's visible
    fit();
    if (!reduced()) bob = bob ? 0 : 1;
    draw();
  }

  function show(next) {
    const changed = next?.song !== music?.song || next?.artist !== music?.artist;
    const wasHidden = root.hidden;
    music = next;
    root.hidden = !next;
    clearInterval(ticker);
    clearInterval(scroller);
    if (!next) return;

    if (changed) {
      offset = 0;
      direction = 1;
      pause = 12;
      writeStrips();
      spoken.textContent = `listening to ${next.song}${next.artist ? ` by ${next.artist}` : ""}`;
    }
    fit();
    draw();
    ticker = setInterval(tick, 1000);
    scroller = setInterval(stepSong, 110);
    if (wasHidden && root.offsetParent && !reduced()) gsap.from(root, { autoAlpha: 0, duration: 0.5, clearProps: "all" });
  }

  return { root, show };
}
