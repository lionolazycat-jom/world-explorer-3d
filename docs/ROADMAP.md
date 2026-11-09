# Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **M1 · The Globe** | 3D Earth, rotate/zoom, borders, clickable countries, responsive layout, Lite fallback, search, saved/progress, settings, deep links | ✅ Built |
| **M2 · Country Exploration** | Full profiles for Malaysia, Philippines, Japan, Egypt, Italy: overview with dated World Bank stats, sourced history timelines with confidence labels, 30 famous places with pins and pages, landmark search | ✅ Built — 5 countries |
| **M3 · History & Timeline** | Year slider (10,000 BCE → today), 12 period bands, historical border overlays (approximate, precision-styled), compare-with-modern toggle, events on the globe, Roman Empire step-by-step story, Silk Road / maritime spice route / Manila galleon routes | ✅ Built |
| M4 · Amazing Discoveries | Location-linked discovery cards, myth-vs-evidence component, nearby discoveries | Next |
| M5 · Audio | Narrator with Web Speech provider (sentence chunking), all playback controls, short/long scripts, swappable providers | Planned |
| M6 · Learning | Quizzes (MCQ, true/false, locate-on-globe, order events), spaced repetition, journal, Daily Discovery, backup export/import | Planned |
| M7 · Polish | PWA/offline, vendored libraries, compressed textures, accessibility audit, performance passes | Planned |

## Seed content priority (M2–M4)

Japan, Egypt, Italy/Roman Empire, Malaysia and the Philippines come first, then the Silk Road countries (China, Uzbekistan, Iran, Türkiye), then Indonesia and Singapore.

## Known limitations

- Libraries, map data and textures load from the jsDelivr CDN, so an internet connection is required. Vendoring these into `/vendor` is planned for M7.
- Capitals and regions come from a compiled list. An automated Wikidata cross-check is planned for M2.
- Land neighbours come from shared Natural Earth outlines, so maritime neighbours (e.g. Singapore–Malaysia) are not listed.
- Historical borders come from historical-basemaps, a community work in progress. Some labels are anachronistic (e.g. its 1400 map still labels a "Srivijaya Empire", which had declined by the 13th century). The app labels every shape as an approximate reconstruction.
- Border files are downloaded per period (several MB each) on demand; the first load of each period can take a few seconds on mobile data.
- Only five countries have full profiles; the rest show basic facts.
