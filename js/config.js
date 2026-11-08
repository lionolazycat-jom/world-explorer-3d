// Central configuration. Every external URL lives here so it can later be
// swapped for a vendored local copy (/vendor) without touching other modules.

export const APP = {
  name: 'World Explorer 3D',
  version: '0.1.0-m1',
  storagePrefix: 'we3d.',
  dataReviewed: '9 Nov 2026'
};

const JSD = 'https://cdn.jsdelivr.net/npm';

export const CDN = {
  // globe.gl UMD build bundles its own copy of three.js (MIT).
  globe: `${JSD}/globe.gl@2`,
  // Natural Earth admin-0 countries as TopoJSON (public domain), via world-atlas (ISC).
  world110: `${JSD}/world-atlas@2/countries-110m.json`,
  world50: `${JSD}/world-atlas@2/countries-50m.json`,
  // NASA Blue Marble / Black Marble derived textures shipped with three-globe examples.
  textures: {
    day: `${JSD}/three-globe@2/example/img/earth-blue-marble.jpg`,
    night: `${JSD}/three-globe@2/example/img/earth-night.jpg`,
    bump: `${JSD}/three-globe@2/example/img/earth-topology.png`
  },
  flag: (a2, w = 160) => a2 ? `https://flagcdn.com/w${w}/${a2.toLowerCase()}.png` : null
};

// Starting camera: centred over Southeast Asia.
export const HOME_VIEW = { lat: 8, lng: 108, altitude: 2.3 };

export const COLORS = {
  gold: '#d6b46a',
  goldBright: '#f3d38a',
  blue: '#7fb2ff',
  capHover: 'rgba(214,180,106,0.30)',
  capSelected: 'rgba(214,180,106,0.55)',
  capIdle: 'rgba(0,0,0,0)',
  stroke: 'rgba(230,205,150,0.55)',
  strokeSelected: '#f6dc9a',
  side: 'rgba(214,180,106,0.18)'
};
