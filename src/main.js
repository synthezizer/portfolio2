import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { projects as rawProjects, contact } from "./content.js";

gsap.registerPlugin(Flip, SplitText, ScrollToPlugin);

// This module wires global listeners; hot-swapping it in dev would run two
// copies side by side (double magnets, double pupils). Always full-reload.
if (import.meta.hot) import.meta.hot.decline();

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const compact = window.matchMedia("(max-width: 820px), (max-aspect-ratio: 4/5)");
const reduced = () => motionQuery.matches; // read live, the OS setting can change mid-visit
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const body = document.body;
const stage = $(".stage");
const nav = $(".nav");
const dot = $(".topbar__dot");
const bracketTop = $(".bracket__top");
const bracketSide = $(".bracket__side");
const curtain = $(".curtain");
const views = { projects: $(".view--projects"), contact: $(".view--contact") };
const links = $$(".nav__link");
const arrow = $(".nav__arrow");
const circles = $$(".circle");
const circleInners = $$(".circle__inner");
const circleOuters = $$(".circle__outer");
const stars = $$(".star");
const status = $("#status");

const els = {
  title: $(".project__title"),
  date: $(".project__date"),
  body: $(".project__body"),
  digit: $(".pager__digit"),
  pager: $(".pager"),
  projectMedia: $(".media--project"),
  projectFill: $(".media--project .media__fill"),
  contactBody: $(".contact__body"),
  contactIntro: $(".contact__intro"),
  contactList: $(".contact__list"),
};

/* ---------- motion language ---------- */

// One curve for every big move so the page travels as a single gesture.
const GLIDE = "power3.inOut";
// power4 rather than expo: expo's first frames are so fast that text seems to
// jump before it glides.
const SETTLE = "power4.out";
// Text stays on 2D transforms. 3D promotes it to a GPU layer, which on Windows
// swaps ClearType for grayscale smoothing; the text then visibly "ticks" sharper
// the instant the animation ends.
const TEXT = { force3D: false };
const PAGE_SWITCH = 1.05;

// How far (as % of own height) text travels to hide behind its mask.
// Masks clip ~0.2em past the glyph box (see --mask in CSS), so 110 would peek.
const REVEAL = 135;

// projects: top rule ends at x=700; contact: runs to x=1230
const BRACKET = { projects: 676 / 1206, contact: 1 };
// the arrow always points at the page you're not on
const ARROW = { projects: 0, contact: 180 };

// GSAP owns SVG transforms; spin each shape around its own center
gsap.set([...circles, ...circleInners, ...stars, arrow], { transformOrigin: "50% 50%" });

/* ---------- data ---------- */

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");

// Tolerate missing or malformed entries so one bad project can't break the page.
const projects = (Array.isArray(rawProjects) ? rawProjects : [])
  .filter((p) => p && typeof p === "object")
  .map((p) => ({
    title: str(p.title) || "untitled",
    date: str(p.date),
    body: str(p.body),
    image: str(p.image),
    alt: str(p.alt),
    credit: str(p.credit),
    creditUrl: str(p.credit_url),
  }));

let view = viewFromHash() ?? "projects";
let index = 0;
let busy = false;

/* ---------- helpers ---------- */

function viewFromHash() {
  const h = location.hash.slice(1);
  return Object.hasOwn(views, h) ? h : null;
}

function dotX(v) {
  return v === "projects" ? dot.parentElement.offsetWidth - dot.offsetWidth : 0;
}

function announce(msg) {
  status.textContent = "";
  // a fresh text node makes repeated identical messages announce again
  requestAnimationFrame(() => (status.textContent = msg));
}

