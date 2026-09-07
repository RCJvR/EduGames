// WRO 2026 RoboMission Junior — "Heritage Heroes" — zone definitions
// All coordinates are in mm with origin (0,0) at the TOP-LEFT of the mat,
// x to the right, y downward -- the same frame zones-senior.js and
// zones-elementary.js use.
//
// Derived from the official game mat printing file (img/gamemat-junior.jpg,
// 2000x968px, aspect ratio 2.0661 vs the mat's true 2.0665 -- an undistorted
// top-down render, not a perspective photo) by colour-region analysis
// (flood-filling matching pixel blobs, see the conversion method below),
// cross-checked against "RoboMission Junior Game Rules Season 2026 -
// Heritage Heroes" (WRO Association, version January 15th 2026).
//
// Conversion used throughout: mm = px * (2362/2000) horizontally,
// px * (1143/968) vertically -- both work out to ~1.181, consistent with
// the image's correct aspect ratio.
//
// CONFIDENCE NOTES (read before trusting a coordinate to the mm):
// - Every square/rectangular zone below was read off a tightly-cropped,
//   pixel-gridded blow-up of the actual mat image and cross-checked
//   against a colour-blob flood fill -- these should be accurate to
//   within a couple of mm.
// - 'cobblestone' is a POLYGON approximation of an organic/irregular
//   printed boundary (the rules document itself shows it as a hand-drawn
//   pink outline, not a precise geometric shape, on page 13) -- treat its
//   edges as close, not exact. The rules only need dirt particles fully
//   OUTSIDE this area, so approximate accuracy is enough for planning.
// - 'parrot': located from the user's own visual ID of two dark-teal LEGO
//   footprint blocks on the mat (right of the lower yellow tower-base
//   target) -- confirmed by colour-blob analysis (R<75 in a G~105-130,
//   B~45-75 band, isolating them from the similarly-dark shadow around
//   them), not my own guess from the rules photo alone. Feet go in the
//   wider/bigger block (top), tail in the narrower one (bottom).
// - Section/page numbers cite the Junior rules PDF as supplied for this
//   season -- re-verify against whatever version you're actually scored on.

window.WRO_MAT = {
  width:  2362,
  height: 1143,
  tolerance: 5,

  // Robot constraints (General Rules §5.1) -- carried over from the other
  // two categories; confirm this is the same limit for Junior this season.
  robotMaxSize: 250,

  snapDefault: 10,
};

