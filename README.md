# Matrix transformations practice

A small static website for Year 11 VCE Specialist Mathematics (Units 1 & 2) students to practise linear transformations of the plane with 2 × 2 matrices: dilations, reflections, shears and rotations of the unit square.

Sections unlock in order: opening each one unlocks the next.

1. **Explore** (`explore.html`): type a matrix, pick a preset or drag the arrows, and watch the unit square change.
2. **Name the transformation** (`name.html`): watch the square move, then choose the matching description from four options.
3. **Description → matrix** (`describe.html`): turn a description in VCE wording into a matrix.
4. **Match the target** (`match.html`): read a target parallelogram off the grid and enter its matrix.
5. **Advanced** (`advanced.html`): unlocks once all three practice sections have a crown. Its sets mix all three question styles and add rotations (90°, 180°, 270°, 30°, 45° and 60°) and dilations from the origin.

Practice comes in sets of 5 random questions, with no repeats inside a set. **Check** is free: it shows what the student's answer does without saying right or wrong. **Confirm** marks the answer once. A perfect set (5 out of 5) earns that section's crown, shown on the page and on the home card. The main sections leave out rotations and dilations from the origin.

**For teachers:** add `?unlock` to any address (e.g. `https://transformations.archival.zip/?unlock`) to open every section on that device. The home page has a **Reset my progress** link. If the browser blocks storage, every section is open.

The site uses plain HTML, CSS and JavaScript, with no build step and no framework. It has no logins and no analytics, and nothing a student types leaves the browser. Progress and crowns are kept in `localStorage` on the student's device.

## Run it locally

Open `public/index.html` in a browser. Everything works from `file://`, including offline (fonts then fall back to system fonts).

## Deploy to Cloudflare (free, Workers static assets)

The site is served as a Cloudflare Worker with static assets. `wrangler.jsonc` points it at the `public/` folder. There is no build step and no Worker code, and static-asset requests are free.

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Import a repository** (under the Workers tab), and pick this repository.
2. Use these settings:
   - **Project name:** `linear-transformations` (must match `name` in `wrangler.jsonc`, or edit that file)
   - **Build command:** *(leave empty)*
   - **Deploy command:** `npx wrangler deploy` (the default)
   - **Production branch:** the branch you want live
3. Click **Deploy**. The site appears at **https://transformations.archival.zip** (set under `routes` in `wrangler.jsonc`; the `archival.zip` zone must be on the same Cloudflare account) and also at `https://linear-transformations.<your-subdomain>.workers.dev`. Every push to the production branch redeploys it.

To deploy from your own computer instead: `npx wrangler login`, then `npx wrangler deploy`.

`public/_headers` adds a Content-Security-Policy and other security headers. `public/404.html` is served for unknown paths. Pages are served at clean URLs (`/match.html` redirects to `/match`).

The `public/` folder also works on any other static host (GitHub Pages, Netlify, …). To embed it in Google Sites, use **Insert → Embed → By URL** with the deployed address.

## Tests

```
node tests/run.js
```

The tests check the expression parser, that every library matrix round-trips through the classifier, the pools, no repeats within a set, the Mode 1 distractors, the Mode 2 targets and marking (including swapped columns), Mode 3 answer forms, and that no student-facing file mentions determinants, inverses or eigenvalues.

## Files

```
wrangler.jsonc      Cloudflare config: serve ./public as static assets
public/
  index.html          home: section cards, locks and crowns
  explore.html        the unit-square widget
  name.html, describe.html, match.html, advanced.html   practice sections
  css/style.css
  js/matrix.js        maths helpers, formatting, safe parser
  js/library.js       transformation library and question generators
  js/classify.js      matrix → VCE description, marking helpers
  js/render.js        canvas renderer, animation, zoom
  js/ui.js            progress and locks, matrix input, feedback
  js/practice.js      sets of 5, Check/Confirm, crowns, the three question styles
  js/home.js, js/modes/explore.js
tests/run.js        Node test runner (outside public/, so it is not deployed)
```

The scripts are classic `<script>` files sharing one global `UT` object rather than ES modules, because browsers block modules on `file://`.