function setCurrent(v) {
  links.forEach((a) => (a.dataset.view === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
}

// One live line-split per element. Starting a new one finishes the old first,
// so rapid input can never nest masks or revert text out from under a tween.
const liveSplits = new Map();

function splitLines(targets, { from = false, ...vars }) {
  const list = [].concat(targets).filter((el) => !el.hidden && el.textContent.trim());
  list.forEach((el) => liveSplits.get(el)?.progress(1));
  if (!list.length) return gsap.timeline();

  const split = SplitText.create(list, { type: "lines", mask: "lines", linesClass: "line" });
  const tween = gsap[from ? "from" : "to"](split.lines, {
    ...TEXT,
    ...vars,
    onComplete: () => {
      split.revert();
      list.forEach((el) => liveSplits.get(el) === tween && liveSplits.delete(el));
    },
  });
  list.forEach((el) => liveSplits.set(el, tween));
  return tween;
}

const revealLines = (targets, { stagger = 0.05, duration = 0.9 } = {}) =>
  splitLines(targets, { from: true, yPercent: REVEAL, duration, ease: SETTLE, stagger });

const hideLines = (targets) =>
  splitLines(targets, { yPercent: -REVEAL, duration: 0.4, ease: "power3.in", stagger: 0.015 });

/* ---------- scroll: only when the text truly doesn't fit ---------- */

const scrollers = [els.body, els.contactBody].map((el) => {
  const ind = document.createElement("div");
  ind.className = "scroll-ind";
  ind.setAttribute("aria-hidden", "true");
  ind.innerHTML = '<span class="scroll-ind__line"></span><span class="scroll-ind__dot"></span>';
  ind.hidden = true;
  el.after(ind);
  const knob = ind.lastElementChild;
  const moveKnob = gsap.quickTo(knob, "y", { duration: 0.35, ease: "power3.out" });

  const sync = (instant) => {
    const max = el.scrollHeight - el.clientHeight;
    const travel = ind.clientHeight - knob.offsetHeight;
    const y = max > 0 ? (el.scrollTop / max) * travel : 0;
    instant ? gsap.set(knob, { y }) : moveKnob(y);
  };
  el.addEventListener("scroll", () => sync(false), { passive: true });

  // Wheel glides with momentum instead of stepping (keyboard/touch stay native).
  let target = 0;
  el.addEventListener(
    "wheel",
    (e) => {
      if (!el.classList.contains("is-scrollable") || reduced()) return;
      e.preventDefault();
      const max = el.scrollHeight - el.clientHeight;
      if (!gsap.isTweening(el)) target = el.scrollTop;
      const step = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      target = gsap.utils.clamp(0, max, target + step);
      gsap.to(el, { scrollTo: { y: target, autoKill: false }, duration: 0.9, ease: SETTLE, overwrite: true });
    },
    { passive: false }
  );

  return { el, ind, sync };
});

// Measure at rest only: mid-animation transforms inflate scrollHeight.
function measureScroll() {
  for (const { el, ind, sync } of scrollers) {
    el.classList.remove("is-scrollable");
    const visible = el.offsetParent !== null;
    const overflows = visible && !compact.matches && el.scrollHeight - el.clientHeight > 2;
    el.classList.toggle("is-scrollable", overflows);
    ind.hidden = !overflows;
    if (overflows) {
      gsap.set(ind, { top: el.offsetTop, height: el.clientHeight });
      sync(true);
    }
  }
}

/* ---------- rendering ---------- */

// The blue blocks are image slots. Blue is what shows with no image, while one
// loads, or if it fails; a loaded image fades in over it.
function renderMedia(media, item) {
  const fill = media.querySelector(".media__fill");
  fill.replaceChildren();
  // a bare blue block is decorative; once it holds an image it's real content
  media.setAttribute("aria-hidden", "true");
  if (!item?.image) return;
  media.removeAttribute("aria-hidden");

  const img = new Image();
  img.className = "media__img";
  img.alt = item.alt;
  img.decoding = "async";
  img.addEventListener(
    "load",
    () => (reduced() ? gsap.set(img, { opacity: 1 }) : gsap.to(img, { opacity: 1, duration: 0.7, ease: SETTLE })),
    { once: true }
  );
  img.addEventListener(
    "error",
    () => {
      img.remove(); // fall back to the plain blue block
      credit?.remove();
      media.setAttribute("aria-hidden", "true");
    },
    { once: true }
  );
  gsap.set(img, { opacity: 0 });
  img.src = item.image;
  if (img.complete && img.naturalWidth) gsap.set(img, { opacity: 1 }); // cached: no fade needed
  fill.append(img);

  // licensed photos need attribution: a small tag in the corner
  let credit = null;
  if (item.credit) {
    credit = document.createElement(item.creditUrl ? "a" : "span");
    credit.className = "media__credit";
    credit.textContent = item.credit;
    if (item.creditUrl) {
      credit.href = item.creditUrl;
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
    }
    fill.append(credit);
  }
}

// Warm the cache for the neighbours so paging lands on a ready image.
function preloadAround() {
  if (projects.length < 2) return;
  for (const step of [-1, 1]) {
    const p = projects[(index + step + projects.length) % projects.length];
    if (p.image) new Image().src = p.image;
  }
}

function renderProject() {
  const p = projects[index];

  if (!p) {
    els.title.textContent = "nothing here yet";
    els.date.hidden = true;
    els.body.textContent = "projects are on the way. check back soon.";
    els.pager.hidden = true;
    renderMedia(els.projectMedia, null);
    return;
  }

  els.title.textContent = p.title;
  // titles past ~2 words at 96px crowd the column; step down to 72px
  els.title.classList.toggle("is-long", p.title.length > 20);

  const m = p.date.match(DATE_RE);
  els.date.hidden = !p.date;
  els.date.textContent = p.date;
  if (m) els.date.dateTime = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  else els.date.removeAttribute("datetime");

  els.body.classList.remove("is-scrollable");
  els.body.textContent = p.body;
  els.body.hidden = !p.body;
  els.body.scrollTop = 0;
  els.digit.textContent = index + 1;
  els.pager.hidden = projects.length < 2;
  renderMedia(els.projectMedia, p);
  preloadAround();
}

function renderContact() {
  renderMedia($(".media--contact"), {
    image: str(contact?.image),
    alt: str(contact?.alt),
    credit: str(contact?.credit),
    creditUrl: str(contact?.credit_url),
  });
  els.contactIntro.textContent = str(contact?.intro);
  els.contactIntro.hidden = !els.contactIntro.textContent;

  const channels = (Array.isArray(contact?.channels) ? contact.channels : []).filter((c) => c && str(c.value));
  const items = channels.map((c) => {
    const label = str(c.label);
    const value = str(c.value);
    const href = str(c.href);

    const li = document.createElement("li");
    li.className = "contact__item";
    const rule = document.createElement("span");
    rule.className = "contact__rule";
    rule.setAttribute("aria-hidden", "true");
    const row = document.createElement("div");
    row.className = "contact__row";

    const name = document.createElement("span");
    name.className = "contact__label";
    name.textContent = label;

    const val = document.createElement(href ? "a" : "span");
    val.className = "contact__value";
    val.append(value);
    if (href) {
      val.href = href;
      const arrowGlyph = document.createElement("span");
      arrowGlyph.className = "contact__arrow";
      arrowGlyph.setAttribute("aria-hidden", "true");
      arrowGlyph.textContent = "↗";
      val.append(arrowGlyph);
      if (/^https?:/i.test(href)) {
        val.target = "_blank";
        val.rel = "noopener noreferrer";
        const note = document.createElement("span");
        note.className = "sr-only";
        note.textContent = " (opens in a new tab)";
        val.append(note);
      }
    }
    row.append(name, val);

    if (c.copy) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "contact__copy";
      btn.dataset.value = value;
      btn.setAttribute("aria-label", `copy ${label || value}`);
      btn.innerHTML = '<span class="contact__copy-mask"><span class="contact__copy-label">copy</span></span>';
      row.append(btn);
    }

    li.append(rule, row);
    return li;
  });
  els.contactList.replaceChildren(...items);
}

// "copy" rolls over to "copied" (or "oops"), then back.
async function copyValue(btn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = "1";
  const text = btn.dataset.value;
  const label = btn.querySelector(".contact__copy-label");

  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    // Clipboard API blocked (plain http, older browsers): fall back to a hidden textarea.
    const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.append(ta);
    ta.select();
    try {
      ok = document.execCommand("copy");
    } catch {
      // still blocked: the value is on screen to select by hand
    }
    ta.remove();
    btn.focus();
  }
  announce(ok ? `copied ${text}` : `couldn't copy. ${text}`);

  const swap = (word) =>
    reduced()
      ? gsap.timeline().call(() => (label.textContent = word))
      : gsap
          .timeline()
          .to(label, { ...TEXT, yPercent: -REVEAL, duration: 0.25, ease: "power3.in" })
          .call(() => (label.textContent = word))
          .fromTo(label, { yPercent: REVEAL }, { ...TEXT, yPercent: 0, duration: 0.5, ease: SETTLE });

  gsap
    .timeline({ onComplete: () => delete btn.dataset.busy })
    .add(swap(ok ? "copied" : "oops"))
    .add(swap("copy"), "+=1.6");
}

