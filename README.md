# World Explorer 3D

An interactive 3D globe for exploring world history and geography in the browser. It needs no installation, no account and no paid API keys.

**Status: Milestone 1 (The Globe).** See [docs/ROADMAP.md](docs/ROADMAP.md) for what is built and what comes next.

## What works now

- A 3D Earth (NASA Blue Marble or night-lights imagery) with an atmosphere glow, gold country borders, smooth rotation and zoom, and slow auto-rotation when idle.
- Every country and territory is clickable, using Natural Earth outlines at 1:110m. 1:50m detail loads in the background, so small states such as Singapore, Vatican City and the island nations become tappable dots.
- Clicks are matched to countries with spherical point-in-polygon tests (d3-geo). This works across the antimeridian (Fiji), at the poles (Antarctica) and for enclaves (Vatican City inside Italy).
- Each country panel shows its flag, region, capital (with notes where the capital is split or disputed), ISO codes, political-status notes, clickable land neighbours and its sources.
- Search covers names, capitals, ISO codes and former or alternative names, e.g. *Burma*, *Ivory Coast* or *Turkey*.
- **Surprise** opens a random country you haven't visited yet.
- **Saved** shows your favourite countries, recently explored places and overall progress. All of it is stored on your device only.
- **Settings** cover display mode, quality, Day/Night imagery, auto-rotation, a lat/long grid and clearing saved data.
- Lite mode is a 2D canvas globe for devices without WebGL, slow devices, or when the 3D library can't load. If the 3D globe runs slowly, the app offers Lite mode.
- The layout adapts to the device: a side panel on desktop, and a draggable bottom sheet (peek / half / full) with bottom navigation on phones.
- Every country has a deep link, e.g. `#/country/MYS`. The browser back button works, and links can be copied or shared.
- Keyboard controls: arrows rotate, `+`/`-` zoom, `/` opens search, `Enter` opens the country in the centre of the view, `Esc` closes the panel.

## Run locally

ES modules don't load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy (GitHub Pages)

Go to Settings → Pages → *Deploy from a branch* → `main` / `(root)`. There is no build step.

## Architecture

The app uses plain JavaScript ES modules and an import map, with no build step.

```
index.html            app shell + import map
css/app.css           theme and responsive layout
js/app.js             bootstrap, routing, events
js/config.js          every external URL in one place
js/core/              event bus, device-tier detection
js/data/world.js      TopoJSON loading, joining, spherical picking, camera framing
js/globe/globe3d.js   globe.gl engine (3D)
js/globe/globe2d.js   d3-geo canvas engine (Lite)
js/ui/                panel/bottom sheet, view templates, toasts, starfield
js/storage/prefs.js   localStorage: settings, favourites, visited
data/countries.json   capitals, ISO codes, UN regions, status notes
```

Both globe engines expose the same interface (`flyTo`, `setSelected`, `zoomBy`, `resize`, …), so later features work in 3D and Lite mode alike.

## Data & accuracy

- Borders follow Natural Earth's **de facto** boundaries. Disputed territories carry a status note.
- `data/countries.json` records when it was compiled and its review status. Population, area, languages and currency arrive in Milestone 2 as dated snapshots from the World Bank and Wikidata.

See [ATTRIBUTION.md](ATTRIBUTION.md) for sources and licences.