window.WRO_ZONES = [
  // ---- Start area ----
  {
    id: 'start',
    name: 'Start area',
    desc: 'Blue-bordered white card with the WRO / RoboMission Junior 2026 "Heritage Heroes" placard, left side of the field. Robot starts here (General Rules §7 -- place the mat against the short wall close to the start area).',
    rule: 'General Rules -- start area convention shared with the other RoboMission categories.',
    klass: 'start',
    type: 'rect',
    x: 362.6, y: 447.5, w: 246.8, h: 246.8,
    label: { x: 486, y: 430, anchor: 'middle', text: 'START AREA' },
    centre: { x: 486, y: 571 }
  },

  // ---- 3.1 Show the visitors around (rules p.8) ----
  {
    id: 'visitors_start',
    name: 'Visitors · starting position',
    desc: '4 visitor minifigs (red, green, blue, black) on the street in the lower-left corner.',
    rule: 'Rules §3 p.4 -- visitors start here, 4 total.',
    klass: 'cable',
    type: 'rect',
    x: 283.4, y: 1050.9, w: 406.3, h: 29.5,
    label: { x: 486, y: 1030, anchor: 'middle', text: 'VISITORS · START' },
    centre: { x: 486, y: 1065 }
  },
  {
    id: 'visitor_area_museum',
    name: 'Visitor target · red (museum)',
    desc: 'Red visitor\'s destination -- same red-bordered area as the museum (upper end of the field).',
    rule: 'Rules §3.1 p.8 -- 10 pts completely in & upright, 5 pts partly in / not upright. Max 40 pts across all 4 visitors.',
    klass: 'target',
    type: 'rect',
    x: 879.8, y: 0, w: 786.5, h: 177.1,
    label: { x: 1273, y: 195, anchor: 'middle', text: 'VISITOR TARGET · RED (= MUSEUM)' },
    centre: { x: 1273, y: 89 }
  },
  {
    id: 'visitor_area_excavation',
    name: 'Visitor target · green (excavation site)',
    desc: 'Green visitor\'s destination -- same green-bordered area as the excavation site (lower end of the field).',
    rule: 'Rules §3.1 p.8 -- see visitor_area_museum.',
    klass: 'target',
    type: 'rect',
    x: 924.7, y: 963.5, w: 696.8, h: 178.3,
    label: { x: 1273, y: 945, anchor: 'middle', text: 'VISITOR TARGET · GREEN (= EXCAVATION)' },
    centre: { x: 1273, y: 1053 }
  },
  {
    id: 'visitor_area_black',
    name: 'Visitor target · black (above the cobblestone)',
    desc: 'Black visitor\'s destination -- dark grey rectangle above the cobblestone area, upper-right of the field.',
    rule: 'Rules §3.1 p.8 -- see visitor_area_museum.',
    klass: 'target',
    type: 'rect',
    x: 2077.4, y: 262.1, w: 187.8, h: 96.8,
    label: { x: 2171, y: 245, anchor: 'middle', text: 'VISITOR TARGET · BLACK' },
    centre: { x: 2171, y: 311 }
  },
  {
    id: 'visitor_area_blue',
    name: 'Visitor target · blue (below the cobblestone)',
    desc: 'Blue visitor\'s destination -- thin blue strip along the west edge of the cobblestone area.',
    rule: 'Rules §3.1 p.8 -- see visitor_area_museum.',
    klass: 'target',
    type: 'rect',
    x: 1905.0, y: 422.7, w: 16.5, h: 296.4,
    label: { x: 1913, y: 405, anchor: 'middle', text: 'VISITOR TARGET · BLUE' },
    centre: { x: 1913, y: 571 }
  },

  // ---- 3.2 Rebuild the towers (rules p.9-10) ----
  {
    id: 'red_tower_start1',
    name: 'Red tower · starting position 1',
    desc: 'Red tower (unbuilt), left edge, upper of the two red squares.',
    rule: 'Rules §3 p.5 -- 2 red towers total.',
    klass: 'cable',
    type: 'rect',
    x: 62.6, y: 186.6, w: 43.7, h: 43.7,
    label: { x: 84, y: 175, anchor: 'middle', text: 'RED TOWER · START' },
    centre: { x: 84, y: 208 }
  },
  {
    id: 'red_tower_start2',
    name: 'Red tower · starting position 2',
    desc: 'Red tower (unbuilt), left edge, lower of the two red squares.',
    rule: 'Rules §3 p.5 -- see red_tower_start1.',
    klass: 'cable',
    type: 'rect',
    x: 62.6, y: 333.0, w: 43.7, h: 46.1,
    label: { x: 84, y: 388, anchor: 'middle', text: 'RED TOWER · START' },
    centre: { x: 84, y: 356 }
  },
  {
    id: 'red_tower_target1',
    name: 'Red tower target 1 (incl. orange border)',
    desc: 'Where a rebuilt red tower must stand, right half of the field, upper of the two targets. Orange border counts as part of the target.',
    rule: 'Rules §3.2 p.9 -- 15 pts completely in & upright, 10 pts partly in & upright. Max 30 pts across both red towers.',
    klass: 'target',
    type: 'rect',
    x: 1588.4, y: 368.4, w: 81.5, h: 72.0,
    label: { x: 1629, y: 355, anchor: 'middle', text: 'RED TOWER TARGET' },
    centre: { x: 1629, y: 404 }
  },
  {
    id: 'red_tower_target2',
    name: 'Red tower target 2 (incl. orange border)',
    desc: 'Where a rebuilt red tower must stand, right half of the field, lower of the two targets.',
    rule: 'Rules §3.2 p.9 -- see red_tower_target1.',
    klass: 'target',
    type: 'rect',
    x: 1588.4, y: 703.7, w: 81.5, h: 72.0,
    label: { x: 1629, y: 690, anchor: 'middle', text: 'RED TOWER TARGET' },
    centre: { x: 1629, y: 740 }
  },
  {
    id: 'yellow_tower_top_start1',
    name: 'Yellow tower top · starting position 1',
    desc: 'Yellow tower top (to swap onto a base), top-left corner, first of two yellow squares.',
    rule: 'Rules §3 p.4 -- 2 yellow tower tops + 2 bases total.',
    klass: 'cable',
    type: 'rect',
    x: 209.0, y: 40.1, w: 43.7, h: 43.7,
    label: { x: 231, y: 28, anchor: 'middle', text: 'YELLOW TOP · START' },
    centre: { x: 231, y: 62 }
  },
  {
    id: 'yellow_tower_top_start2',
    name: 'Yellow tower top · starting position 2',
    desc: 'Yellow tower top, top-left corner, second of two yellow squares.',
    rule: 'Rules §3 p.4 -- see yellow_tower_top_start1.',
    klass: 'cable',
    type: 'rect',
    x: 355.5, y: 40.1, w: 43.7, h: 43.7,
    label: { x: 377, y: 28, anchor: 'middle', text: 'YELLOW TOP · START' },
    centre: { x: 377, y: 62 }
  },
  {
    id: 'yellow_tower_base_target1',
    name: 'Yellow tower base target 1 (incl. orange border)',
    desc: 'Yellow tower base marked with a broken-tower icon, right half of the field, upper of the two. Swap the correct top onto it.',
    rule: 'Rules §3.2 p.10 -- 25 pts correctly placed & completely in, 15 pts correctly placed but only partly in. Max 50 pts across both yellow towers.',
    klass: 'target',
    type: 'rect',
    x: 1765.6, y: 192.5, w: 76.8, h: 76.8,
    label: { x: 1804, y: 178, anchor: 'middle', text: 'YELLOW BASE TARGET' },
    centre: { x: 1804, y: 231 }
  },
  {
    id: 'yellow_tower_base_target2',
    name: 'Yellow tower base target 2 (incl. orange border)',
    desc: 'Yellow tower base marked with a broken-tower icon, right half of the field, lower of the two.',
    rule: 'Rules §3.2 p.10 -- see yellow_tower_base_target1.',
    klass: 'target',
    type: 'rect',
    x: 1765.6, y: 871.4, w: 76.8, h: 76.8,
    label: { x: 1804, y: 857, anchor: 'middle', text: 'YELLOW BASE TARGET' },
    centre: { x: 1804, y: 910 }
  },

  // ---- 3.3 Bring the artefacts in the museum (rules p.11) ----
  {
    id: 'museum',
    name: 'Museum (red area)',
    desc: 'Red-bordered building at the top of the field, containing the 5 exhibition spots.',
    rule: 'Rules §2 p.3 -- named area on the game-field diagram.',
    klass: 'stage',
    type: 'rect',
    x: 879.8, y: 0, w: 786.5, h: 177.1,
    label: { x: 1273, y: -12, anchor: 'middle', text: 'MUSEUM (RED AREA)' },
    centre: { x: 1273, y: 89 }
  },
  {
    id: 'exhibition_red',
    name: 'Exhibition spot · red',
    desc: 'Red exhibition spot inside the museum, for the red artefact.',
    rule: 'Rules §3.3 p.11 -- 15 pts completely in & upright, 5 pts partly in / not upright. Max 60 pts across all exhibition spots.',
    klass: 'target',
    type: 'rect',
    x: 988.5, y: 48.4, w: 42.5, h: 44.9,
    label: { x: 1010, y: 105, anchor: 'middle', text: 'RED' },
    centre: { x: 1010, y: 71 }
  },
  {
    id: 'exhibition_green',
    name: 'Exhibition spot · green',
    desc: 'Green exhibition spot inside the museum, for the green artefact.',
    rule: 'Rules §3.3 p.11 -- see exhibition_red.',
    klass: 'target',
    type: 'rect',
    x: 1119.6, y: 48.4, w: 43.7, h: 43.7,
    label: { x: 1141, y: 105, anchor: 'middle', text: 'GREEN' },
    centre: { x: 1141, y: 70 }
  },
  {
    id: 'exhibition_black',
    name: 'Exhibition spot · black',
    desc: 'Black exhibition spot inside the museum, for the black artefact.',
    rule: 'Rules §3.3 p.11 -- see exhibition_red.',
    klass: 'target',
    type: 'rect',
    x: 1250.7, y: 48.4, w: 44.9, h: 44.9,
    label: { x: 1273, y: 105, anchor: 'middle', text: 'BLACK' },
    centre: { x: 1273, y: 71 }
  },
  {
    id: 'exhibition_blue',
    name: 'Exhibition spot · blue',
    desc: 'Blue exhibition spot inside the museum, for the blue artefact.',
    rule: 'Rules §3.3 p.11 -- see exhibition_red.',
    klass: 'target',
    type: 'rect',
    x: 1383.0, y: 48.4, w: 43.7, h: 43.7,
    label: { x: 1405, y: 105, anchor: 'middle', text: 'BLUE' },
    centre: { x: 1405, y: 70 }
  },
  {
    id: 'exhibition_yellow',
    name: 'Exhibition spot · yellow',
    desc: 'Yellow exhibition spot inside the museum, for the yellow artefact.',
    rule: 'Rules §3.3 p.11 -- see exhibition_red.',
    klass: 'target',
    type: 'rect',
    x: 1515.2, y: 48.4, w: 43.7, h: 43.7,
    label: { x: 1537, y: 105, anchor: 'middle', text: 'YELLOW' },
    centre: { x: 1537, y: 70 }
  },
  {
    id: 'excavation_site',
    name: 'Excavation site (green area)',
    desc: 'Green-bordered dig site at the bottom of the field, containing the 4 artefact starting spots.',
    rule: 'Rules §2 p.3 -- named area on the game-field diagram.',
    klass: 'stage',
    type: 'rect',
    x: 924.7, y: 963.5, w: 696.8, h: 178.3,
    label: { x: 1273, y: 1141, anchor: 'middle', text: 'EXCAVATION SITE (GREEN AREA)' },
    centre: { x: 1273, y: 1053 }
  },
  {
    id: 'artefact_start1',
    name: 'Artefact · starting spot 1',
    desc: 'Black square marking one of the 4 artefact starting spots in the excavation site (4 of the 5 artefacts are placed each round).',
    rule: 'Rules §3 p.5, "Summary randomization" p.7 -- 4 of 5 artefacts placed randomly per round, 1 unused.',
    klass: 'cable',
    type: 'rect',
    x: 1060.5, y: 1061.5, w: 29.5, h: 29.5,
    centre: { x: 1075, y: 1076 }
  },
  {
    id: 'artefact_start2',
    name: 'Artefact · starting spot 2',
    desc: 'See artefact_start1.',
    rule: 'Rules §3 p.5 -- see artefact_start1.',
    klass: 'cable',
    type: 'rect',
    x: 1192.8, y: 1061.5, w: 29.5, h: 29.5,
    centre: { x: 1208, y: 1076 }
  },
  {
    id: 'artefact_start3',
    name: 'Artefact · starting spot 3',
    desc: 'See artefact_start1.',
    rule: 'Rules §3 p.5 -- see artefact_start1.',
    klass: 'cable',
    type: 'rect',
    x: 1323.9, y: 1061.5, w: 30.7, h: 29.5,
    centre: { x: 1339, y: 1076 }
  },
  {
    id: 'artefact_start4',
    name: 'Artefact · starting spot 4',
    desc: 'See artefact_start1.',
    rule: 'Rules §3 p.5 -- see artefact_start1.',
    klass: 'cable',
    type: 'rect',
    x: 1456.2, y: 1061.5, w: 29.5, h: 29.5,
    centre: { x: 1471, y: 1076 }
  },

  // ---- 3.4 Clear the cobblestone of dirt (rules p.12-13) ----
  // POLYGON APPROXIMATION of an organic printed boundary -- see the
  // confidence note at the top of this file. Traced from a horizontal
  // colour scan (brick-red vs. grass-green/tan) at ~10 rows; the true
  // edge wiggles by a few mm between these points, which the rules'
  // own hand-drawn outline (p.13) shows is inherent to this area, not a
  // measurement gap.
  {
    id: 'cobblestone',
    name: 'Cobblestone area',
    desc: 'The brick-patterned plaza on the right side of the field, including the grey pad the red barrier stands on. Lines and visitor areas are NOT part of it (rules p.13).',
    rule: 'Rules §3.4 p.12 -- dirt particles score only once fully clear of this area. 2 pts each, max 20 pts.',
    klass: 'stage',
    type: 'polygon',
    points: [
      { x: 1948.7, y: 354.2 }, { x: 2008.1, y: 318.8 }, { x: 2352.6, y: 318.8 },
      { x: 2352.6, y: 873.8 }, { x: 2267.3, y: 873.8 }, { x: 1995.9, y: 861.7 },
      { x: 1925.3, y: 826.2 }, { x: 1925.3, y: 389.6 },
    ],
    label: { x: 2140, y: 300, anchor: 'middle', text: 'COBBLESTONE AREA' },
    centre: { x: 2140, y: 590 }
  },

  // ---- 3.5 Bonus points (rules p.14) ----
  {
    id: 'barrier_white',
    name: 'Barrier · white',
    desc: 'White barrier wall, right end of the field, horizontal, near the museum\'s east side.',
    rule: 'Rules §3.5 p.14 -- 10 pts if not damaged or moved. Max 20 pts across both barriers.',
    klass: 'barrier',
    type: 'rect',
    x: 1969.9, y: 27.2, w: 266.9, h: 60.2,
    label: { x: 2103, y: 15, anchor: 'middle', text: 'BARRIER · WHITE' },
    centre: { x: 2103, y: 57 }
  },
  {
    id: 'barrier_red',
    name: 'Barrier · red',
    desc: 'Red barrier wall, right end of the field, vertical, along the cobblestone area\'s east edge.',
    rule: 'Rules §3.5 p.14 -- see barrier_white.',
    klass: 'barrier',
    type: 'rect',
    x: 2279.3, y: 435.7, w: 60.2, h: 266.9,
    label: { x: 2340, y: 420, anchor: 'middle', text: 'BARRIER · RED' },
    centre: { x: 2309, y: 569 }
  },
  {
    id: 'parrot',
    name: 'Parrot',
    desc: 'Two dark-teal footprint blocks in a shadow pad, right of the lower yellow tower-base target. Feet go in the wider block (north/top), tail in the narrower one (south/bottom).',
    rule: 'Rules §3.5 p.14 -- 10 pts if not damaged or moved. Max 10 pts.',
    klass: 'barrier',
    type: 'rect',
    x: 1932.1, y: 878.5, w: 31.9, h: 47.2,
    label: { x: 1948, y: 865, anchor: 'middle', text: 'PARROT' },
    centre: { x: 1948, y: 902 }
  },
];