// Rules draw across, then each row rises out of its own mask.
// Masks are on only while animating so focus outlines aren't clipped at rest.
function rowsIn(rows) {
  const tl = gsap.timeline();
  if (!rows.length) return tl;
  rows.forEach((li) => li.classList.add("is-masked"));
  tl.from(rows.map((li) => li.querySelector(".contact__rule")), { scaleX: 0, duration: 0.9, ease: GLIDE, stagger: 0.07 }, 0)
    .from(rows.map((li) => li.querySelector(".contact__row")), { ...TEXT, yPercent: REVEAL, duration: 0.9, ease: SETTLE, stagger: 0.07 }, 0.12)
    .call(() => rows.forEach((li) => li.classList.remove("is-masked")));
  return tl;
}

function setStatic(v) {
  body.dataset.view = v;
  for (const [name, el] of Object.entries(views)) el.hidden = name !== v;
  setCurrent(v);
  gsap.set(dot, { x: dotX(v) });
  gsap.set(bracketTop, { scaleX: BRACKET[v] });
  gsap.set(arrow, { rotation: ARROW[v] });
}

function viewContent(v) {
  return v === "projects"
    ? { text: [els.title, els.date, els.body], media: els.projectMedia, extra: els.pager.hidden ? [] : [els.pager], rows: [] }
    : { text: [$(".contact__title"), els.contactIntro], media: $(".media--contact"), extra: [], rows: $$(".contact__item") };
}

