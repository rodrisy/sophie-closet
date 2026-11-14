# Sophie's Closet — working notes

A browser dress-up toy. Sophie uploads photos of her clothes (or pastes a shop
link), they get cut out of their background automatically, and she tries outfits
on a stylised figure. Built for one person; not a product.

## Running it

It is one static file. Open `index.html` in a browser — no build, no server, no
dependencies. The passcode is `waterlady`.

For link import to work the page needs a real origin (`file://` is fine for
everything else):

```
python3 -m http.server 8000     # then open http://localhost:8000
```

## Tests

```
node test/cutout.test.mjs    # background removal + body wrap
node test/link.test.mjs      # product-image extraction
```

These are plain node scripts, no framework. `cutout.test.mjs` stubs a software
canvas so the page's real `quickCut` / `wrapToBody` can run headless; it pulls
the functions straight out of `index.html` by regex, so **renaming those
functions breaks the tests** — update the `grab()` calls if you do.

They have caught four real bugs so far. Run them after touching the cutout or
the extractor.

## Why one file

It is deliberately a single self-contained HTML file so it can be dropped on
GitHub Pages with zero build step. If it grows past comfortable, split
`cutout`, `model` and `closet` into modules and use `<script type="module">` —
still no bundler needed.

## How it works

**Paper-doll, not 3D.** Real virtual try-on (draping a flat product photo onto a
body) needs a diffusion model on a GPU server — out of scope. Instead garments
are flat cut-outs placed on a stylised SVG figure, with a geometric "wrap" that
squeezes each garment row toward the body silhouette at that height. It reads as
*on her* rather than *pasted over her*. It is geometry, not simulation.

**Anchors.** Each pose defines an anchor point per garment category. Items store
an *offset* from their anchor, not absolute coordinates — so a nudge survives
switching poses. This is the thing that makes the app not-annoying; don't
replace it with absolute positioning.

**Two cutout paths.**
- `quickCut()` — flood-fill from the image edges, then a second sweep for
  *enclosed* background (neck holes, armpit gaps, between trouser legs), capped
  at 18% of the image each so a white shirt isn't hollowed out. Instant, no
  download, ideal for retail product shots. Runs automatically on import, but
  only kept if it removed 4–93% of the image — outside that it either did
  nothing or ate the garment.
- `aiCut()` — `@imgly/background-removal`, a ~40MB ONNX segmentation model
  pulled from a CDN on first use. For photos of clothes on the floor. Optional;
  the app works fine without it ever loading.

**Auto-sizing** uses the *median* row width of the cut-out, not the bounding
box — one outstretched sleeve shouldn't set the scale.

**Link import** goes through public CORS proxies (`allorigins`, `corsproxy.io`)
because a static page can't fetch a shop directly. The chosen image is fetched
*through* the proxy too — linking it directly would taint the canvas and break
every cutout. Zara and other bot-protected sites often fail; that's expected and
handled with a toast.

## Tuning knobs

Everything that controls how clothes land is in the `CATS` table:

- `fit` — target on-body width after auto-sizing. Bump if a category lands
  consistently too small.
- `hug` — how much wider than the body the garment sits (outerwear 1.38, tops
  1.14). This is the main "does it look right" dial.
- `wrap` — whether the body wrap applies at all (off for shoes/accessories).
- `z` — paint order.

Body silhouettes live in `PROFILE` as `[y, halfWidth, centreX]` per pose.

## State

IndexedDB, key `state` in database `sophie-closet`. Whole state object, including
garment images as WebP data URLs (downscaled to 800px on import). Per-device —
her phone and her laptop are separate closets until a backend exists.

## Done since the first commit

- **Saved looks** — snapshots of pose + backdrop + per-item placement, with a
  real thumbnail rendered by the exporter at low res. Applying one tolerates
  items deleted since.
- **PNG export** — `exportStage(k)` redraws backdrop gradient, figure SVG and
  worn items on a canvas (everything is data-URL or inline SVG, so it never
  taints). Share sheet on phones, download elsewhere.
- **Shuffle**, **undo on delete** (toast with an action button), **backup /
  restore** to a JSON file — restore MERGES by item id, so it's idempotent and
  is the cross-device story until a backend exists.
- **Keyboard**: Esc closes sheets, Enter accepts the compact review, arrows
  nudge the edited item (shift = coarse).
- App icon (inline data URIs), iOS home-screen meta, wordmark, empty-state hint.

## Not done yet

- **Firebase sync** — one closet across her devices. Needs the Firebase console;
  Firestore + anonymous auth so the passcode box stays as-is but the data isn't
  world-readable. Backup/restore covers the gap meanwhile.
- **Her face** — cut-out PNGs pinned to the head anchor, cycling between a few.
  The `face` category already exists and is wired; just needs the images.
- **Deploy** — GitHub Pages. It's static, so it's push-and-done.

## Browser drive-through

`test/drive.mjs` runs the whole app in headless Chromium: passcode, both
imports, review → editor, looks, shuffle, export and backup downloads,
restore-merge, keyboard, persistence across reload, plus a phone-viewport pass.
It needs a server (`python3 -m http.server 8070`) and Playwright. It caught a
shipped bug the unit tests couldn't: a stale closure in `ingest()` had broken
file upload entirely. Run it before handing over a build.

## Things not to do

- The passcode is a `const` in the page source. That is intentional and known —
  it's a "don't wander in" sign for one friend, not security. Don't build an
  auth system around it unless the data moves to a backend.
- Don't swap the geometric wrap for a real try-on model without a server; it
  cannot run client-side.
- Don't re-render the DOM inside `pointerdown` — it detaches the node and kills
  `setPointerCapture`, which breaks dragging. (This was a real bug.)
