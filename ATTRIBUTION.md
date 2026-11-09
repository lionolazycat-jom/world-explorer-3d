# Sources & licences

| What | Source | Licence / terms |
|---|---|---|
| Country outlines (1:110m, 1:50m) | [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas) | Public domain (Natural Earth); ISC (world-atlas) |
| Earth day / night imagery, relief | NASA Blue Marble & Black Marble ([Visible Earth](https://visibleearth.nasa.gov/)), as packaged in [three-globe](https://github.com/vasturiano/three-globe) examples | NASA imagery is generally not subject to US copyright; credit: NASA |
| Flags | [flagcdn.com](https://flagcdn.com/) | Free service; national flags are generally public domain |
| Capitals, ISO 3166-1 codes, UN M49 regions | Compiled reference list (`data/countries.json`) | Facts; reviewed 9 Nov 2026 |
| 3D globe | [globe.gl](https://github.com/vasturiano/globe.gl) / three-globe by Vasco Asturiano | MIT |
| 3D engine | [three.js](https://threejs.org/) (bundled in globe.gl) | MIT |
| Geo maths, Lite globe | [d3-geo](https://github.com/d3/d3-geo) | ISC |
| TopoJSON decoding | [topojson-client](https://github.com/topojson/topojson-client) | ISC |
| Historical borders | [historical-basemaps](https://github.com/aourednik/historical-basemaps) by A. Ourednik et al., loaded at runtime via jsDelivr | GPL-3.0 |
| Population & land area | [World Bank Open Data](https://data.worldbank.org/) (SP.POP.TOTL, AG.LND.TOTL.K2) | CC BY 4.0 |
| History, places, routes | Original text written for this app; sources cited on every item (Britannica, UNESCO, national museums, peer-reviewed research) | — |
| Typefaces | Cormorant Garamond, Inter (Google Fonts) | SIL Open Font Licence |

## Licence plan for the project

Historical border data (`aourednik/historical-basemaps`, GPL-3.0) is loaded at runtime rather than copied into this repository. If it is ever bundled here, the repository should adopt GPL-3.0. CShapes 2.0 (colonial-era borders) is CC BY-NC-SA 4.0, which means non-commercial use only. Replace it before any commercial use.