// After any transition: re-measure, and make sure the page matches the URL
// (it may have changed mid-animation).
function settle() {
  busy = false;
  gsap.set(dot, { x: dotX(view) });
  measureScroll();
  const wanted = viewFromHash() ?? "projects";
  if (wanted !== view) go(wanted);
}

/* ---------- intro ---------- */

function intro() {
  setStatic(view);
  document.documentElement.classList.remove("is-loading");

  if (reduced()) {
    gsap.from(".stage", { opacity: 0, duration: 0.4, onComplete: settle });
    return;
  }

  busy = true;
  const content = viewContent(view);
  const tl = gsap.timeline({ defaults: { ease: SETTLE }, onComplete: settle });

  // Whole words rise (no per-letter split: splitting kills kerning and the
  // letters visibly jump back together when the split is undone).
  tl.from(".topbar__line", { scaleX: 0, duration: 1.2, ease: GLIDE })
    .from(dot, { scale: 0, duration: 0.6, ease: "back.out(2.5)" }, 0.75)
    .from(".topbar__word", { ...TEXT, yPercent: REVEAL, duration: 1 }, 0.55)
    .from(bracketSide, { scaleY: 0, duration: 1.1, ease: GLIDE }, 0.15)
    .from(bracketTop, { scaleX: 0, duration: 1.1, ease: GLIDE }, 0.3)
    .from(".nav__word", { ...TEXT, yPercent: REVEAL, duration: 1.1, stagger: 0.12 }, 0.5)
    .from(circles, { scale: 0, rotation: -200, duration: 1.1, stagger: 0.08, ease: "back.out(1.4)" }, 0.75)
    .from(arrow, { scale: 0, rotation: `-=180`, duration: 1, ease: SETTLE }, 0.85)
    .from(stars, { scale: 0, rotation: -144, duration: 1.1, stagger: 0.1, ease: "back.out(1.8)" }, 0.95)
    .from(content.media, { clipPath: "inset(100% 0 0 0)", duration: 1.2, ease: GLIDE, clearProps: "clipPath" }, 0.5)
    .add(revealLines(content.text), 0.95)
    .add(rowsIn(content.rows), 1.1)
    .from(content.extra, { autoAlpha: 0, y: 20, duration: 0.8, clearProps: "all" }, 1.3);
}

/* ---------- view switch: one gesture ---------- */
// The blue block is a shared element (data-flip-id="hero") that flies from its
// slot on one page to its slot on the other, above a black curtain that sweeps
// across and hides the text swap. Dot, bracket and arrow ride the same curve.

function placeCurtain() {
  const s = stage.getBoundingClientRect();
  const top = nav.getBoundingClientRect().bottom - s.top + 8;
  const left = bracketSide.getBoundingClientRect().right - s.left;
  gsap.set(curtain, { top, left, right: 0, bottom: 0, width: "auto", height: "auto" });
}

