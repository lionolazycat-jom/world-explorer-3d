# Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **M1 · The Globe** | 3D Earth, rotate/zoom, borders, clickable countries, responsive layout, Lite fallback, search, saved/progress, settings, deep links | ✅ Built — awaiting real-device testing |
| M2 · Country Exploration | Overview (population/area with "as of" dates, languages, currency, geography, climate), history summaries, famous places with markers and detail pages, citations UI | Next |
| M3 · History & Timeline | Canvas timeline (EDTF dates, BCE support), 12 period bands, historical border overlays with uncertainty styling, compare-with-modern toggle, Roman expansion, Silk Road | Planned |
| M4 · Amazing Discoveries | Location-linked discovery cards, myth-vs-evidence component, nearby discoveries | Planned |
| M5 · Audio | Narrator with Web Speech provider (sentence chunking), all playback controls, short/long scripts, swappable providers | Planned |
| M6 · Learning | Quizzes (MCQ, true/false, locate-on-globe, order events), spaced repetition, journal, Daily Discovery, backup export/import | Planned |
| M7 · Polish | PWA/offline, vendored libraries, compressed textures, accessibility audit, performance passes | Planned |

## Seed content priority (M2–M4)

Japan, Egypt, Italy/Roman Empire, Malaysia and the Philippines come first, then the Silk Road countries (China, Uzbekistan, Iran, Türkiye), then Indonesia and Singapore.

## Known limitations of M1

- Libraries, map data and textures load from the jsDelivr CDN, so an internet connection is required. Vendoring these into `/vendor` is planned for M7.
- Capitals and regions come from a compiled list. An automated Wikidata cross-check is planned for M2.
- Land neighbours come from shared Natural Earth outlines, so maritime neighbours (e.g. Singapore–Malaysia) are not listed.
