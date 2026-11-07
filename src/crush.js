import { gsap } from "gsap";

// The site-wide bitcrush: fewer color levels, an ordered dither, and a lower "sample rate"
// (everything but the stamps, text included, snapped to a coarse grid). On a page switch the
// amount springs: it winds up into a hard crush while the curtain covers the swap, then
// bounces back to the resting level.
const REST_LEVELS = 10;
const PEAK_LEVELS = 3;
const MAX_LEVELS = 16; // a spring overshoot briefly cleans the color up
const PEAK_PIXEL = 9; // at rest it's the stylesheet's 2px filter
const REST_DITHER = 0.55;

const root = document.querySelector(".crushed");
const overlay = document.querySelector(".crush");
const channels = [...document.querySelectorAll(".crush-defs feFuncR, .crush-defs feFuncG, .crush-defs feFuncB")];
const flood = document.querySelector("#bitcrush-flood");
const cell = document.querySelector("#bitcrush-cell");
const dilate = document.querySelector("#bitcrush-dilate");

const table = (levels) => Array.from({ length: levels }, (_, i) => (i / (levels - 1)).toFixed(4)).join(" ");

let shownLevels = 0;
let shownPixel = 0;

function setLevels(levels) {
  if (levels === shownLevels) return;
  shownLevels = levels;
  const values = table(levels);
  for (const f of channels) f.setAttribute("tableValues", values);
}

// Odd sizes only: one sample per cell, grown by a whole radius, fills the cell exactly.
function setPixel(size) {
  if (size === shownPixel) return;
  shownPixel = size;
  if (!size) {
    root.style.removeProperty("filter");
    return;
  }
  const radius = (size - 1) / 2;
  flood.setAttribute("x", radius);
  flood.setAttribute("y", radius);
  cell.setAttribute("width", size);
  cell.setAttribute("height", size);
  dilate.setAttribute("radius", radius);
  root.style.filter = "url(#bitcrush-spring)";
}

const amount = { value: 0 };

function apply() {
  const c = amount.value;
  setLevels(gsap.utils.clamp(PEAK_LEVELS, MAX_LEVELS, Math.round(REST_LEVELS - c * (REST_LEVELS - PEAK_LEVELS))));
  const steps = (PEAK_PIXEL - 1) / 2; // 3, 5, 7, 9
  // abs: the spring's rebound past rest crunches too, so you can see it bounce
  const step = gsap.utils.clamp(0, steps, Math.round(Math.abs(c) * steps));
  setPixel(step ? 1 + 2 * step : 0);
  overlay.style.opacity = gsap.utils.clamp(0, 1, REST_DITHER + c * (1 - REST_DITHER));
}

// windUp matches the curtain's first half, so the peak lands while the page is covered
export function crunch(windUp) {
  gsap.killTweensOf(amount);
  gsap
    .timeline({ onUpdate: apply, onComplete: apply })
    .to(amount, { value: 1, duration: windUp, ease: "elastic.in(1, 0.55)" })
    .to(amount, { value: 0, duration: 1.15, ease: "elastic.out(1, 0.42)" });
}

apply();
