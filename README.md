# sophie's closet

A browser dress-up toy. Upload photos of your clothes — or paste a shop link —
and they get cut out of their background automatically so you can try outfits on
a figure, change poses, and swap backdrops.

Open `index.html`. That's it. No build, no install, no server.

## What it does

- **Automatic cutout.** Product shots get their background removed on import,
  including enclosed bits like neck holes. Messier photos can use an optional
  AI cutout that runs entirely in the browser.
- **Fits to the body.** Garments are auto-sized and wrapped to the figure's
  silhouette rather than sitting flat on top of it.
- **Link import.** Paste a product page URL, pick which photo to use.
- **Three poses, ten backdrops**, drag to adjust, saved between visits.
- **Saved looks** with thumbnails, a shuffle button, and PNG export straight to
  the share sheet.
- **Backup & restore** — carry the whole closet to another device as one file.

## Running locally

Opening the file directly works for everything except link import, which needs a
real origin:

```
python3 -m http.server 8000
```

## Tests

```
node test/cutout.test.mjs
node test/link.test.mjs
```

See `CLAUDE.md` for architecture notes and the tuning knobs.