// Robot size presets for the ROBOT/POSE tools and the route walker's
// footprint. Mirrors zones-elementary.js/zones-senior.js's list exactly --
// this is required by app.js/tools.js (WRO_ROBOT_PROFILES.filter/.find),
// not optional decoration, so the page throws on load without it.
// "WRO max (250 mm cube)" carries over General Rules §5.1's robot size
// limit from the other two categories -- confirm it's the same number for
// Junior in your season's rules before relying on it (the Senior file
// carries this same caveat).
window.WRO_ROBOT_PROFILES = [
  { id: 'custom',    name: 'Custom (set size →)',       size: 220, custom: true },
  { id: 'wro250',    name: 'WRO max (250 mm cube)',     size: 250 },
  { id: 'spike',     name: 'LEGO Spike Prime (~200 mm)', size: 200 },
  { id: 'ev3',       name: 'LEGO EV3 (~250 mm)',         size: 250 },
  { id: 'small',     name: 'Compact (~180 mm)',          size: 180 },
];

// Hide the page's "Setup needed" banner automatically once this file has
// real zones in it, so the notice can't outlive the thing it's asking for.
// Kept here rather than in the shared app.js because it is junior-only.
// This script tag sits at the end of <body>, so 'DOMContentLoaded' has
// USUALLY ALREADY FIRED by the time this line runs -- a plain
// addEventListener would attach after the event and never call back.
(function hideJuniorSetupNotice() {
  function run() {
    const notice = document.getElementById('juniorSetupNotice');
    if (notice && window.WRO_ZONES && window.WRO_ZONES.length) notice.style.display = 'none';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
