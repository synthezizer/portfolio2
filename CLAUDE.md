# Andy — Portfolio

Personal portfolio site built with Vite + vanilla JS + GSAP. Two views: Projects (paged) and Contact. Ignore the unrelated `andydaw` folder entirely.

**Content is managed by Decap CMS.** Projects live in `content/projects/*.json` (sorted by `order`), the contact page in `content/contact.json`; `src/content.js` loads them at build time. Admin UI: `public/admin/` (`config.yml` defines the fields). Local editing: `npm run cms` + `npm run dev`, then open `/admin/`. Production login is not set up yet (`backend.repo` is a TODO).

## Design Context

### Users
Friends and people Andy knows personally: a personal space, not a job-hunting pitch. Visitors arrive casually, often from a shared link, to look through what Andy has been making and find a way to get in touch. There are two jobs on the site: **browse projects** one at a time (title, date, write-up, large visual, paged with ◀ n ▶) and **reach Andy** (contact page). Visitors aren't in a hurry, so the site can reward a little exploring, but it should never get in the way.

### Brand Personality
The source of truth is the two Figma frames (Projects, Contact), 1440 × 1024 on a 10px grid.

- **Three words:** graphic, playful, direct.
- **Voice:** casual and lowercase in content ("ways to reach me", "lorem ipusm"). Headings are big and blunt, and the copy sounds like a person, not a brand.
- **Feel:** Swiss-poster boldness (huge SemiBold type, stark black/white, hard black rules) with toy-like accent shapes (dotted circles, stacked stars) that feel like small stickers on a poster.
- **Emotional goal:** an immediate "oh, this is fun" that stays confident and clean, never cluttered or cute.

### Aesthetic Direction
**Light mode only**, matching the frames.

**Palette (use exactly these; add nothing):**
| Token | Hex | Role |
|---|---|---|
| `--ink` | #000000 | Text, top bar, frame rules, arrow, active nav shapes |
| `--paper` | #FFFFFF | Background, top-bar line/dot/name |
| `--mute` | #8E8E93 | Inactive nav label + its icon shapes |
| `--blue` | #0088FF | Image/placeholder blocks, inner dot of the 2nd circle when Projects is active |
| `--red` | #FF383C | Inner dot of the 1st circle when Projects is active |
| `--yellow` | #FFCC00 | Large star when Contact is active |
| `--orange` | #FF8D28 | Small star when Contact is active |

**Typography:** Atkinson Hyperlegible Next only. Letter-spacing −0.06em throughout.
- Display: SemiBold 96px, used for the nav labels (PROJECTS / CONTACT) and page headings.
- Body: Regular 40px, used for body copy, the "ANDY" wordmark and the page number.
- Meta: Regular Italic 32px, used for dates (e.g. *10/25/2026*).
- Sizes scale fluidly below 1440px with `clamp()` and keep these ratios. Body copy may relax tracking slightly (≈ −0.03em) and set line-height around 1.15 at small sizes so it stays readable, because the breakdown already flags the body as dense.

**Layout anatomy (shared by both pages):**
- **Top bar:** full-width black band about 90px tall. It holds a thin white horizontal line with a white dot and the "ANDY" wordmark at the right. The dot sits at the **left** end on Contact and the **right** end on Projects, so it works as a position indicator between the two pages.
- **Frame bracket:** a thick black rule (≈10px) running down the left edge and across the top of the content area. Its top rule ends at about x=700 on Projects (wrapping the project image) and about x=1230 on Contact (wrapping the whole nav).
- **Nav row:** `PROJECTS ●● → CONTACT ★`. The active label is black with a colored icon, and the inactive label is gray with a gray icon. The arrow is always black. Icons: Projects uses two black circles with offset inner dots (red, blue), shown gray/white when inactive. Contact uses a large and a small star (yellow, orange), shown gray when inactive.
- **Projects page:** a large blue media block fills the left column (x≈44–700, bottom-bleeding). The right column has the title (96px), the date (italic 32px), body copy (40px) and a ◀ n ▶ pager at the bottom right.
- **Contact page:** the heading "ways to reach me" and body on the left, a blue media block on the right.
- Every position snaps to the 10px grid.
- **Blue blocks are image slots** (project media and the contact media). Blue shows when there's no image, while one loads, or if it fails, and a loaded image fades in over it (`object-fit: cover`). Every real image needs alt text, and the media stays `aria-hidden` without one.

**Anti-references:** generic dev-portfolio templates (hero + card grid + skill bars), gradients, drop shadows, rounded "SaaS" cards, glassmorphism, extra accent colors, a dark mode, and decorative motion that has no connection to the layout.

**Motion (GSAP, expressive):**
- Switching pages is the signature moment. The top-bar dot slides along its line, the frame bracket's top rule extends or retracts, the nav labels cross-fade between black and gray, the icons swap color with a pop or rotation (circles roll, stars spin in), and the content columns wipe or stagger in.
- Project pager: the media block and text slide horizontally in the paging direction, and the number ticks over.
- Micro-interactions: the shapes react on hover (inner dots orbit, stars twinkle or rotate) and the arrow nudges toward the inactive page.
- Text reveals: headings come in line by line with a masked slide-up.
- Easing is snappy and graphic (e.g. `power3`/`expo` outs, short overshoot on shapes) and never floaty.

### Accessibility
- WCAG AA. Gray #8E8E93 on white is about 3.2:1, so it is only allowed for large display text (the inactive nav) and decorative shapes, never body copy.
- Honor `prefers-reduced-motion`: replace slides, spins and wipes with instant or opacity-only changes.
- The nav labels are real links/buttons, and the pager arrows are buttons with accessible names. Keep visible focus styles (a black or blue outline that sits on the grid).
- Decorative shapes are `aria-hidden`, and the active page is marked with `aria-current`.
- On mobile and tablet, recompose the layout and stack the columns. Never scale the 1440 frame down to an unreadable size.

### Design Principles
1. **The frames are the spec.** Exact palette, one type family, the 10px grid and the frame anatomy above. When something isn't specified, extend the existing system instead of inventing a new one.
2. **Type is the image.** 96px tightly tracked SemiBold carries the design, so let headings be huge and blunt and keep everything else quiet.
3. **Color means "you are here."** Warm and red accents appear only on the active page's icon. Blue is for media. Everything else is black, white or gray.
4. **Motion explains state.** Every animation shows where you are or where you're going (dot position, bracket length, label weight, pager direction). It is expressive in execution but always purposeful, and reduced-motion users get the same information without the movement.
5. **Personal, not corporate.** Lowercase, casual copy and toy-like shapes keep it warm. Bold doesn't mean shouty.