function go(next) {
  if (next === view || busy) return; // settle() picks up anything requested while busy
  const prev = view;
  view = next;
  setCurrent(next);
  announce(next === "projects" ? "projects" : "contact");

  if (reduced()) {
    busy = true;
    gsap.to(views[prev], {
      opacity: 0,
      duration: 0.15,
      onComplete: () => {
        gsap.set(views[prev], { clearProps: "opacity" });
        setStatic(next);
        gsap.fromTo(views[next], { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: "opacity", onComplete: settle });
      },
    });
    return;
  }

  busy = true;
  const out = viewContent(prev);
  const into = viewContent(next);
  const dir = next === "contact" ? 1 : -1;
  const D = PAGE_SWITCH;
  const HALF = 0.42;

  // Snapshot what's changing before the DOM moves.
  const heroState = Flip.getState(out.media);
  const colorTargets = [...links, ...circleOuters, ...circleInners, ...stars];
  const before = colorTargets.map((el) => getComputedStyle(el)[el instanceof SVGElement ? "fill" : "color"]);
  placeCurtain();

  // Both pages exist for the first half; new text waits behind its masks.
  body.dataset.view = next;
  views[next].hidden = false;
  gsap.set(out.media, { visibility: "hidden" });
  gsap.set(into.extra, { autoAlpha: 0 });
  measureScroll(); // before splitting: offset lines would inflate the measurement
  const reveal = revealLines(into.text, { stagger: 0.045 }).pause();
  const rows = rowsIn(into.rows).pause();

  const tl = gsap.timeline({
    defaults: { ease: GLIDE },
    onComplete: () => {
      gsap.set([out.media, curtain], { clearProps: "visibility,display,transform" });
      settle();
    },
  });

  // the hero block flies over the curtain
  tl.add(
    Flip.from(heroState, {
      targets: into.media,
      duration: D,
      ease: GLIDE,
      absolute: !compact.matches,
      scale: compact.matches, // in flow on phones: transform-only so nothing reflows
      zIndex: 5,
    }),
    0
  );

  // curtain: leading edge accelerates across, trailing edge decelerates away
  tl.set(curtain, { display: "block", scaleX: 0, transformOrigin: dir > 0 ? "0% 50%" : "100% 50%" }, 0)
    .to(curtain, { scaleX: 1, duration: HALF, ease: "power3.in" }, 0)
    .add(() => (views[prev].hidden = true), HALF) // swap happens fully covered
    .set(curtain, { transformOrigin: dir > 0 ? "100% 50%" : "0% 50%" }, HALF)
    .to(curtain, { scaleX: 0, duration: D - HALF, ease: "power3.out" }, HALF);

  // chrome rides the same curve
  tl.to(dot, { x: () => dotX(next), duration: D }, 0)
    .to(bracketTop, { scaleX: BRACKET[next], duration: D }, 0)
    .to(arrow, { rotation: ARROW[next], duration: D }, 0);

  // colors cross-fade from the captured values to the CSS truth
  colorTargets.forEach((el, i) => {
    const prop = el instanceof SVGElement ? "fill" : "color";
    tl.from(el, { [prop]: before[i], duration: 0.5, ease: "power2.out", clearProps: prop }, 0);
  });

  // one small flourish on the icon you've arrived at
  if (next === "projects") {
    tl.fromTo(circles, { rotation: -360 }, { rotation: 0, duration: D, stagger: 0.06 }, 0);
  } else {
    tl.fromTo(stars, { rotation: -144, scale: 0.6 }, { rotation: 0, scale: 1, duration: D, stagger: 0.06 }, 0);
  }

  // new text rises as the curtain clears
  tl.add(reveal.play(), HALF + 0.05)
    .add(rows.play(), HALF + 0.15).to(into.extra, { autoAlpha: 1, duration: 0.5, ease: SETTLE, clearProps: "all" }, HALF + 0.3);
}

/* ---------- project pager ---------- */

function page(step) {
  if (busy || view !== "projects" || projects.length < 2) return;
  const nextIndex = (index + step + projects.length) % projects.length;
  const announceIt = () => announce(`project ${index + 1} of ${projects.length}: ${projects[index].title}`);

  if (reduced()) {
    index = nextIndex;
    renderProject();
    announceIt();
    measureScroll();
    return;
  }

  busy = true;
  const text = [els.title, els.date, els.body];
  const tl = gsap.timeline({ onComplete: settle });

  // out: text lifts away, block slides off in the paging direction, number rolls
  tl.add(hideLines(text), 0)
    .to(els.projectFill, { xPercent: -101 * step, duration: 0.55, ease: "power4.in" }, 0)
    .to(els.digit, { ...TEXT, yPercent: -REVEAL * step, duration: 0.4, ease: "power3.in" }, 0)
    // in: overlaps the tail of the exit so there's no dead beat
    .add(() => {
      // finish (and un-split) the exit first, or its revert would restore the old text
      text.forEach((el) => liveSplits.get(el)?.progress(1));
      index = nextIndex;
      renderProject();
      announceIt();
      tl.add(revealLines(text, { stagger: 0.04 }), tl.time());
    }, 0.45)
    .fromTo(els.projectFill, { xPercent: 101 * step }, { xPercent: 0, duration: 0.9, ease: SETTLE }, 0.5)
    .fromTo(els.digit, { yPercent: REVEAL * step }, { ...TEXT, yPercent: 0, duration: 0.7, ease: SETTLE }, 0.45);
}

/* ---------- pointer life: pupils + magnets ---------- */

function pupils() {
  // inner dots rest offset from center (red looks right, blue looks down);
  // they swing to look at the cursor, staying inside their circle
  const svg = $(".icon--circles");
  const eyes = [
    { el: $(".circle__inner--red"), cx: 45, rest: { x: 21, y: 0 } },
    { el: $(".circle__inner--blue"), cx: 145, rest: { x: 0, y: 21 } },
  ].map((e) => ({
    ...e,
    qx: gsap.quickTo(e.el, "x", { duration: 0.6, ease: "power3.out" }),
    qy: gsap.quickTo(e.el, "y", { duration: 0.6, ease: "power3.out" }),
  }));
  const REACH = 21;

  window.addEventListener("pointermove", (e) => {
    if (reduced()) return;
    const r = svg.getBoundingClientRect();
    const unit = r.width / 190; // px per svg unit
    for (const eye of eyes) {
      const dx = (e.clientX - (r.left + eye.cx * unit)) / unit;
      const dy = (e.clientY - (r.top + 45 * unit)) / unit;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(REACH, dist / 3);
      eye.qx((dx / dist) * reach - eye.rest.x);
      eye.qy((dy / dist) * reach - eye.rest.y);
    }
  });
  document.documentElement.addEventListener("pointerleave", () => eyes.forEach((e) => (e.qx(0), e.qy(0))));
}

// Gentle pull toward the cursor. Kept small and wobble-free on purpose: big
// type swimming around (or springing back elastically) reads as seasick.
function magnet(el, { strength, reach, max, vertical = true }) {
  const qx = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
  const qy = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
  const clamp = gsap.utils.clamp(-max, max);

  window.addEventListener("pointermove", (e) => {
    if (reduced()) return;
    const r = el.getBoundingClientRect();
    // measure from the untranslated center so the pull doesn't feed back on itself
    const cx = r.left + r.width / 2 - gsap.getProperty(el, "x");
    const cy = r.top + r.height / 2 - gsap.getProperty(el, "y");
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const near = Math.abs(dx) < r.width / 2 + reach && Math.abs(dy) < r.height / 2 + reach;
    qx(near ? clamp(dx * strength) : 0);
    qy(near && vertical ? clamp(dy * strength) : 0);
  });
  document.documentElement.addEventListener("pointerleave", () => (qx(0), qy(0)));
}

function hovers() {
  if (finePointer.matches) {
    pupils();
    // only the labels lean; arrows stay put
    links.forEach((a) => magnet(a, { strength: 0.03, reach: 24, max: 4, vertical: false }));
  }

  $(".nav__link--contact").addEventListener("pointerenter", () => {
    if (busy || reduced()) return;
    gsap.to(stars, { rotation: nextTurn(144), duration: 1, stagger: 0.08, ease: SETTLE, overwrite: "auto" });
  });
}

// Spin forward by `step`, landing on a resting angle even if a previous spin was interrupted.
// 72-multiples keep five-point stars looking upright.
function nextTurn(step) {
  return (i, el) => Math.round((gsap.getProperty(el, "rotation") + step) / 72) * 72;
}

/* ---------- wiring ---------- */

renderProject();
renderContact();

els.contactList.addEventListener("click", (e) => {
  const btn = e.target instanceof Element && e.target.closest(".contact__copy");
  if (btn) copyValue(btn);
});

window.addEventListener("hashchange", () => go(viewFromHash() ?? "projects"));

$(".pager__btn--prev").addEventListener("click", () => page(-1));
$(".pager__btn--next").addEventListener("click", () => page(1));

window.addEventListener("keydown", (e) => {
  // leave browser shortcuts (alt+← is "back") and form fields alone
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return;
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (e.key === "ArrowRight") page(1);
  if (e.key === "ArrowLeft") page(-1);
});

let resizeFrame = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (busy) return;
    gsap.set(dot, { x: dotX(view) });
    measureScroll();
  });
});

hovers();

// Don't hold the intro hostage to a slow or blocked font request.
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(intro);
