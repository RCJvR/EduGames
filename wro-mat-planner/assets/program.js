// WRO 2026 Game Mat Planner — route/program planner + PyBricks export
// Builds an ordered sequence of abstract robot actions (drive, turn,
// attachment-motor lift/drop, line follow, wait, comment) and exports it
// as starter PyBricks code (SPIKE Prime / Robot Inventor style — DriveBase
// + Motor). Independent of the mat/zone data, so it works on both pages.

window.WRO_PROGRAM = (function() {
  'use strict';

  const STORAGE_KEY = 'wro2026-program';
  const PORTS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function h(tag, attrs = {}, parent = null) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(tag, attrs = {}, parent = null) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  function defaultConfig() {
    return {
      wheelDiameter: 56, axleTrack: 114, portLeft: 'A', portRight: 'B', portFront: 'C', portBack: 'D',
      straightSpeed: 200, straightAcceleration: 400, turnRate: 100, turnAcceleration: 300,
      // Where each line-following sensor sits relative to the robot's
      // centre (forward = along heading, lateral = +right/-left). Sensor A
      // is the only one used in single-sensor mode; both are used for a
      // two-sensor differential follower. lineFollowSteerGain is a tunable
      // conversion from PID correction to steering rate -- see
      // simulateLineFollow() for why this is a calibrated constant rather
      // than derived motor physics.
      lineSensorForwardMm: 80, lineSensorLateralMm: 0,
      lineSensor2ForwardMm: 80, lineSensor2LateralMm: 40,
      lineFollowSteerGain: 2.0,
      // Where the drive wheels sit along the robot's length, for the wheel
      // markers drawn on it -- purely visual, doesn't change turn kinematics
      // (those still rotate about the footprint's own centre).
      wheelForwardOffsetMm: 0,
      // Free-running speed of ONE drive motor at 100% duty cycle. Only used
      // to convert a duty-cycle-driven helper's speed into mm/s (see
      // dutyPctToMmS) -- a line follower written against motor.dc() states
      // its speed as a 0-100 duty percentage, not mm/s, so without this the
      // two can't be compared at all. ~1000 deg/s suits a SPIKE Prime
      // large/medium motor under light load; lower it for a geared-down or
      // heavily-loaded build.
      motorMaxSpeedDegS: 1000,
    };
  }
  // duty% -> mm/s along the ground, via the wheel's own circumference.
  // Deliberately a straight-line (no load curve) conversion: the point is to
  // get these steps into the right ballpark and the same UNITS as every
  // other speed here, not to model motor torque.
  function dutyPctToMmS(dutyPct, config) {
    const wheelDia = (config && config.wheelDiameter) || 56;
    const maxDegS = (config && config.motorMaxSpeedDegS) || 1000;
    return (dutyPct / 100) * maxDegS * (Math.PI * wheelDia) / 360;
  }
  // A lineFollowSim step's travel speed in mm/s. A step parsed from a
  // duty-cycle helper keeps its raw source `dutyPct`, and the duty -> mm/s
  // conversion is resolved HERE against the live config rather than being
  // baked in at parse time -- so retuning wheel size or motor max speed in
  // Robot config re-times an already-imported route instead of needing a
  // re-import. speedMmS (already mm/s at the source) wins when there's no
  // duty figure. Sign is meaningful: negative = driving in reverse.
  function lineFollowSpeedMmS(step, config) {
    if (step.dutyPct != null && isFinite(step.dutyPct) && step.dutyPct !== 0) {
      const mag = dutyPctToMmS(Math.abs(step.dutyPct), config);
      return step.dutyPct < 0 ? -mag : mag;
    }
    if (step.speedMmS != null && step.speedMmS !== 0) return step.speedMmS;
    return 100;
  }
  function defaultWalker() {
    return { ref: 'center', start: null, stepIndex: 0 };
  }
  // 12 frame slots, each 'empty' (not configured) or a tile colour -- the
  // real layout is set by a paper pattern placed under the frame each
  // round, so this has to be entered per practice run, not hardcoded.
  function defaultMosaicPattern() {
    return new Array(12).fill('empty');
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          steps: parsed.steps || [],
          config: Object.assign(defaultConfig(), parsed.config || {}),
          walker: Object.assign(defaultWalker(), parsed.walker || {}),
          mosaicPattern: Array.isArray(parsed.mosaicPattern) && parsed.mosaicPattern.length === 12
            ? parsed.mosaicPattern : defaultMosaicPattern(),
        };
      }
    } catch { /* fall through to default */ }
    return { steps: [], config: defaultConfig(), walker: defaultWalker(), mosaicPattern: defaultMosaicPattern() };
  }
  function persist(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---- mat pixel sampling: a simulated reflectance/colour sensor reads
  // the SAME mat photo the page already displays, the same way
  // https://www.aposteriori.com.sg/Ev3devSim represents its track (a
  // raster image, not vector line data) -- draw the <img class="mat"> to
  // an offscreen canvas once and cache its ImageData, so each sample
  // during a simulation is just array indexing, not a canvas readback.
  let matImageDataCache = null; // { data, width, height, mmToPxX, mmToPxY } | null
  function getMatImageData() {
    if (matImageDataCache) return matImageDataCache;
    const img = document.querySelector('.stage img.mat');
    if (!img || !img.complete || !img.naturalWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return null; // e.g. tainted canvas if ever served cross-origin
    }
    matImageDataCache = {
      data: imageData.data, width: canvas.width, height: canvas.height,
      mmToPxX: canvas.width / window.WRO_MAT.width,
      mmToPxY: canvas.height / window.WRO_MAT.height,
    };
    return matImageDataCache;
  }
  // Reads the pixel at (xMm, yMm) and returns { reflect, r, g, b }, where
  // reflect is a 0-100 luminance value in the same rough scale a real
  // reflected_light_intensity/reflection() reading uses. Off the mat (or
  // before the image has loaded) returns a neutral mid-grey rather than
  // throwing, since a route can legitimately be edited before the mat
  // image finishes loading.
  function sampleMatPixel(xMm, yMm) {
    const img = getMatImageData();
    if (!img) return { reflect: 50, r: 128, g: 128, b: 128 };
    const px = Math.max(0, Math.min(img.width - 1, Math.round(xMm * img.mmToPxX)));
    const py = Math.max(0, Math.min(img.height - 1, Math.round(yMm * img.mmToPxY)));
    const i = (py * img.width + px) * 4;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const reflect = (0.299 * r + 0.587 * g + 0.114 * b) / 255 * 100;
    return { reflect, r, g, b };
  }
  // A sensor's world position, given the robot's pose and its offset from
  // centre (forwardMm along heading, lateralMm to the +right).
  function sensorWorldPos(pose, forwardMm, lateralMm) {
    const rad = pose.heading * Math.PI / 180;
    const fwd = { x: Math.sin(rad), y: -Math.cos(rad) };
    const right = { x: Math.cos(rad), y: Math.sin(rad) };
    return {
      x: pose.x + fwd.x * forwardMm + right.x * lateralMm,
      y: pose.y + fwd.y * forwardMm + right.y * lateralMm,
    };
  }
  // Real robot code calibrates Color.BLACK/WHITE/etc to its own sensor
  // under its own lighting -- there's no exact equivalent for a printed
  // mat photo, so black/white/gray are approximated as a reflectance
  // (brightness) threshold instead of trying to match the exact
  // calibrated value. Hue colours (red/yellow/green/blue) can't be told
  // apart by brightness at all, so those go through an HSV hue check on
  // the mat image's own RGB pixel instead.
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }
  // Hue ranges (degrees) for the mat's own game-piece colours -- wide
  // enough to tolerate print/lighting variation, narrow enough that
  // adjacent colours (e.g. green vs blue) don't overlap.
  const STOP_HUE_RANGES = {
    red: [[0, 12], [348, 360]],
    yellow: [[38, 68]],
    green: [[85, 165]],
    blue: [[195, 255]],
  };
  function pixelMatchesTarget(pixel, targetColourName) {
    const name = (targetColourName || '').toLowerCase();
    if (name.includes('black')) return pixel.reflect < 30;
    const { h, s, v } = rgbToHsv(pixel.r, pixel.g, pixel.b);
    if (name.includes('white') || name.includes('gray') || name.includes('grey')) {
      // Saturation-gated, not just brightness -- real code here checks the
      // CLASSIFIED .color(), not raw reflection(), and a vivid colour like
      // yellow can be just as bright as white (both near-100 reflectance)
      // while still being clearly a different colour by hue/saturation.
      return pixel.reflect > 70 && s < 0.35;
    }
    const ranges = STOP_HUE_RANGES[name];
    if (!ranges) return false; // an unrecognised colour name can't be matched -- caller should skip the stop-condition instead of guessing
    if (s < 0.25 || v < 0.15) return false; // too washed-out/dark for hue to mean anything
    return ranges.some(([lo, hi]) => h >= lo && h <= hi);
  }
  function isRecognisedStopColour(name) {
    if (!name) return false;
    const n = name.toLowerCase();
    return n.includes('black') || n.includes('white') || n.includes('gray') || n.includes('grey') || !!STOP_HUE_RANGES[n];
  }

  // ---- kinematics: 0deg = up/north, positive = clockwise (matches the
  // rest of the tool and PyBricks' own turn() convention) ----
  // Rotate a 2D vector by `deg` degrees, consistent with how heading h
  // transforms this app's own right(h)=(cos h, sin h) vector -- verified:
  // rotateVec(right(h), d) === right(h+d) via the angle-addition formulas.
  function rotateVec(v, deg) {
    const rad = deg * Math.PI / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  }
  // 'arc' steps (PyBricks drive_base.arc(), or a single-wheel pivot turn)
  // sweep the robot's CENTRE around a pivot point offset from the centre by
  // `radius` mm along the robot's own right-axis, rather than rotating in
  // place like 'turn' -- the robot's x/y actually moves. `degrees` is the
  // heading change, same signed convention as 'turn' (positive = right/CW).
  // This formula (and its sign convention) was verified against a real
  // route's own PID heading bookkeeping rather than assumed from docs --
  // see parsePyBricksCode's arc handling for why that mattered.
  function applyArcStep(pose, radius, degrees) {
    const rad = pose.heading * Math.PI / 180;
    const right = { x: Math.cos(rad), y: Math.sin(rad) };
    const pivot = { x: pose.x + radius * right.x, y: pose.y + radius * right.y };
    const offset = rotateVec({ x: pose.x - pivot.x, y: pose.y - pivot.y }, degrees);
    return {
      x: pivot.x + offset.x,
      y: pivot.y + offset.y,
      heading: ((pose.heading + degrees) % 360 + 360) % 360,
    };
  }
  // A robot with no footprint info yet (e.g. a call site that hasn't been
  // taught to pass one) falls back to this rather than crashing.
  const DEFAULT_FOOTPRINT = { w: 220, l: 220 };
  const DEFAULT_LINE_CONFIG = {
    lineSensorForwardMm: 80, lineSensorLateralMm: 0,
    lineSensor2ForwardMm: 80, lineSensor2LateralMm: 40,
    lineFollowSteerGain: 2.0,
  };
  // 'squareToWall' models driving into the mat's outer wall to hard-reset
  // drift -- a common real technique this tool otherwise has no way to
  // represent. Two things a plain 'drive' can't capture: (1) the ROBOT'S
  // EDGE stops at the wall, not its centre -- ramming forward moves the
  // centre only as far as (mat edge - half the robot's extent in that
  // direction), using its *current* footprint (open/closed); (2) contact
  // with a flat wall squares the chassis flush, so heading snaps to
  // whichever cardinal direction (0/90/180/270) it was already closest to,
  // correcting any accumulated drift rather than preserving it.
  function applySquareToWall(pose, footprint, reverse) {
    const MAT_W = window.WRO_MAT.width, MAT_H = window.WRO_MAT.height;
    const heading = ((Math.round(pose.heading / 90) * 90) % 360 + 360) % 360;
    const rad = heading * Math.PI / 180;
    // A recognised open-loop drive_base.drive(speed, 0) can have a NEGATIVE
    // speed (driving backward into the wall behind the robot's heading,
    // e.g. a reversing "starting square"), not just forward -- reverse
    // flips which wall the robot's rear actually contacts, since fwd below
    // otherwise always assumes forward travel in the current heading.
    const dir = reverse ? -1 : 1;
    const fwd = { x: dir * Math.sin(rad), y: dir * -Math.cos(rad) };
    const halfL = footprint.l / 2;
    let x = pose.x, y = pose.y;
    if (Math.abs(fwd.y) > 0.5) { // heading 0 or 180 -- driving toward the top/bottom wall
      y = fwd.y < 0 ? halfL : MAT_H - halfL;
    } else { // heading 90 or 270 -- driving toward the left/right wall
      x = fwd.x < 0 ? halfL : MAT_W - halfL;
    }
    return { x, y, heading };
  }
  // 'lineFollowPath' replays a path traced with the PATH tool (see SAVE
  // PATH) as a RELATIVE sequence of motions from wherever the robot
  // currently is -- consistent with every other step type here being a
  // relative primitive (drive N mm forward, turn N degrees) rather than a
  // jump to an absolute mat position. The path's own first-to-second-point
  // bearing is treated as "the heading the robot was facing when it
  // started following this line", so the whole traced shape rotates to
  // match the robot's actual current heading before being walked -- the
  // same traced path can then be reused anywhere in the route regardless
  // of the heading you approach it from. This is an IDEALISED follow (the
  // robot tracks the traced line exactly, no sensor/wobble simulation),
  // and heading snaps at each traced vertex rather than curving smoothly
  // through it, same as a polyline would.
  function pathLocalPoints(step) {
    const M = window.WRO_TOOLS.math;
    const raw = step.points;
    const p0 = raw[0];
    return {
      local: raw.map(p => ({ x: p.x - p0.x, y: p.y - p0.y })),
      startBearing: M.bearing(raw[0], raw[1]),
    };
  }
  function pathTotalLength(points) {
    const M = window.WRO_TOOLS.math;
    let total = 0;
    for (let i = 1; i < points.length; i++) total += M.dist(points[i - 1], points[i]);
    return total;
  }
  // frac 0..1 by arc-length (not by point index, since segments vary in
  // length) along an already-rotated local point list.
  function pointAlongLocalPath(pts, frac) {
    const M = window.WRO_TOOLS.math;
    const total = pathTotalLength(pts);
    const target = total * Math.max(0, Math.min(1, frac));
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const segLen = M.dist(pts[i - 1], pts[i]);
      if (acc + segLen >= target || i === pts.length - 1) {
        const segFrac = segLen > 0 ? (target - acc) / segLen : 0;
        return {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * segFrac,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * segFrac,
          heading: M.bearing(pts[i - 1], pts[i]),
        };
      }
      acc += segLen;
    }
    const last = pts[pts.length - 1];
    return { x: last.x, y: last.y, heading: 0 };
  }
  function applyLineFollowPathStep(pose, step, frac) {
    if (!step.points || step.points.length < 2) return pose;
    const { local, startBearing } = pathLocalPoints(step);
    const rotationDelta = pose.heading - startBearing;
    const rotated = local.map(p => rotateVec(p, rotationDelta));
    const sample = pointAlongLocalPath(rotated, frac);
    return {
      x: pose.x + sample.x,
      y: pose.y + sample.y,
      heading: ((sample.heading % 360) + 360) % 360,
    };
  }
  // 'lineFollowSim' is a REAL simulated reflectance-tracking PID loop, not
  // a closed-form transform like every other step here -- it numerically
  // steps forward at a fixed tick (10ms, matching the wait(10) most
  // EV3/SPIKE line-follow loops use per iteration) and samples the actual
  // mat photo under a configured sensor offset at each tick, mirroring
  // https://www.aposteriori.com.sg/Ev3devSim's own raster-image approach
  // rather than needing separately-authored vector line geometry.
  // Simplifications, clearly not a full physical replica:
  // - Only ONE sensor position is modelled (this tool's reference code
  //   always reads a single centre sensor for steering regardless of the
  //   `side` argument, which only flips the error's sign).
  // - Real driver code tunes 3 separate accel/cruise/decel gain zones;
  //   only one (steady-state) kp/kd pair is used for the whole segment,
  //   since the zone-boundary ratios are hardcoded inside function bodies
  //   this parser deliberately doesn't trace into.
  // - PID output -> steering rate is a tunable calibration constant
  //   (config.lineFollowSteerGain), not derived motor-duty-cycle physics
  //   (that needs a real motor's speed-per-duty curve, which isn't known
  //   here) -- adjust it in Robot config if the wobble looks off.
  // - A target Color.X can't be matched to its exact original calibration
  //   (that was tuned to a real sensor under real lighting); it's
  //   approximated as a brightness/hue threshold instead (pixelMatchesTarget).
  const LINE_FOLLOW_DT = 0.01;
  function simulateLineFollow(startPose, step, config) {
    const cfg = config || DEFAULT_LINE_CONFIG;
    // speedMmS's SIGN is a real, meaningful "drive backward" instruction in
    // some reference code (e.g. approaching a colour target in reverse) --
    // magnitude sets the tick size, sign sets travel direction, same split
    // a plain 'drive' step's signed distanceMm already implies.
    const speedSigned = lineFollowSpeedMmS(step, cfg);
    const speed = Math.abs(speedSigned);
    const driveDir = speedSigned < 0 ? -1 : 1;
    const kp = step.kp != null ? step.kp : 1;
    const kd = step.kd != null ? step.kd : 3;
    const target = step.targetReflection != null ? step.targetReflection : 50;
    const sideSign = step.side === 'right' ? -1 : 1;
    const twoSensor = step.mode === 'twoSensor';
    const maxDist = Math.max(0, step.maxDistanceMm || 0);
    const minTravel = step.minTravelDistMm || 0;
    const steerGain = cfg.lineFollowSteerGain != null ? cfg.lineFollowSteerGain : DEFAULT_LINE_CONFIG.lineFollowSteerGain;
    const fwdA = cfg.lineSensorForwardMm != null ? cfg.lineSensorForwardMm : DEFAULT_LINE_CONFIG.lineSensorForwardMm;
    const latA = cfg.lineSensorLateralMm != null ? cfg.lineSensorLateralMm : DEFAULT_LINE_CONFIG.lineSensorLateralMm;
    const fwdB = cfg.lineSensor2ForwardMm != null ? cfg.lineSensor2ForwardMm : DEFAULT_LINE_CONFIG.lineSensor2ForwardMm;
    const latB = cfg.lineSensor2LateralMm != null ? cfg.lineSensor2LateralMm : DEFAULT_LINE_CONFIG.lineSensor2LateralMm;
    const distPerTickMag = Math.max(0.25, speed * LINE_FOLLOW_DT);

    // Which physical sensor position is used for single-sensor TRACKING --
    // independent of which sensor(s) a stop condition checks below. Some
    // reference code lets you pick either sensor for line-following
    // (sensor="left"/"right"), mapped onto this tool's generic A/B slots.
    const trackFwd = step.sensorChoice === 'B' ? fwdB : fwdA;
    const trackLat = step.sensorChoice === 'B' ? latB : latA;
    const hasStop = step.stopColour || step.stopReflectBelow != null || step.stopReflectAbove != null;

    let pose = { x: startPose.x, y: startPose.y, heading: startPose.heading };
    const samples = [{ x: pose.x, y: pose.y, heading: pose.heading }];
    let travelled = 0, lastError = 0, stoppedEarly = false;

    while (travelled < maxDist) {
      // Single-sensor: track a target reflectance with one sensor (an edge
      // follower -- `side` just flips which way "too bright" steers).
      // Two-sensor: balance two sensors straddling the line, the same
      // differential approach https://www.aposteriori.com.sg/Ev3devSim's
      // own demo code uses (error = left - right, no target needed).
      let error;
      if (twoSensor) {
        const posA = sensorWorldPos(pose, fwdA, latA);
        const posB = sensorWorldPos(pose, fwdB, latB);
        error = sampleMatPixel(posA.x, posA.y).reflect - sampleMatPixel(posB.x, posB.y).reflect;
      } else {
        const sensor = sensorWorldPos(pose, trackFwd, trackLat);
        error = (sampleMatPixel(sensor.x, sensor.y).reflect - target) * sideSign;
      }
      const derivative = error - lastError;
      lastError = error;
      let correction = kp * error + kd * derivative;
      correction = Math.max(-80, Math.min(80, correction));
      const headingDelta = correction * steerGain * LINE_FOLLOW_DT;

      // tickMag (always >= 0) drives the maxDist/travelled bookkeeping;
      // driveDir flips the actual position delta for reverse driving.
      const tickMag = Math.min(distPerTickMag, maxDist - travelled);
      const tickDist = tickMag * driveDir;
      const rad = pose.heading * Math.PI / 180;
      pose = {
        x: pose.x + tickDist * Math.sin(rad),
        y: pose.y - tickDist * Math.cos(rad),
        heading: ((pose.heading + headingDelta) % 360 + 360) % 360,
      };
      travelled += tickMag;
      samples.push({ x: pose.x, y: pose.y, heading: pose.heading });

      if (hasStop && travelled >= minTravel) {
        // stopSensorCheck picks which sensor position(s) the stop condition
        // reads -- may differ from the tracking sensor entirely (e.g. line
        // on sensor A, but stop when the OPPOSITE sensor crosses a cross-line).
        const sampleAt = (fwd, lat) => {
          const p = sensorWorldPos(pose, fwd, lat);
          return sampleMatPixel(p.x, p.y);
        };
        const matchesAt = (pixel) => {
          if (step.stopReflectBelow != null) return pixel.reflect < step.stopReflectBelow;
          if (step.stopReflectAbove != null) return pixel.reflect > step.stopReflectAbove;
          return pixelMatchesTarget(pixel, step.stopColour);
        };
        const which = step.stopSensorCheck || 'A';
        const matched = which === 'both'
          ? (matchesAt(sampleAt(fwdA, latA)) && matchesAt(sampleAt(fwdB, latB)))
          : which === 'either'
          ? (matchesAt(sampleAt(fwdA, latA)) || matchesAt(sampleAt(fwdB, latB)))
          : matchesAt(sampleAt(which === 'B' ? fwdB : fwdA, which === 'B' ? latB : latA));
        if (step.stopOnLoss ? !matched : matched) { stoppedEarly = true; break; }
      }
    }
    return { finalPose: pose, samples, distanceTravelled: travelled, stoppedEarly };
  }
  // Mid-animation (frac 0..1) pose: runs the FULL simulation (including
  // any colour-triggered early stop) once to find the true distance
  // travelled, then re-runs truncated to that fraction of the TRUE
  // distance -- not a fraction of maxDistanceMm, which would visibly
  // overshoot past a colour stop. The first pass's early ticks are
  // identical to the second's (same start pose, deterministic), so this
  // is consistent with the final pose applyStep returns, just ~2x the
  // (still cheap, a few hundred ticks) simulation cost.
  function simulateLineFollowPartial(startPose, step, config, frac) {
    const full = simulateLineFollow(startPose, step, config);
    const target = full.distanceTravelled * Math.max(0, Math.min(1, frac));
    return simulateLineFollow(startPose, Object.assign({}, step, { maxDistanceMm: target, stopColour: null }), config);
  }
  // 'setHeading' is hub.imu.reset_heading(X) -- re-anchors the gyro's
  // absolute reference to a specific value without moving. Unlike
  // squareToWall (snap to nearest cardinal, position also changes), this
  // sets an EXACT arbitrary heading at the robot's current position, and
  // maps directly onto a real PyBricks call, so it round-trips exactly
  // instead of exporting as a comment stub like the other approximated types.
  function applySetHeading(pose, heading) {
    return { x: pose.x, y: pose.y, heading: ((heading % 360) + 360) % 360 };
  }
  function applyStep(pose, step, footprint, config) {
    if (step.type === 'drive' || step.type === 'lineFollow') {
      const rad = pose.heading * Math.PI / 180;
      const dist = step.distanceMm;
      return { x: pose.x + dist * Math.sin(rad), y: pose.y - dist * Math.cos(rad), heading: pose.heading };
    }
    if (step.type === 'turn') {
      const signed = step.direction === 'left' ? -step.degrees : step.degrees;
      return { x: pose.x, y: pose.y, heading: ((pose.heading + signed) % 360 + 360) % 360 };
    }
    if (step.type === 'arc') {
      return applyArcStep(pose, step.radius, step.degrees);
    }
    if (step.type === 'squareToWall') {
      return applySquareToWall(pose, footprint || DEFAULT_FOOTPRINT, step.reverse);
    }
    if (step.type === 'lineFollowPath') {
      return applyLineFollowPathStep(pose, step, 1);
    }
    if (step.type === 'lineFollowSim') {
      return simulateLineFollow(pose, step, config).finalPose;
    }
    if (step.type === 'setHeading') {
      return applySetHeading(pose, step.heading);
    }
    return pose;
  }
  // getFootprint(sizeState) -> { w, l }, so the wall-square's edge math
  // uses the robot's real open/closed size at that point in the route
  // instead of a fixed guess. Optional -- callers that never touch
  // 'squareToWall' steps (or don't have a robot profile handy) can omit it.
  function poseAtIndex(steps, start, idx, getFootprint, config) {
    let pose = { x: start.x, y: start.y, heading: start.heading };
    let sizeState = 'closed';
    for (let i = 0; i < idx; i++) {
      const footprint = getFootprint ? getFootprint(sizeState) : DEFAULT_FOOTPRINT;
      pose = applyStep(pose, steps[i], footprint, config);
      if (steps[i].type === 'unfold') sizeState = 'open';
    }
    return pose;
  }
  // Same as applyStep, but partway through (frac 0..1) -- used to animate
  // the robot smoothly moving/turning during Play instead of jumping
  // straight to each step's endpoint.
  function applyStepPartial(pose, step, frac, footprint, config) {
    if (step.type === 'drive' || step.type === 'lineFollow') {
      const rad = pose.heading * Math.PI / 180;
      const dist = step.distanceMm * frac;
      return { x: pose.x + dist * Math.sin(rad), y: pose.y - dist * Math.cos(rad), heading: pose.heading };
    }
    if (step.type === 'turn') {
      const signed = step.direction === 'left' ? -step.degrees : step.degrees;
      return { x: pose.x, y: pose.y, heading: ((pose.heading + signed * frac) % 360 + 360) % 360 };
    }
    if (step.type === 'arc') {
      return applyArcStep(pose, step.radius, step.degrees * frac);
    }
    if (step.type === 'squareToWall') {
      const target = applySquareToWall(pose, footprint || DEFAULT_FOOTPRINT, step.reverse);
      let dh = target.heading - pose.heading;
      dh = ((dh + 540) % 360) - 180; // shortest-path heading delta, handles the 0/360 wrap
      return {
        x: pose.x + (target.x - pose.x) * frac,
        y: pose.y + (target.y - pose.y) * frac,
        heading: ((pose.heading + dh * frac) % 360 + 360) % 360,
      };
    }
    if (step.type === 'lineFollowPath') {
      return applyLineFollowPathStep(pose, step, frac);
    }
    if (step.type === 'lineFollowSim') {
      return simulateLineFollowPartial(pose, step, config, frac).finalPose;
    }
    if (step.type === 'setHeading') {
      const target = applySetHeading(pose, step.heading);
      let dh = target.heading - pose.heading;
      dh = ((dh + 540) % 360) - 180; // shortest-path heading delta, handles the 0/360 wrap
      return { x: pose.x, y: pose.y, heading: ((pose.heading + dh * frac) % 360 + 360) % 360 };
    }
    return pose; // instantaneous actions (pickup/place/deliver/settle/motor/wait/etc): no motion, just a dwell
  }
  // How long a step takes to "play" in seconds, from the actual configured
  // kinematics -- a drive/turn step's duration is its real distance/angle
  // divided by its own speed/turn-rate (falling back to the config
  // defaults), so 1x playback matches how long the step would really take
  // on the robot. Steps with no inherent duration (pickups, motor moves,
  // comments, ...) get a short fixed dwell so they're visible in the
  // animation instead of vanishing instantly.
  const DEFAULT_ACTION_DWELL_S = 0.6;
  function stepDuration(step, config, startPose) {
    switch (step.type) {
      case 'drive':
      case 'lineFollow': {
        const speed = (step.speedMmS && step.speedMmS > 0) ? step.speedMmS : (config.straightSpeed || 200);
        return Math.abs(step.distanceMm) / Math.max(1, speed);
      }
      case 'turn': {
        const rate = (step.turnRateDegS && step.turnRateDegS > 0) ? step.turnRateDegS : (config.turnRate || 100);
        return Math.abs(step.degrees) / Math.max(1, rate);
      }
      case 'arc': {
        const speed = config.straightSpeed || 200;
        const arcLength = Math.abs(step.radius) * Math.abs(step.degrees) * Math.PI / 180;
        return arcLength / Math.max(1, speed);
      }
      case 'wait':
        return Math.max(0, step.seconds || 0);
      case 'squareToWall':
        return 1.2; // a deliberately slower dwell -- physically a drive-to-stall against the wall, not instantaneous
      case 'lineFollowPath': {
        const speed = (step.speedMmS && step.speedMmS > 0) ? step.speedMmS : (config.straightSpeed || 200);
        return pathTotalLength(step.points || []) / Math.max(1, speed);
      }
      case 'lineFollowSim': {
        // Magnitude only -- a reverse (negative-speed) follow still takes
        // positive time. Reading step.speedMmS raw here used to miss that
        // and fall back to 100 mm/s for every reverse colour-stop step.
        const speed = Math.abs(lineFollowSpeedMmS(step, config));
        // An open-ended colour-stop call (drive_until_color2,
        // dualLineFollowToIntersection) has no real source distance, so it
        // gets parsed with a generous maxDistanceMm safety cap (e.g.
        // 3000mm) rather than its real, usually much shorter, stopping
        // distance. Using that cap as the nominal duration made these
        // steps play back at their full worst-case length even when the
        // simulated colour trigger fires almost immediately -- given the
        // step's actual starting pose, run the same simulation once here
        // and time it by the real distance travelled instead.
        if (startPose) {
          const result = simulateLineFollow(startPose, step, config);
          return result.distanceTravelled / Math.max(1, speed);
        }
        return (step.maxDistanceMm || 0) / Math.max(1, speed);
      }
      case 'setHeading':
        return 0.3; // near-instant -- re-anchoring the gyro reference doesn't move the robot
      case 'frontMotor':
      case 'backMotor': {
        // Real attachment-motor moves scale with their own commanded speed
        // and angle just like drive/turn -- falling back to the flat dwell
        // below for these would make a fast, tiny correctional move (a few
        // degrees at high speed) play back exactly as slowly as a large
        // one, which reads as the sim "randomly slowing down" at pickups.
        const speed = (step.speedDegS && step.speedDegS > 0) ? step.speedDegS : 200;
        return Math.abs(step.degrees) / Math.max(1, speed);
      }
      default:
        return DEFAULT_ACTION_DWELL_S;
    }
  }
  // A robot that unfolds starts "closed" (must fit the start area) and
  // switches to "open" the moment an Unfold step has been passed.
  function sizeStateAtIndex(steps, idx) {
    for (let i = 0; i < idx; i++) {
      if (steps[i].type === 'unfold') return 'open';
    }
    return 'closed';
  }
  const ARC_TRAIL_SAMPLES = 12;
  function trailPoints(steps, start, uptoIdx, getFootprint, config) {
    const pts = [{ x: start.x, y: start.y }];
    let pose = { x: start.x, y: start.y, heading: start.heading };
    let sizeState = 'closed';
    for (let i = 0; i < uptoIdx; i++) {
      const step = steps[i];
      const footprint = getFootprint ? getFootprint(sizeState) : DEFAULT_FOOTPRINT;
      // A straight chord between an arc's start/end would visibly cut the
      // curve's corner, so sample intermediate points along the sweep
      // instead of just pushing the endpoint (as drive/lineFollow do).
      if (step.type === 'arc') {
        for (let s = 1; s <= ARC_TRAIL_SAMPLES; s++) {
          const p = applyArcStep(pose, step.radius, step.degrees * s / ARC_TRAIL_SAMPLES);
          pts.push({ x: p.x, y: p.y });
        }
      }
      // A traced path is an arbitrary polyline -- sample along it the same
      // way an arc does, rather than drawing a single straight chord from
      // start to end. Pushes its own endpoint, so it's deliberately left
      // out of the drive/lineFollow/squareToWall endpoint-push below.
      if (step.type === 'lineFollowPath' && step.points && step.points.length >= 2) {
        const { local, startBearing } = pathLocalPoints(step);
        const rotationDelta = pose.heading - startBearing;
        const rotated = local.map(p => rotateVec(p, rotationDelta));
        const samples = 20;
        for (let s = 1; s <= samples; s++) {
          const p = pointAlongLocalPath(rotated, s / samples);
          pts.push({ x: pose.x + p.x, y: pose.y + p.y });
        }
      }
      // The wobble the simulated PID loop actually produced -- reuse its
      // own tick samples directly rather than re-deriving points some
      // other way, so the drawn trail is exactly what was simulated.
      if (step.type === 'lineFollowSim') {
        const result = simulateLineFollow(pose, step, config);
        result.samples.slice(1).forEach(p => pts.push({ x: p.x, y: p.y }));
      }
      pose = applyStep(pose, step, footprint, config);
      if (step.type === 'unfold') sizeState = 'open';
      if (step.type === 'drive' || step.type === 'lineFollow' || step.type === 'squareToWall') pts.push({ x: pose.x, y: pose.y });
    }
    return pts;
  }
  // footprint: { w, l } -- front/back offset by half the length (the
  // direction the robot points), left/right offset by half the width.
  function refPoint(pose, ref, footprint) {
    const rad = pose.heading * Math.PI / 180;
    const fwd = { x: Math.sin(rad), y: -Math.cos(rad) };
    const right = { x: Math.cos(rad), y: Math.sin(rad) };
    const halfL = footprint.l / 2, halfW = footprint.w / 2;
    if (ref === 'front') return { x: pose.x + fwd.x * halfL, y: pose.y + fwd.y * halfL };
    if (ref === 'back')  return { x: pose.x - fwd.x * halfL, y: pose.y - fwd.y * halfL };
    if (ref === 'right') return { x: pose.x + right.x * halfW, y: pose.y + right.y * halfW };
    if (ref === 'left')  return { x: pose.x - right.x * halfW, y: pose.y - right.y * halfW };
    return { x: pose.x, y: pose.y };
  }
  const REF_LABELS = { center: 'Centre', front: 'Front', back: 'Back', left: 'Left side', right: 'Right side' };

  function toolName(toolId) {
    const t = window.WRO_ELEMENTS && window.WRO_ELEMENTS.tools.find(t => t.id === toolId);
    return t ? t.name : toolId;
  }

  function describeStep(step) {
    switch (step.type) {
      case 'drive':
        return `Drive ${step.distanceMm >= 0 ? 'forward' : 'backward'} ${Math.abs(step.distanceMm)} mm`
          + (step.speedMmS ? ` @ ${step.speedMmS} mm/s` : '');
      case 'turn':
        return `Turn ${step.direction === 'left' ? 'left (CCW)' : 'right (CW)'} ${step.degrees}°`
          + (step.turnRateDegS ? ` @ ${step.turnRateDegS}°/s` : '');
      case 'arc':
        return `Arc ${step.degrees >= 0 ? 'right' : 'left'} ${Math.abs(step.degrees)}° (radius ${step.radius} mm)`;
      case 'squareToWall':
        return `Drive into wall to square${step.reverse ? ' (reverse)' : ''} (snap heading to nearest cardinal, edge stops at wall)`;
      case 'lineFollowPath': {
        const len = pathTotalLength(step.points || []);
        return `Follow traced path "${step.label || 'path'}" (${(step.points || []).length} pts, ${len.toFixed(0)} mm)${step.reversed ? ' [reversed]' : ''}`;
      }
      case 'lineFollowSim': {
        const stop = step.stopColour ? ` · stop on ${step.stopOnLoss ? 'losing' : 'seeing'} ${step.stopColour}` : '';
        const track = step.mode === 'twoSensor'
          ? 'two-sensor differential'
          : `target reflect ${step.targetReflection}, ${step.side || 'left'} side`;
        return `Follow line (simulated) up to ${step.maxDistanceMm} mm, ${track}${stop}`;
      }
      case 'setHeading':
        return `Reset gyro heading to ${step.heading}°`;
      case 'unfold':
        return 'Unfold to open size';
      case 'frontMotor':
        return `Front motor: ${step.action} ${step.degrees}°`;
      case 'backMotor':
        return `Back motor: ${step.action} ${step.degrees}°`;
      case 'lineFollow':
        return `Line follow ${step.distanceMm} mm`;
      case 'pickupTool':
        return `Pick up ${toolName(step.toolId)}`;
      case 'deliverTool':
        return `Deliver ${toolName(step.toolId)}`;
      case 'pickupTile':
        return `Pick up ${step.colour} tile`;
      case 'placeTile':
        return `Place tile in frame slot ${step.slot + 1}`;
      case 'settleCement':
        return `Settle ${step.count}× ${step.colour} cement`;
      case 'wait':
        return `Wait ${step.seconds} s`;
      case 'comment':
        return `# ${step.text}`;
      default:
        return step.type;
    }
  }

  // ---- game-element inventory: which tiles/cement/tools have been picked
  // up, are being carried, or delivered/settled -- a pure function of step
  // history up to `idx`, mirroring poseAtIndex/sizeStateAtIndex so it can be
  // recomputed for any point the walker is scrubbed to. Senior-only
  // (window.WRO_ELEMENTS is undefined on the Elementary page).
  function defaultInventory() {
    if (!window.WRO_ELEMENTS) return null;
    const tilePool = {}, cementLoose = {}, cementSettled = {}, toolsAtPad = {};
    window.WRO_ELEMENTS.TILE_COLOURS.forEach(c => { tilePool[c] = 6; });
    window.WRO_ELEMENTS.CEMENT_COLOURS.forEach(c => { cementLoose[c] = 10; cementSettled[c] = 0; });
    window.WRO_ELEMENTS.tools.forEach(t => { toolsAtPad[t.id] = true; });
    return {
      tilePool, cementLoose, cementSettled, toolsAtPad,
      toolsDelivered: {},
      frameSlots: new Array(12).fill(null), // null | { colour, correct: true|false|null }
      carrying: [], // { type:'tile', colour } | { type:'tool', id }
    };
  }
  function applyElementStep(inv, step, mosaicPattern) {
    if (step.type === 'pickupTile') {
      if (inv.tilePool[step.colour] > 0) {
        inv.tilePool[step.colour]--;
        inv.carrying.push({ type: 'tile', colour: step.colour });
      }
    } else if (step.type === 'placeTile') {
      if (inv.frameSlots[step.slot] == null) {
        const want = mosaicPattern[step.slot];
        // Prefer a carried tile matching the target slot's colour -- a
        // grabber that lifts 6 same-colour tiles at once usually carries
        // more than a single slot needs, so leftovers from an earlier
        // colour batch can still be sitting in `carrying` when a later
        // batch starts placing. Falls back to FIFO (oldest first) when the
        // slot's colour isn't known yet (pattern not set) or no carried
        // tile matches, same as the old colour-blind behaviour.
        let ci = want !== 'empty' ? inv.carrying.findIndex(c => c.type === 'tile' && c.colour === want) : -1;
        if (ci === -1) ci = inv.carrying.findIndex(c => c.type === 'tile');
        if (ci !== -1) {
          const item = inv.carrying.splice(ci, 1)[0];
          const correct = want === 'empty' ? null : (want === item.colour);
          inv.frameSlots[step.slot] = { colour: item.colour, correct };
        }
      }
    } else if (step.type === 'pickupTool') {
      if (inv.toolsAtPad[step.toolId]) {
        inv.toolsAtPad[step.toolId] = false;
        inv.carrying.push({ type: 'tool', id: step.toolId });
      }
    } else if (step.type === 'deliverTool') {
      const ci = inv.carrying.findIndex(c => c.type === 'tool' && c.id === step.toolId);
      if (ci !== -1) {
        inv.carrying.splice(ci, 1);
        inv.toolsDelivered[step.toolId] = true;
      }
    } else if (step.type === 'settleCement') {
      const n = Math.min(step.count, inv.cementLoose[step.colour]);
      inv.cementLoose[step.colour] -= n;
      inv.cementSettled[step.colour] += n;
    }
  }
  function inventoryAtIndex(steps, idx, mosaicPattern) {
    const inv = defaultInventory();
    if (!inv) return null;
    for (let i = 0; i < idx; i++) applyElementStep(inv, steps[i], mosaicPattern);
    return inv;
  }

  function generatePyBricks(steps, config) {
    const L = [];
    L.push('#!/usr/bin/env pybricks-micropython');
    L.push('"""');
    L.push('Generated by the WRO Game Mat Planner route builder.');
    L.push('Written for SPIKE Prime / Robot Inventor (PrimeHub). For EV3, swap');
    L.push('PrimeHub for EV3Brick and adjust ports to your EV3 wiring.');
    L.push('Check motor ports, turn direction and lift/drop sign against your');
    L.push('own build before running this on a robot.');
    L.push('"""');
    L.push('from pybricks.hubs import PrimeHub');
    L.push('from pybricks.pupdevices import Motor');
    L.push('from pybricks.parameters import Port, Stop');
    L.push('from pybricks.robotics import DriveBase');
    L.push('from pybricks.tools import wait');
    L.push('');
    L.push('hub = PrimeHub()');
    L.push('');
    L.push(`left_motor = Motor(Port.${config.portLeft})`);
    L.push(`right_motor = Motor(Port.${config.portRight})`);
    L.push(`front_motor = Motor(Port.${config.portFront})`);
    L.push(`back_motor = Motor(Port.${config.portBack})`);
    L.push('');
    L.push(`drive_base = DriveBase(left_motor, right_motor, wheel_diameter=${config.wheelDiameter}, axle_track=${config.axleTrack})`);
    L.push(`drive_base.settings(straight_speed=${config.straightSpeed}, straight_acceleration=${config.straightAcceleration}, turn_rate=${config.turnRate}, turn_acceleration=${config.turnAcceleration})`);
    L.push('');
    L.push('# --- Generated route ---');
    L.push('# turn(): positive = right/clockwise, negative = left/counter-clockwise');
    L.push('# motors: positive = lift, negative = drop -- flip the sign if reversed on your build');
    L.push('');

    if (!steps.length) {
      L.push('# (no steps added yet -- build a route in the planner, then re-export)');
    }

    // Track the currently-active straight_speed/turn_rate so we only emit a
    // settings() override when a step's value actually differs from what's
    // already active -- avoids a redundant settings() call before every
    // single drive/turn when most of the route uses the defaults.
    let activeSpeed = config.straightSpeed;
    let activeTurnRate = config.turnRate;

    steps.forEach(step => {
      const note = describeStep(step);
      switch (step.type) {
        case 'drive': {
          if (step.speedMmS && step.speedMmS !== activeSpeed) {
            L.push(`drive_base.settings(straight_speed=${step.speedMmS})`);
            activeSpeed = step.speedMmS;
          }
          L.push(`drive_base.straight(${step.distanceMm})  # ${note}`);
          break;
        }
        case 'turn': {
          if (step.turnRateDegS && step.turnRateDegS !== activeTurnRate) {
            L.push(`drive_base.settings(turn_rate=${step.turnRateDegS})`);
            activeTurnRate = step.turnRateDegS;
          }
          const signed = step.direction === 'left' ? -Math.abs(step.degrees) : Math.abs(step.degrees);
          L.push(`drive_base.turn(${signed})  # ${note}`);
          break;
        }
        case 'arc':
          L.push(`drive_base.arc(${step.radius}, ${step.degrees})  # ${note} -- verify curve direction on your build`);
          break;
        case 'unfold':
          L.push(`# --- ${note}: add your unfolding mechanism call here ---`);
          break;
        case 'squareToWall':
          L.push(`# --- ${note}: add your wall-squaring drive call here ---`);
          break;
        case 'lineFollowPath':
          L.push(`# --- ${note}: add your line-following drive here (uses your reflectance sensor(s) -- the traced shape only exists in the planner, it isn't exported as data) ---`);
          break;
        case 'lineFollowSim': {
          const params = step.mode === 'twoSensor'
            ? `max ${step.maxDistanceMm} mm, two-sensor differential, kp=${step.kp}, kd=${step.kd}`
            : `max ${step.maxDistanceMm} mm, target_reflection=${step.targetReflection}, side="${step.side || 'left'}", kp=${step.kp}, kd=${step.kd}`;
          L.push(`# --- ${note}: add your line-following drive here (params: ${params}) ---`);
          break;
        }
        case 'setHeading':
          L.push(`hub.imu.reset_heading(${step.heading})  # ${note}`);
          break;
        case 'frontMotor': {
          const signed = step.action === 'drop' ? -Math.abs(step.degrees) : Math.abs(step.degrees);
          L.push(`front_motor.run_angle(${step.speedDegS || 200}, ${signed}, then=Stop.HOLD)  # ${note}`);
          break;
        }
        case 'backMotor': {
          const signed = step.action === 'drop' ? -Math.abs(step.degrees) : Math.abs(step.degrees);
          L.push(`back_motor.run_angle(${step.speedDegS || 200}, ${signed}, then=Stop.HOLD)  # ${note}`);
          break;
        }
        case 'lineFollow':
          L.push(`# TODO line_follow(${step.distanceMm})  -- PyBricks has no built-in line follower;`);
          L.push(`#      implement using your colour/reflect sensor readings`);
          break;
        case 'pickupTool':
        case 'deliverTool':
        case 'pickupTile':
        case 'placeTile':
        case 'settleCement':
          L.push(`# --- ${note}: add your gripper/mechanism call here ---`);
          break;
        case 'wait':
          L.push(`wait(${Math.round(step.seconds * 1000)})  # ${note}`);
          break;
        case 'comment':
          L.push(`# ${step.text}`);
          break;
      }
    });

    return L.join('\n') + '\n';
  }

  // ---- Import: the reverse of generatePyBricks. Recognises real callables
  // (drive_base.straight/turn, motor.run_angle, wait) directly, and the
  // comment-only stubs generatePyBricks emits for actions with no real
  // PyBricks equivalent (pickup/place/deliver/settle/unfold/lineFollow) by
  // matching describeStep()'s own text -- that comment is the only place
  // those steps' parameters survive the export. Supports one level of
  // `for _ in range(N):` loops (indentation-based), since hand-written code
  // often repeats a pickup/drop sequence that way rather than listing it
  // out N times. Not a general Python parser -- anything it doesn't
  // recognise is reported as a warning and skipped, not guessed at.
  function extractConfigFromCode(lines) {
    const config = {};
    lines.forEach(line => {
      let m;
      if ((m = line.match(/left_motor\s*=\s*Motor\(Port\.(\w)\)/))) config.portLeft = m[1];
      if ((m = line.match(/right_motor\s*=\s*Motor\(Port\.(\w)\)/))) config.portRight = m[1];
      if ((m = line.match(/front_motor\s*=\s*Motor\(Port\.(\w)\)/))) config.portFront = m[1];
      if ((m = line.match(/back_motor\s*=\s*Motor\(Port\.(\w)\)/))) config.portBack = m[1];
      if ((m = line.match(/DriveBase\([^)]*wheel_diameter=([\d.]+)/))) config.wheelDiameter = parseFloat(m[1]);
      if ((m = line.match(/DriveBase\([^)]*axle_track=([\d.]+)/))) config.axleTrack = parseFloat(m[1]);
      // Only the header's combined settings() call (all four kwargs together)
      // describes the base config -- per-step overrides later in the file
      // always carry exactly one kwarg, so this pattern can't match those.
      if ((m = line.match(/drive_base\.settings\(straight_speed=([\d.]+),\s*straight_acceleration=([\d.]+),\s*turn_rate=([\d.]+),\s*turn_acceleration=([\d.]+)\)/))) {
        config.straightSpeed = parseFloat(m[1]);
        config.straightAcceleration = parseFloat(m[2]);
        config.turnRate = parseFloat(m[3]);
        config.turnAcceleration = parseFloat(m[4]);
      }
    });
    return config;
  }

  // Splits a Python call's argument-list string on top-level commas only
  // (doesn't split inside nested parens/brackets or the rare embedded
  // call) -- good enough for the plain numbers/strings/Color.X/True/False
  // arguments real robot code actually passes to a driving helper.
  function splitArgs(argStr) {
    const parts = [];
    let depth = 0, cur = '';
    for (let i = 0; i < argStr.length; i++) {
      const c = argStr[i];
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    if (cur.trim() !== '') parts.push(cur.trim());
    return parts;
  }
  function unquote(s) {
    const m = s && s.match(/^["'](.*)["']$/);
    return m ? m[1] : s;
  }
  // Pulls a plain colour name out of a PyBricks Color reference
  // (Color.BLACK -> "black") or a bare quoted/unquoted name, lowercased.
  function colourNameFromArg(arg) {
    if (!arg) return '';
    const m = arg.match(/Color\.(\w+)/);
    return (m ? m[1] : unquote(arg)).toLowerCase();
  }
  // Maps a "left"/"right" physical-sensor-name argument to which of this
  // simulator's two configurable sensor positions (A or B) it represents --
  // 'left' is always sensor A, 'right' is always sensor B, matching the
  // robot-config panel's own labelling.
  function sensorChoiceFromArg(arg, fallback) {
    if (arg === undefined) return fallback;
    const v = unquote(arg).toLowerCase();
    return v === 'right' ? 'B' : v === 'left' ? 'A' : fallback;
  }
  // Same idea but for a STOP-CONDITION sensor argument, which can also be
  // "both" or "either" (only "either" -- an OR of the two sensors -- needs
  // its own simulateLineFollow branch; "both" was already supported).
  function sensorCheckFromArg(arg, fallback) {
    if (arg === undefined) return fallback;
    const v = unquote(arg).toLowerCase();
    if (v === 'right') return 'B';
    if (v === 'left') return 'A';
    if (v === 'both') return 'both';
    if (v === 'either') return 'either';
    return fallback;
  }

  function parsePyBricksCode(code) {
    const TILE_COLOURS = (window.WRO_ELEMENTS && window.WRO_ELEMENTS.TILE_COLOURS) || ['white', 'green', 'blue', 'yellow'];
    const colourAlt = TILE_COLOURS.join('|');
    function toolIdByName(name) {
      if (!window.WRO_ELEMENTS) return name;
      const t = window.WRO_ELEMENTS.tools.find(t => t.name === name);
      return t ? t.id : name;
    }
    function countIndent(line) {
      return line.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
    }
    // Simple top-level numeric constants this file names for readability
    // (e.g. `line_center = 36.5`, `black_stop = 11 + 10`) and then passes
    // BY NAME into a recognised call later on. Without resolving these,
    // that argument would reach parseFloat() as the literal text
    // "line_center" and silently become NaN.
    const namedConstants = {};
    function resolveConst(argText) {
      const t = (argText || '').trim();
      return Object.prototype.hasOwnProperty.call(namedConstants, t) ? String(namedConstants[t]) : argText;
    }
    // A call, optionally with a trailing "# comment" this parser doesn't
    // need to read (arguments already carry everything it needs).
    function matchCall(codePart, fnName) {
      const m = codePart.match(new RegExp(`^${fnName}\\((.*)\\)$`));
      return m ? splitArgs(m[1]).map(resolveConst) : null;
    }
    // Resolves a raw splitArgs() list against the callee's OWN parameter
    // names, Python call semantics: positional args fill by order until
    // the first name=value keyword arg, then every remaining arg (in any
    // order) is a keyword filling that named slot -- needed because real
    // code freely skips optional params via keyword args instead of
    // always spelling every earlier one out positionally (e.g. this
    // file's own `dualLineFollowToIntersection(70, "right", 15, 100, 100,
    // stop_mode=Stop.HOLD)`, which leaves kp/kd at their defaults via a
    // gap, not by passing them explicitly).
    function namedCallArgs(rawArgs, paramNames) {
      const out = new Array(paramNames.length).fill(undefined);
      let i = 0;
      for (; i < rawArgs.length; i++) {
        if (/^\w+\s*=/.test(rawArgs[i])) break;
        if (i < paramNames.length) out[i] = rawArgs[i];
      }
      for (; i < rawArgs.length; i++) {
        const kw = rawArgs[i].match(/^(\w+)\s*=\s*([\s\S]*)$/);
        if (!kw) continue;
        const idx = paramNames.indexOf(kw[1]);
        if (idx !== -1) out[idx] = kw[2];
      }
      return out;
    }

    const allLines = code.replace(/\r\n/g, '\n').split('\n');
    const config = extractConfigFromCode(allLines);
    const warnings = []; // lines that produced no step -- unrecognised, or a call skipped outright
    const notes = [];    // lines that DID produce a step, but only an approximation of the real motion
    const halfAxleTrack = (config.axleTrack || 114) / 2;
    // Fallback distance bound for helpers that drive/follow until a sensor
    // trigger with no source distance argument at all -- generous enough
    // to not truncate a real run, just a simulator infinite-loop guard.
    const noLimitSafetyCapMm = 3000;
    // The line-following helpers below steer with motor.dc(), so their
    // `speed` argument is a 0-100 DUTY CYCLE PERCENTAGE, not mm/s (the
    // drive_base.drive()-based helpers' speed genuinely is mm/s). Taking a
    // duty figure as mm/s simulates e.g. "70" as a 70 mm/s crawl instead of
    // the ~380 mm/s it really produces, so convert here, at parse time,
    // the same way pivot radii are derived from axleTrack above. Sign is
    // preserved: a negative duty means driving in reverse.
    let dutyConvNoted = false;
    function dutySpeedToMmS(rawArg) {
      const duty = parseFloat(rawArg);
      if (!isFinite(duty)) return undefined;
      const mmS = dutyPctToMmS(Math.abs(duty), config) * (duty < 0 ? -1 : 1);
      if (!dutyConvNoted) {
        dutyConvNoted = true;
        notes.push(`Line-follow helpers steer with motor.dc(), so their speed argument is a duty-cycle percentage, not mm/s -- simulated by converting duty to ground speed against a ${(config.wheelDiameter || 56)} mm wheel at ${((config.motorMaxSpeedDegS) || 1000)} deg/s per 100% duty (e.g. ${duty}% -> ${Math.round(Math.abs(mmS))} mm/s). Tune "motor max speed" in Robot config if these segments run fast or slow against a real run.`);
      }
      return mmS;
    }

    // A full export carries this exact marker right before the real route --
    // skip straight past the docstring/imports/hub/motor boilerplate to the
    // first real step when it's present, instead of trying to itemise every
    // possible header line.
    const markerIdx = allLines.findIndex(l => l.trim() === '# --- Generated route ---');
    let start = 0;
    if (markerIdx !== -1) {
      start = markerIdx + 1;
      const skipExact = [
        '# turn(): positive = right/clockwise, negative = left/counter-clockwise',
        '# motors: positive = lift, negative = drop -- flip the sign if reversed on your build',
        '# (no steps added yet -- build a route in the planner, then re-export)',
        '',
      ];
      while (start < allLines.length && skipExact.includes(allLines[start].trim())) start++;
    }
    const lines = allLines;

    let activeSpeed = null, activeTurnRate = null;
    let inDocstring = false;
    // Cross-line state for patterns this app's export never emits but real
    // driver code does -- see the two lookahead-by-mutation notes below.
    let pendingArc = null;          // the just-parsed arc step, for the acc_angle line right after it
    let pendingOpenLoopDrive = null; // an open-loop drive_base.drive(speed, 0) call, waiting for its wait(ms)
    const motorAngle = {};          // attachment-motor variable name -> last absolute run_target() angle
    const motorSlots = [];          // first 2 distinct attachment-motor names seen, in order -> front/back
    const warnedExtraMotor = new Set();
    const definedFunctions = new Set(); // `def NAME(...):` names seen, so later bare NAME() calls can be
                                         // recognised as "known helper, presumably no motion" instead of
                                         // an unparseable line
    const capturedFunctionBodies = {};  // NAME -> { startIdx, baseIndent } for every def/async def seen --
                                         // lets a later run_task(NAME()) or multitask(..., NAME(), ...)
                                         // call re-parse that body FOR REAL instead of treating it as a
                                         // no-op helper call, since this file's own async/multitask
                                         // pattern is how it runs a drive alongside an attachment-motor
                                         // move (e.g. drive forward while lifting an arm).

    function attachmentMotorSlot(name) {
      let idx = motorSlots.indexOf(name);
      if (idx === -1 && motorSlots.length < 2) { motorSlots.push(name); idx = motorSlots.length - 1; }
      if (idx === -1) {
        if (!warnedExtraMotor.has(name)) {
          warnedExtraMotor.add(name);
          warnings.push(`"${name}" is a 3rd+ attachment motor -- the simulator only models 2 generic motor slots (front/back), its calls are skipped`);
        }
        return null;
      }
      return idx === 0 ? 'front' : 'back';
    }

    function parseSingle(rawTrimmed) {
      if (!rawTrimmed) return null;
      if (rawTrimmed === '"""') { inDocstring = !inDocstring; return null; }
      if (inDocstring) return null;

      const trimmed = rawTrimmed;
      // Code with any trailing "# comment" stripped, for matching calls by
      // their full argument list ($-anchored) -- comments themselves are
      // still matched against `trimmed` below, unaffected by this.
      // A leading "await " (this file's async helpers use it on every
      // motor/drive call inside a multitask()) carries no motion meaning
      // of its own -- stripped so every recognizer below still matches.
      const codePart = trimmed.replace(/\s*#.*$/, '').trim().replace(/^await\s+/, '');

      const prevArc = pendingArc; pendingArc = null;
      const prevOpenLoopDrive = pendingOpenLoopDrive; pendingOpenLoopDrive = null;

      let m, args;

      // ---- acc_angle bookkeeping right after a drive_base.arc() call --
      // some drivers track their own absolute heading alongside the gyro,
      // immediately after every arc() with `acc_angle += N` / `-= N`. That
      // line is the one place the *true* signed heading change for this
      // specific arc call is unambiguous -- PyBricks' own radius-sign
      // convention isn't reliably known here, so this is trusted over it.
      if (prevArc && /^acc_angle\s*[+\-]?=/.test(codePart)) {
        if ((m = codePart.match(/^acc_angle\s*\+=\s*(-?[\d.]+)/))) prevArc.degrees = parseFloat(m[1]);
        else if ((m = codePart.match(/^acc_angle\s*-=\s*(-?[\d.]+)/))) prevArc.degrees = -parseFloat(m[1]);
        return null; // absorbed into the arc step already pushed
      }

      // ---- open-loop drive_base.drive(speed, turn_rate) held for a fixed
      // wait(ms) then stopped, with no encoder/distance target -- this is
      // how teams commonly ram the mat's outer wall to hard-reset drift
      // ("squaring"), since driving open-loop with only a timer is
      // otherwise a strange thing to do. Modelled as 'squareToWall' rather
      // than a distance guess: the wall (and the robot's own edge, not its
      // centre) gives an exact stopping point once the direction of travel
      // is known, and ramming a flat wall genuinely does snap the chassis
      // heading to square -- so this is trusted MORE than a plain
      // speed x time estimate would be, not treated as a rough guess.
      if (prevOpenLoopDrive && (m = codePart.match(/^wait\((-?[\d.]+)\)/))) {
        const reverse = prevOpenLoopDrive.speed < 0;
        notes.push(`Recognised as a wall-square: open-loop drive_base.drive(${prevOpenLoopDrive.speed}, 0) held for ${parseFloat(m[1])} ms -- simulated as driving ${reverse ? 'backward' : 'forward'} to the wall ${reverse ? 'behind' : 'in front of'} the current heading and snapping heading to the nearest cardinal, not a distance estimate`);
        return { type: 'squareToWall', reverse };
      }

      if ((m = codePart.match(/^drive_base\.settings\(straight_speed=(-?[\d.]+)\)/))) { activeSpeed = parseFloat(m[1]); return null; }
      if ((m = codePart.match(/^drive_base\.settings\(turn_rate=(-?[\d.]+)\)/))) { activeTurnRate = parseFloat(m[1]); return null; }
      if (/^drive_base\.settings\(/.test(codePart)) return null; // combined header call, already read separately

      // hub.imu.reset_heading(X): re-anchors the gyro's absolute reference
      // to X without moving. Maps directly to a real callable, unlike most
      // of the stubs below, so it's recognised as a genuine step rather
      // than absorbed as harmless setup -- skipping it would let the
      // simulated heading silently drift out of sync with every relative
      // turn from this point on.
      if ((m = codePart.match(/^hub\.imu\.reset_heading\((-?[\d.]+)\)/))) {
        return { type: 'setHeading', heading: parseFloat(m[1]) };
      }

      if ((m = codePart.match(/^drive_base\.straight\((-?[\d.]+)\)/))) {
        const step = { type: 'drive', distanceMm: parseFloat(m[1]) };
        if (activeSpeed != null) step.speedMmS = activeSpeed;
        return step;
      }
      if ((m = codePart.match(/^drive_base\.turn\((-?[\d.]+)\)/))) {
        const v = parseFloat(m[1]);
        const step = { type: 'turn', direction: v < 0 ? 'left' : 'right', degrees: Math.abs(v) };
        if (activeTurnRate != null) step.turnRateDegS = activeTurnRate;
        return step;
      }
      // drive_base.arc(radius, angle): heading delta defaults to the angle
      // argument's own sign (matching turn()'s convention), then gets
      // corrected by a following acc_angle line above if there is one.
      if ((args = matchCall(codePart, 'drive_base\\.arc'))) {
        const radius = parseFloat(args[0]);
        const angle = parseFloat(args[1]);
        const step = { type: 'arc', radius, degrees: angle };
        pendingArc = step;
        notes.push(`Approximated: "${trimmed}" -- heading change trusted from this file's own acc_angle bookkeeping if present right after, but the curve's bow direction (which side it bulges toward) is a best guess, not a verified PyBricks convention`);
        return step;
      }
      // drive_base.drive(speed, turn_rate): only the straight case
      // (turn_rate ~ 0) can be approximated as a step; a curving open-loop
      // drive has no clean equivalent here.
      if ((args = matchCall(codePart, 'drive_base\\.drive'))) {
        const speed = parseFloat(args[0]);
        const turnRate = parseFloat(args[1]);
        if (Math.abs(turnRate) < 0.01) {
          pendingOpenLoopDrive = { speed };
        } else {
          warnings.push(`Could not simulate: "${trimmed}" -- open-loop curving drive (nonzero turn rate) has no fixed distance/angle`);
        }
        return null;
      }
      if (/^drive_base\.(stop|hold|brake)\(\)/.test(codePart)) return null; // no motion info on its own

      if ((m = codePart.match(/^front_motor\.run_angle\(([\d.]+)\s*,\s*(-?[\d.]+)/))) {
        const speedDegS = parseFloat(m[1]);
        const v = parseFloat(m[2]);
        return { type: 'frontMotor', action: v < 0 ? 'drop' : 'lift', degrees: Math.abs(v), speedDegS };
      }
      if ((m = codePart.match(/^back_motor\.run_angle\(([\d.]+)\s*,\s*(-?[\d.]+)/))) {
        const speedDegS = parseFloat(m[1]);
        const v = parseFloat(m[2]);
        return { type: 'backMotor', action: v < 0 ? 'drop' : 'lift', degrees: Math.abs(v), speedDegS };
      }
      if ((m = codePart.match(/^wait\((-?[\d.]+)\)/))) {
        return { type: 'wait', seconds: parseFloat(m[1]) / 1000 };
      }
      if ((m = codePart.match(/^#\s*TODO line_follow\((-?[\d.]+)\)/))) {
        return { type: 'lineFollow', distanceMm: parseFloat(m[1]) };
      }
      if (trimmed.startsWith('#      implement using')) return null; // 2nd line of the lineFollow stub

      // ---- Custom PID driving helpers (this specific driver's own
      // reusable functions, not a real PyBricks call): kept apart from the
      // real drive_base.*/motor.* calls above because their signatures
      // are call-site defined, not part of the PyBricks API. ----
      if ((args = matchCall(codePart, 'driveStraightPid'))) {
        const step = { type: 'drive', distanceMm: parseFloat(args[0]) };
        if (args[1] !== undefined) step.speedMmS = parseFloat(args[1]);
        return step; // target_heading (args[2], if any) is a gyro-lock target, not a path change
      }
      // lineFollowPid(distance_mm, speed, target_reflection, side, kp_start,
      // kd_start, kp_cruise, kd_cruise, kp_end, kd_end) -- args[6]/[7]
      // (kp_cruise/kd_cruise) are used as a single steady-state gain for
      // the whole segment; see simulateLineFollow's own comment for why
      // the 3-zone accel/cruise/decel profile isn't replicated exactly.
      if ((args = matchCall(codePart, 'lineFollowPid'))) {
        return {
          type: 'lineFollowSim',
          maxDistanceMm: parseFloat(args[0]),
          speedMmS: args[1] !== undefined ? parseFloat(args[1]) : undefined,
          targetReflection: args[2] !== undefined ? parseFloat(args[2]) : 50,
          side: args[3] !== undefined ? unquote(args[3]) : 'left',
          kp: parseFloat(args[6] !== undefined ? args[6] : (args[4] !== undefined ? args[4] : 1)),
          kd: parseFloat(args[7] !== undefined ? args[7] : (args[5] !== undefined ? args[5] : 3)),
        };
      }
      if ((args = matchCall(codePart, 'turnPid'))) {
        const v = parseFloat(args[0]);
        return { type: 'turn', direction: v < 0 ? 'left' : 'right', degrees: Math.abs(v) };
      }
      if ((args = matchCall(codePart, 'pivotTurnPid'))) {
        const angle = parseFloat(args[0]);
        const pivotWheel = args[2] !== undefined ? unquote(args[2]).toLowerCase() : 'left';
        const radius = pivotWheel === 'right' ? halfAxleTrack : -halfAxleTrack;
        return { type: 'arc', radius, degrees: angle };
      }
      if ((args = matchCall(codePart, 'driveStraightColorControl'))) {
        const distanceMm = parseFloat(args[1]);
        const step = { type: 'drive', distanceMm };
        if (args[2] !== undefined) step.speedMmS = parseFloat(args[2]);
        notes.push(`Approximated: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '…' : ''}" stops on a colour sensor trigger -- simulated using its max_distance_mm=${distanceMm} mm, real stopping point may differ`);
        return step;
      }
      // lineFollowColorStopPid(target_color, max_distance_mm, speed,
      // target_reflection, side, min_travel_dist, stop_sensor,
      // stop_on_loss, kp_start, kd_start, kp_cruise, kd_cruise, kp_end,
      // kd_end) -- steers on reflectance like lineFollowPid, but stops
      // early on a real simulated colour match instead of only a coded
      // distance cap (max_distance_mm becomes a safety bound, not the
      // usual target).
      if ((args = matchCall(codePart, 'lineFollowColorStopPid'))) {
        const colourName = args[0] !== undefined ? colourNameFromArg(args[0]) : null;
        const step = {
          type: 'lineFollowSim',
          maxDistanceMm: parseFloat(args[1]),
          speedMmS: args[2] !== undefined ? parseFloat(args[2]) : undefined,
          targetReflection: args[3] !== undefined ? parseFloat(args[3]) : 50,
          side: args[4] !== undefined ? unquote(args[4]) : 'left',
          minTravelDistMm: args[5] !== undefined ? parseFloat(args[5]) : 0,
          stopOnLoss: args[7] !== undefined ? unquote(args[7]) === 'True' : false,
          kp: parseFloat(args[10] !== undefined ? args[10] : (args[8] !== undefined ? args[8] : 1)),
          kd: parseFloat(args[11] !== undefined ? args[11] : (args[9] !== undefined ? args[9] : 3)),
        };
        if (colourName && isRecognisedStopColour(colourName)) {
          step.stopColour = colourName;
          notes.push(`Approximated: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '…' : ''}" -- colour match is a brightness/hue approximation (see simulateLineFollow), not this file's exact Color.${colourName.toUpperCase()} calibration`);
        } else {
          // no matchable target colour -- maxDistanceMm (already set above) is just a hard cap, no early stop
          notes.push(`Approximated: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '…' : ''}" stops on a colour sensor trigger that couldn't be matched to a recognised colour -- simulated using its max_distance_mm=${step.maxDistanceMm} mm as a hard cap instead`);
        }
        return step;
      }

      // ---- A second driver's own custom helper library -- same idea as
      // the block above, but this one additionally distinguishes WHICH
      // physical colour sensor position does the reading (`sensor`, mapped
      // to sensorChoice/stopSensorCheck below) from `side`, the steering
      // polarity (which edge of tape to track) -- two genuinely separate
      // concepts this file's functions keep apart. ----
      // Every recognizer below resolves its raw args through
      // namedCallArgs() against the callee's real parameter names (taken
      // straight from this driver's source), not bare positional indices --
      // real call sites here mix positional args with trailing name=value
      // keywords that skip earlier optional params (see namedCallArgs's own
      // comment), so positional-only indexing silently misreads those.
      if ((args = matchCall(codePart, 'drive_straightMulti'))) {
        const a = namedCallArgs(args, ['distance', 'speed', 'acceleration']);
        const step = { type: 'drive', distanceMm: parseFloat(a[0]) };
        if (a[1] !== undefined) step.speedMmS = parseFloat(a[1]);
        return step;
      }
      if ((args = matchCall(codePart, 'drive_straight'))) {
        const a = namedCallArgs(args, ['distance', 'speed', 'acceleration']);
        const step = { type: 'drive', distanceMm: parseFloat(a[0]) };
        if (a[1] !== undefined) step.speedMmS = parseFloat(a[1]);
        return step;
      }
      if ((args = matchCall(codePart, 'turn_angle'))) {
        const a = namedCallArgs(args, ['angle', 'turn_rate', 'turn_acceleration']);
        const v = parseFloat(a[0]);
        const step = { type: 'turn', direction: v < 0 ? 'left' : 'right', degrees: Math.abs(v) };
        if (a[1] !== undefined) step.turnRateDegS = parseFloat(a[1]);
        return step;
      }
      // pivot_turn/pivot_turn2 both lock one wheel and drive the other to
      // sweep a fixed angle -- an exact single-wheel-pivot arc regardless
      // of which control loop (gyro-wait vs trapezoidal profile) gets it
      // there, same as pivotTurnPid above.
      if ((args = matchCall(codePart, 'pivot_turn2'))) {
        const a = namedCallArgs(args, ['angle', 'speed', 'accel', 'pivot_side', 'stop_mode', 'tolerance', 'timeout']);
        const angle = parseFloat(a[0]);
        const pivotWheel = a[3] !== undefined ? unquote(a[3]).toLowerCase() : 'left';
        const radius = pivotWheel === 'right' ? halfAxleTrack : -halfAxleTrack;
        return { type: 'arc', radius, degrees: angle };
      }
      if ((args = matchCall(codePart, 'pivot_turn'))) {
        const a = namedCallArgs(args, ['angle', 'speed', 'pivot_side', 'stop_mode']);
        const angle = parseFloat(a[0]);
        const pivotWheel = a[2] !== undefined ? unquote(a[2]).toLowerCase() : 'left';
        const radius = pivotWheel === 'right' ? halfAxleTrack : -halfAxleTrack;
        return { type: 'arc', radius, degrees: angle };
      }
      // drive_until_color/drive_until_color2: drive dead straight (open-loop
      // turn_rate=0, or gyro-held at a locked heading -- both amount to no
      // net turn) until a colour sensor trips. Modelled as a zero-gain
      // "line follow" so it reuses the same pixel-based colour-stop logic
      // (and negative-speed support) as every other stop-on-colour helper,
      // while never actually steering. Neither function has a source
      // distance bound, so both get a generous simulator safety cap.
      if ((args = matchCall(codePart, 'drive_until_color2'))) {
        const a = namedCallArgs(args, ['target_color', 'speed', 'min_distance_mm', 'sensor', 'stop_mode', 'target_heading', 'kp_gyro', 'timeout']);
        const colourName = a[0] !== undefined ? colourNameFromArg(a[0]) : null;
        const step = {
          type: 'lineFollowSim', mode: 'single', kp: 0, kd: 0, targetReflection: 50, side: 'left',
          sensorChoice: sensorChoiceFromArg(a[3], 'A'),
          speedMmS: a[1] !== undefined ? parseFloat(a[1]) : undefined,
          minTravelDistMm: a[2] !== undefined ? parseFloat(a[2]) : 0,
          stopSensorCheck: sensorCheckFromArg(a[3], 'A'),
          maxDistanceMm: noLimitSafetyCapMm,
        };
        if (colourName && isRecognisedStopColour(colourName)) {
          step.stopColour = colourName;
        }
        notes.push(`Approximated: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '…' : ''}" -- no source distance bound, drives straight (gyro heading-lock simplified to holding current heading) until its colour trigger, capped at ${noLimitSafetyCapMm} mm as a simulator safety limit`);
        return step;
      }
      if ((args = matchCall(codePart, 'drive_until_color'))) {
        const a = namedCallArgs(args, ['target_color', 'speed', 'min_distance_mm', 'sensor', 'stop_mode']);
        const colourName = a[0] !== undefined ? colourNameFromArg(a[0]) : null;
        const step = {
          type: 'lineFollowSim', mode: 'single', kp: 0, kd: 0, targetReflection: 50, side: 'left',
          sensorChoice: sensorChoiceFromArg(a[3], 'A'),
          speedMmS: a[1] !== undefined ? parseFloat(a[1]) : undefined,
          minTravelDistMm: a[2] !== undefined ? parseFloat(a[2]) : 0,
          stopSensorCheck: sensorCheckFromArg(a[3], 'A'),
          maxDistanceMm: noLimitSafetyCapMm,
        };
        if (colourName && isRecognisedStopColour(colourName)) {
          step.stopColour = colourName;
        }
        notes.push(`Approximated: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '…' : ''}" -- no source distance bound, drives straight until its colour trigger, capped at ${noLimitSafetyCapMm} mm as a simulator safety limit`);
        return step;
      }
      // dualLineFollowToIntersection: two-sensor differential line following
      // (see simulateLineFollow's twoSensor mode) that stops when the named
      // sensor(s) cross a reflectance threshold (e.g. a perpendicular black
      // line) -- no source distance bound either, same safety cap.
      if ((args = matchCall(codePart, 'dualLineFollowToIntersection'))) {
        const a = namedCallArgs(args, ['speed', 'intersection', 'black_threshold', 'min_distance_mm', 'accel_distance_mm', 'kp', 'kd', 'stop_mode']);
        const step = {
          type: 'lineFollowSim', mode: 'twoSensor',
          speedMmS: a[0] !== undefined ? dutySpeedToMmS(a[0]) : undefined,
          dutyPct: a[0] !== undefined ? parseFloat(a[0]) : undefined,
          stopSensorCheck: sensorCheckFromArg(a[1], 'both'),
          stopReflectBelow: a[2] !== undefined ? parseFloat(a[2]) : 15,
          minTravelDistMm: a[3] !== undefined ? parseFloat(a[3]) : 0,
          kp: parseFloat(a[5] !== undefined ? a[5] : 0.8),
          kd: parseFloat(a[6] !== undefined ? a[6] : 2.0),
          maxDistanceMm: noLimitSafetyCapMm,
        };
        notes.push(`Approximated: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '…' : ''}" -- no source distance bound, follows the line until its cross-line trigger, capped at ${noLimitSafetyCapMm} mm as a simulator safety limit`);
        return step;
      }
      // dualLineFollow: two-sensor differential line following for a fixed
      // distance, no stop trigger -- a real bound, no safety cap needed.
      if ((args = matchCall(codePart, 'dualLineFollow'))) {
        const a = namedCallArgs(args, ['distance_mm', 'speed', 'kp', 'kd', 'stop_mode']);
        return {
          type: 'lineFollowSim', mode: 'twoSensor',
          maxDistanceMm: parseFloat(a[0]),
          speedMmS: a[1] !== undefined ? dutySpeedToMmS(a[1]) : undefined,
          dutyPct: a[1] !== undefined ? parseFloat(a[1]) : undefined,
          kp: parseFloat(a[2] !== undefined ? a[2] : 0.8),
          kd: parseFloat(a[3] !== undefined ? a[3] : 2.0),
        };
      }
      // singleLineFollowToIntersection/singleLineFollowPid: single-sensor
      // edge following for a fixed (safety-bound) distance -- `side` is
      // steering polarity, `sensor` is WHICH physical sensor position does
      // the reading, mapped to sensorChoice. ToIntersection additionally
      // stops when the OPPOSITE sensor crosses a reflectance threshold.
      // Neither function's integral gain (ki) has an equivalent in the
      // simulator's PD-only loop.
      if ((args = matchCall(codePart, 'singleLineFollowToIntersection'))) {
        const a = namedCallArgs(args, ['distance_mm', 'speed', 'target_reflection', 'side', 'sensor', 'black_threshold', 'min_distance_mm', 'stop_mode', 'kp', 'kd', 'ki']);
        const trackChoice = sensorChoiceFromArg(a[4], 'A');
        return {
          type: 'lineFollowSim', mode: 'single',
          maxDistanceMm: parseFloat(a[0]),
          speedMmS: a[1] !== undefined ? dutySpeedToMmS(a[1]) : undefined,
          dutyPct: a[1] !== undefined ? parseFloat(a[1]) : undefined,
          targetReflection: a[2] !== undefined ? parseFloat(a[2]) : 50,
          side: a[3] !== undefined ? unquote(a[3]) : 'left',
          sensorChoice: trackChoice,
          stopReflectBelow: a[5] !== undefined ? parseFloat(a[5]) : 18,
          minTravelDistMm: a[6] !== undefined ? parseFloat(a[6]) : 0,
          stopSensorCheck: trackChoice === 'B' ? 'A' : 'B',
          kp: parseFloat(a[8] !== undefined ? a[8] : 1.0),
          kd: parseFloat(a[9] !== undefined ? a[9] : 4.0),
        };
      }
      if ((args = matchCall(codePart, 'singleLineFollowPid'))) {
        const a = namedCallArgs(args, ['distance_mm', 'speed', 'target_reflection', 'side', 'sensor', 'stop_mode', 'kp', 'kd', 'ki']);
        return {
          type: 'lineFollowSim', mode: 'single',
          maxDistanceMm: parseFloat(a[0]),
          speedMmS: a[1] !== undefined ? dutySpeedToMmS(a[1]) : undefined,
          dutyPct: a[1] !== undefined ? parseFloat(a[1]) : undefined,
          targetReflection: a[2] !== undefined ? parseFloat(a[2]) : 50,
          side: a[3] !== undefined ? unquote(a[3]) : 'left',
          sensorChoice: sensorChoiceFromArg(a[4], 'A'),
          kp: parseFloat(a[6] !== undefined ? a[6] : 1.0),
          kd: parseFloat(a[7] !== undefined ? a[7] : 4.0),
        };
      }

      // ---- Attachment motors driven by absolute-angle run_target() calls
      // (not the relative run_angle() PyBricks export uses) -- track each
      // named motor's running angle so a call can be turned into a
      // relative lift/drop step. The first 2 distinct motor variable
      // names seen (that aren't the drive wheels) claim the simulator's
      // 2 generic front/back slots. ----
      if ((m = codePart.match(/^(\w+)\.run_target\(\s*([\d.]+)\s*,\s*(-?[\d.]+)/))) {
        const [, motorVar, speedStr, angleStr] = m;
        if (motorVar === 'left_motor' || motorVar === 'right_motor') return null; // drive wheels, not an attachment
        const targetAngle = parseFloat(angleStr);
        const prevAngle = motorAngle[motorVar] || 0;
        motorAngle[motorVar] = targetAngle;
        const delta = targetAngle - prevAngle;
        if (delta === 0) return null;
        const slot = attachmentMotorSlot(motorVar);
        if (!slot) return null; // warned once already, above
        const speedDegS = parseFloat(speedStr);
        return { type: slot === 'front' ? 'frontMotor' : 'backMotor', action: delta < 0 ? 'drop' : 'lift', degrees: Math.abs(delta), speedDegS };
      }
      if ((m = codePart.match(/^(\w+)\.(run_until_stalled|dc)\(/))) {
        if (m[1] !== 'left_motor' && m[1] !== 'right_motor') {
          warnings.push(`Could not simulate: "${trimmed}" -- ${m[2]}() has no fixed target angle`);
        }
        return null;
      }
      if (/^\w+\.(hold|brake)\(\)/.test(codePart)) return null; // e.g. left_motor.hold() -- no motion info

      // Comment-only action stubs: "# --- <note>: add your ... call here ---"
      if ((m = trimmed.match(/^#\s*---\s*(.+?):\s*add your (?:unfolding mechanism|gripper\/mechanism|wall-squaring drive) call here\s*---/))) {
        const note = m[1];
        let n;
        if (note === 'Unfold to open size') return { type: 'unfold' };
        if (note.startsWith('Drive into wall to square')) return { type: 'squareToWall', reverse: note.startsWith('Drive into wall to square (reverse)') };
        if ((n = note.match(new RegExp(`^Pick up (${colourAlt}) tile$`)))) return { type: 'pickupTile', colour: n[1] };
        if ((n = note.match(/^Place tile in frame slot (\d+)$/))) return { type: 'placeTile', slot: parseInt(n[1], 10) - 1 };
        if ((n = note.match(new RegExp(`^Settle (\\d+)\\u00d7 (${colourAlt}) cement$`)))) return { type: 'settleCement', count: parseInt(n[1], 10), colour: n[2] };
        if ((n = note.match(/^Pick up (.+)$/))) return { type: 'pickupTool', toolId: toolIdByName(n[1]) };
        if ((n = note.match(/^Deliver (.+)$/))) return { type: 'deliverTool', toolId: toolIdByName(n[1]) };
        warnings.push(`Unrecognised action stub: "${trimmed}"`);
        return null;
      }

      if (codePart === '') { // a whole-line comment, not a code+trailing-comment line
        if (trimmed.startsWith('#')) return { type: 'comment', text: trimmed.replace(/^#\s?/, '') };
        return null;
      }

      // A lone closing paren/bracket -- the tail end of a multi-line call
      // this line-based parser can't reconstruct (e.g. a settings(...)
      // call spread over several lines). Deliberately narrow: only a bare
      // ")"/"]" line is silenced here, not anything ending in "," or "(" --
      // those still fall through to a warning below if nothing else claims
      // them, since silently swallowing an unrecognised multi-line MOTION
      // call would lose a real step with no signal at all, which is worse
      // than one extra warning for a multi-line settings() header.
      if (/^[)\]]+$/.test(codePart)) return null;

      // A bare call to a function this file defines itself (e.g. a debug
      // print helper like HeadingCheck()) -- its body was intentionally
      // never analysed, so assume no motion rather than guess.
      if ((m = codePart.match(/^(\w+)\([^)]*\)$/)) && definedFunctions.has(m[1])) return null;
      if (/^print\(/.test(codePart)) return null;

      // A named numeric constant (see namedConstants above) -- captured for
      // later calls that reference it by name, not a motion of its own.
      // Restricted to a tight arithmetic-only character class before
      // evaluating, so this can never execute anything but +-*/() on
      // numeric literals (never a match for Color.X = ..., voltage =
      // hub.battery.voltage(), or anything else with a letter on the right).
      if ((m = codePart.match(/^([A-Za-z_]\w*)\s*=\s*([\d.\s+\-*/()]+)$/))) {
        try {
          const value = Function(`"use strict"; return (${m[2]});`)();
          if (typeof value === 'number' && isFinite(value)) namedConstants[m[1]] = value;
        } catch { /* not a plain arithmetic expression -- ignore */ }
        return null;
      }

      // Boilerplate / setup safety net: imports, hub/sensor/motor
      // construction, plain variable assignments (Color.X = ..., voltage =
      // ..., acc_angle = 0, ...) -- none of these describe robot motion.
      if (/^(#!|from |import |hub\s*=|left_motor\s*=|right_motor\s*=|front_motor\s*=\s*Motor|back_motor\s*=\s*Motor|drive_base\s*=\s*DriveBase|#\s*---\s*Generated route|Written for|Generated by|Check motor ports|PrimeHub for)/.test(trimmed)) return null;
      if (/^[\w.\[\]]+(\s*\+=|\s*-=|\s*=(?!=))/.test(codePart)) return null; // generic assignment
      if (/^[\w.]+\.\w+\([^)]*\)$/.test(codePart) && !/run_target|run_angle/.test(codePart)) return null; // other harmless setup calls, e.g. sensor.detectable_colors(...) -- drive_base.*/motor run_* calls are all already matched above, so only near-misses of those two reach here to warn instead of vanish

      if (trimmed.startsWith('#')) return { type: 'comment', text: trimmed.replace(/^#\s?/, '') };

      warnings.push(`Could not parse line: "${trimmed}"`);
      return null;
    }

    // Advances past an entire indented block without parsing any of its
    // lines as steps -- used for `def`/`while`/`if`/etc bodies, which
    // aren't part of the linear route (a function's body runs only when
    // called, and this parser doesn't trace calls into it; a while/if
    // body's lines are out of context without the condition they're
    // gated on).
    function skipBlockBody(startIdx, baseIndent) {
      let i = startIdx;
      while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed === '') { i++; continue; }
        if (countIndent(lines[i]) < baseIndent) break;
        i++;
      }
      return i;
    }

    // Gathers a (possibly multi-line) multitask(...) call's raw text
    // starting at startIdx by tracking paren depth across lines until it
    // returns to 0, then splits the inside on top-level commas -- same
    // idea as splitArgs, just spanning several physical lines first.
    function collectMultitaskArgs(startIdx) {
      let text = '';
      let depth = 0, started = false, i = startIdx;
      for (; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
          if (ch === '(') { depth++; started = true; }
          else if (ch === ')') depth--;
        }
        text += line + '\n';
        if (started && depth === 0) { i++; break; }
      }
      const m = text.match(/multitask\(([\s\S]*)\)\s*$/);
      return { args: m ? splitArgs(m[1].trim()).map(resolveConst) : [], nextIdx: i };
    }
    // A bare zero-arg call to a captured def/async def -- resolves to that
    // function's own steps by re-parsing its captured body, instead of a
    // no-op or an unparseable-line warning. Depth-guarded against runaway
    // recursion on a pathological/circular input file.
    let inlineDepth = 0;
    function tryInlineUserFunctionCall(cleanedExpr) {
      const m = cleanedExpr.match(/^(\w+)\(\)$/);
      if (!m) return null;
      const body = capturedFunctionBodies[m[1]];
      if (!body || inlineDepth > 8) return null;
      inlineDepth++;
      const { steps } = parseBlock(body.startIdx, body.baseIndent);
      inlineDepth--;
      return steps;
    }

    function parseBlock(startIdx, baseIndent) {
      const steps = [];
      let i = startIdx;
      while (i < lines.length) {
        const raw = lines[i];
        const trimmed = raw.trim();
        if (trimmed === '') { i++; continue; }
        const indent = countIndent(raw);
        if (indent < baseIndent) break;

        const forMatch = trimmed.match(/^for\s+\w+\s+in\s+range\((\d+)\):$/);
        if (forMatch) {
          const count = parseInt(forMatch[1], 10);
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j >= lines.length) { i = j; continue; }
          const innerIndent = countIndent(lines[j]);
          const { steps: bodySteps, nextIdx } = parseBlock(j, innerIndent);
          for (let r = 0; r < count; r++) bodySteps.forEach(s => steps.push(Object.assign({}, s)));
          i = nextIdx;
          continue;
        }

        const defMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
        if (defMatch) definedFunctions.add(defMatch[1]);

        const blockMatch = trimmed.match(/^(?:async\s+)?(def|class|while|if|elif|else|try|except|finally|with)\b.*:\s*(#.*)?$/);
        if (blockMatch) {
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length && countIndent(lines[j]) > indent) {
            if (defMatch) capturedFunctionBodies[defMatch[1]] = { startIdx: j, baseIndent: countIndent(lines[j]) };
            const nextIdx = skipBlockBody(j, countIndent(lines[j]));
            if (blockMatch[1] !== 'def') {
              warnings.push(`Skipped block (not traced): "${trimmed}" -- ${nextIdx - i - 1} line(s) inside`);
            }
            i = nextIdx;
            continue;
          }
          // no indented body followed (e.g. file/scope ends right after) --
          // just skip the header line itself
          i++;
          continue;
        }

        // multitask(a, b, ...): this file's own convention for running an
        // attachment-motor move alongside a drive (e.g. lift the arm WHILE
        // driving forward) -- can't truly overlap two steps here, so each
        // argument becomes its own sequential step instead. Each argument
        // is itself a call, possibly to another captured async helper
        // (open_grab_lift_move() nests open_grab_lift() this way), so it's
        // resolved the same way run_task() below resolves its target.
        const multitaskMatch = trimmed.match(/^(?:await\s+)?multitask\(/);
        if (multitaskMatch) {
          const { args: rawArgs, nextIdx } = collectMultitaskArgs(i);
          rawArgs.forEach((argExpr) => {
            const cleaned = argExpr.replace(/\s+/g, ' ').trim();
            if (!cleaned) return;
            const inlined = tryInlineUserFunctionCall(cleaned);
            if (inlined) { steps.push(...inlined); return; }
            // A null result here is treated exactly like a null result from
            // a top-level statement (silently skipped, no warning) -- it's
            // very often a legitimate no-op, e.g. an attachment motor
            // already sitting at its target angle from an earlier call
            // (delta === 0), not an unparseable line.
            const step = parseSingle(cleaned);
            if (step) steps.push(step);
          });
          i = nextIdx;
          continue;
        }

        // run_task(NAME()): actually runs the named async function -- if
        // its body was captured above, re-parse it for real (recursively
        // resolving any multitask()/nested run_task-style calls inside)
        // instead of leaving it as an unparseable line.
        const runTaskMatch = trimmed.match(/^run_task\((\w+)\(\)\)$/);
        if (runTaskMatch) {
          const inlined = tryInlineUserFunctionCall(`${runTaskMatch[1]}()`);
          if (inlined) steps.push(...inlined);
          else warnings.push(`Could not parse line: "${trimmed}" -- run_task() target function body wasn't found`);
          i++;
          continue;
        }

        // run_with_arm(arm_motor, arm_speed, arm_target_angle,
        // target_function, *args): this file's OTHER way of moving an
        // attachment motor in the background while something else runs --
        // same idea as multitask() above (arm move + one more call, both
        // become sequential steps), just spelled as a single call with the
        // "something else" passed in as a function reference instead of
        // an async def. Rebuilds the two calls as plain text
        // (arm_motor.run_target(...) and target_function(*args)) and
        // resolves each exactly like a multitask() argument.
        const runWithArmMatch = trimmed.match(/^run_with_arm\((.*)\)$/);
        if (runWithArmMatch) {
          const rawArgs = splitArgs(runWithArmMatch[1]).map(resolveConst);
          const [armMotorVar, armSpeed, armAngle, fnName, ...fnArgs] = rawArgs;
          const calls = [`${armMotorVar}.run_target(${armSpeed}, ${armAngle}, Stop.HOLD)`];
          if (fnName) calls.push(`${fnName}(${fnArgs.join(', ')})`);
          calls.forEach((cleaned) => {
            const inlined = tryInlineUserFunctionCall(cleaned);
            if (inlined) { steps.push(...inlined); return; }
            const step = parseSingle(cleaned);
            if (step) steps.push(step);
          });
          i++;
          continue;
        }

        const step = parseSingle(trimmed);
        if (step) steps.push(step);
        i++;
      }
      return { steps, nextIdx: i };
    }

    const { steps } = parseBlock(start, 0);
    return { steps, warnings, notes, config };
  }

  function init(tools) {
    const section = document.getElementById('programSection');
    if (!section) return;

    const state = loadState();
    let renderWalker = function() {}; // replaced once the walker section below initialises

    // Snapshot steps + robot placement before a mutation, so Ctrl+Z / Ctrl+Y
    // (window.WRO_HISTORY, shared with the measurement tools) can step back
    // and forth through route edits. Navigation (prev/next/reset step index)
    // deliberately isn't tracked here -- only actual edits are.
    function cloneProgramState() {
      return {
        steps: JSON.parse(JSON.stringify(state.steps)),
        walkerStart: state.walker.start ? Object.assign({}, state.walker.start) : null,
        walkerStepIndex: state.walker.stepIndex,
      };
    }
    function pushHistory() {
      if (!window.WRO_HISTORY) return;
      window.WRO_HISTORY.snapshot({
        label: 'program',
        data: cloneProgramState(),
        restore(target) {
          const prev = cloneProgramState();
          state.steps = JSON.parse(JSON.stringify(target.steps));
          state.walker.start = target.walkerStart ? Object.assign({}, target.walkerStart) : null;
          state.walker.stepIndex = target.walkerStepIndex;
          persist(state);
          render();
          placeBtn.textContent = state.walker.start ? '📍 Re-place robot' : '📍 Place robot on mat';
          return prev;
        },
      });
    }

    // ---- robot config ----
    const configToggle = document.getElementById('programConfigToggle');
    const configBox = document.getElementById('programConfig');
    const wheelInput = document.getElementById('cfgWheelDiameter');
    const axleInput = document.getElementById('cfgAxleTrack');
    const portLeft = document.getElementById('cfgPortLeft');
    const portRight = document.getElementById('cfgPortRight');
    const portFront = document.getElementById('cfgPortFront');
    const portBack = document.getElementById('cfgPortBack');
    const straightSpeedInput = document.getElementById('cfgStraightSpeed');
    const straightAccelInput = document.getElementById('cfgStraightAccel');
    const turnRateInput = document.getElementById('cfgTurnRate');
    const turnAccelInput = document.getElementById('cfgTurnAccel');
    const lineSensorForwardInput = document.getElementById('cfgLineSensorForward');
    const lineSensorLateralInput = document.getElementById('cfgLineSensorLateral');
    const lineSensor2ForwardInput = document.getElementById('cfgLineSensor2Forward');
    const lineSensor2LateralInput = document.getElementById('cfgLineSensor2Lateral');
    const lineSteerGainInput = document.getElementById('cfgLineSteerGain');
    const wheelForwardOffsetInput = document.getElementById('cfgWheelForwardOffset');
    const motorMaxSpeedInput = document.getElementById('cfgMotorMaxSpeed');

    [portLeft, portRight, portFront, portBack].forEach(sel => {
      PORTS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = `Port ${p}`;
        sel.appendChild(opt);
      });
    });
    wheelInput.value = state.config.wheelDiameter;
    axleInput.value = state.config.axleTrack;
    portLeft.value = state.config.portLeft;
    portRight.value = state.config.portRight;
    portFront.value = state.config.portFront;
    portBack.value = state.config.portBack;
    straightSpeedInput.value = state.config.straightSpeed;
    straightAccelInput.value = state.config.straightAcceleration;
    turnRateInput.value = state.config.turnRate;
    turnAccelInput.value = state.config.turnAcceleration;
    if (lineSensorForwardInput) lineSensorForwardInput.value = state.config.lineSensorForwardMm;
    if (lineSensorLateralInput) lineSensorLateralInput.value = state.config.lineSensorLateralMm;
    if (lineSensor2ForwardInput) lineSensor2ForwardInput.value = state.config.lineSensor2ForwardMm;
    if (lineSensor2LateralInput) lineSensor2LateralInput.value = state.config.lineSensor2LateralMm;
    if (lineSteerGainInput) lineSteerGainInput.value = state.config.lineFollowSteerGain;
    if (wheelForwardOffsetInput) wheelForwardOffsetInput.value = state.config.wheelForwardOffsetMm;
    if (motorMaxSpeedInput) motorMaxSpeedInput.value = state.config.motorMaxSpeedDegS;

    function syncConfig() {
      state.config = {
        wheelDiameter: parseFloat(wheelInput.value) || 56,
        axleTrack: parseFloat(axleInput.value) || 114,
        portLeft: portLeft.value, portRight: portRight.value,
        portFront: portFront.value, portBack: portBack.value,
        straightSpeed: parseFloat(straightSpeedInput.value) || 200,
        straightAcceleration: parseFloat(straightAccelInput.value) || 400,
        turnRate: parseFloat(turnRateInput.value) || 100,
        turnAcceleration: parseFloat(turnAccelInput.value) || 300,
        lineSensorForwardMm: lineSensorForwardInput ? (parseFloat(lineSensorForwardInput.value) || 0) : DEFAULT_LINE_CONFIG.lineSensorForwardMm,
        lineSensorLateralMm: lineSensorLateralInput ? (parseFloat(lineSensorLateralInput.value) || 0) : DEFAULT_LINE_CONFIG.lineSensorLateralMm,
        lineSensor2ForwardMm: lineSensor2ForwardInput ? (parseFloat(lineSensor2ForwardInput.value) || 0) : DEFAULT_LINE_CONFIG.lineSensor2ForwardMm,
        lineSensor2LateralMm: lineSensor2LateralInput ? (parseFloat(lineSensor2LateralInput.value) || 0) : DEFAULT_LINE_CONFIG.lineSensor2LateralMm,
        lineFollowSteerGain: lineSteerGainInput ? (parseFloat(lineSteerGainInput.value) || DEFAULT_LINE_CONFIG.lineFollowSteerGain) : DEFAULT_LINE_CONFIG.lineFollowSteerGain,
        wheelForwardOffsetMm: wheelForwardOffsetInput ? (parseFloat(wheelForwardOffsetInput.value) || 0) : 0,
        motorMaxSpeedDegS: motorMaxSpeedInput ? (parseFloat(motorMaxSpeedInput.value) || 1000) : (state.config.motorMaxSpeedDegS || 1000),
      };
      persist(state);
    }
    [wheelInput, axleInput, portLeft, portRight, portFront, portBack,
     straightSpeedInput, straightAccelInput, turnRateInput, turnAccelInput,
     lineSensorForwardInput, lineSensorLateralInput, lineSensor2ForwardInput, lineSensor2LateralInput, lineSteerGainInput,
     wheelForwardOffsetInput, motorMaxSpeedInput].filter(Boolean).forEach(el => {
      el.addEventListener('change', syncConfig);
    });

    configToggle.addEventListener('click', () => {
      configBox.style.display = configBox.style.display === 'none' ? '' : 'none';
    });

    // ---- mosaic frame pattern configurator (Senior-only: WRO_ELEMENTS is
    // undefined on the Elementary page) ----
    if (window.WRO_ELEMENTS) {
      const patternToggle = document.getElementById('mosaicPatternToggle');
      const patternBox = document.getElementById('mosaicPatternBox');
      const patternGrid = document.getElementById('mosaicPatternGrid');
      const CYCLE = ['empty', 'white', 'green', 'blue', 'yellow'];

      patternToggle.style.display = '';
      function renderPatternGrid() {
        patternGrid.innerHTML = '';
        state.mosaicPattern.forEach((colour, i) => {
          const btn = h('button', {
            type: 'button', class: 'mosaic-slot', 'data-colour': colour,
            title: `Slot ${i + 1}: ${colour === 'empty' ? 'not set' : colour} — click to cycle`,
          }, patternGrid);
          btn.textContent = colour === 'empty' ? String(i + 1) : '';
          btn.addEventListener('click', () => {
            const next = CYCLE[(CYCLE.indexOf(state.mosaicPattern[i]) + 1) % CYCLE.length];
            state.mosaicPattern[i] = next;
            persist(state);
            renderPatternGrid();
            renderWalker(); // re-checks already-placed tiles' correctness against the new pattern
          });
        });
      }
      renderPatternGrid();
      patternToggle.addEventListener('click', () => {
        patternBox.style.display = patternBox.style.display === 'none' ? '' : 'none';
      });

      // Rolls a fresh layout the same way the real event does -- a paper
      // pattern swapped in before the run -- rather than making you click
      // through 12 slots by hand every practice attempt.
      const randomBtn = document.getElementById('mosaicPatternRandomBtn');
      if (randomBtn) {
        randomBtn.addEventListener('click', () => {
          const colours = window.WRO_ELEMENTS.TILE_COLOURS;
          state.mosaicPattern = state.mosaicPattern.map(() => colours[Math.floor(Math.random() * colours.length)]);
          persist(state);
          renderPatternGrid();
          renderWalker();
        });
      }

      const frameSlotSel = document.getElementById('stepFrameSlot');
      window.WRO_ELEMENTS.frameSlots.forEach((slot, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `Slot ${i + 1}`;
        frameSlotSel.appendChild(opt);
      });
    }

    // ---- add-step row ----
    const typeSel = document.getElementById('stepType');
    const fields = Array.from(document.querySelectorAll('.program-field'));
    // 'lineFollowPath' draws its options from paths saved via the SAVE PATH
    // button (tools.js measurements, not this file's own state) -- shares
    // localStorage's 'wro2026-saved-paths' key with app.js's own
    // loadSavedPaths() rather than importing it, same loose-coupling
    // pattern already used for the scoring panel handoff.
    const SAVED_PATHS_KEY = 'wro2026-saved-paths';
    function loadSavedPathsForStep() {
      try {
        const raw = localStorage.getItem(SAVED_PATHS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    }
    const stepPathSelect = document.getElementById('stepPathSelect');
    function refreshPathSelect() {
      if (!stepPathSelect) return;
      const paths = loadSavedPathsForStep();
      const prev = stepPathSelect.value;
      stepPathSelect.innerHTML = '';
      if (!paths.length) {
        h('option', { value: '', text: '— no saved paths yet: draw+SAVE PATH first —' }, stepPathSelect);
        stepPathSelect.disabled = true;
        return;
      }
      stepPathSelect.disabled = false;
      paths.forEach(p => {
        h('option', { value: String(p.id), text: `${p.name} · ${p.totalMm.toFixed(0)} mm, ${p.points.length} pts` }, stepPathSelect);
      });
      if (paths.some(p => String(p.id) === prev)) stepPathSelect.value = prev;
    }
    function syncFields() {
      const t = typeSel.value;
      fields.forEach(f => {
        f.style.display = f.dataset.for.split(',').includes(t) ? '' : 'none';
      });
      if (t === 'lineFollowPath') refreshPathSelect();
    }
    typeSel.addEventListener('change', syncFields);
    syncFields();

    const distanceInput = document.getElementById('stepDistance');
    const speedInput = document.getElementById('stepSpeed');
    const degreesInput = document.getElementById('stepDegrees');
    const directionSel = document.getElementById('stepDirection');
    const stepTurnRateInput = document.getElementById('stepTurnRate');
    const motorActionSel = document.getElementById('stepMotorAction');
    const secondsInput = document.getElementById('stepSeconds');
    const commentInput = document.getElementById('stepComment');
    const stepPathReverse = document.getElementById('stepPathReverse');
    const stepArcPivot = document.getElementById('stepArcPivot');
    const stepArcRadiusField = document.getElementById('stepArcRadiusField');
    const stepArcRadius = document.getElementById('stepArcRadius');
    if (stepArcPivot && stepArcRadiusField) {
      const syncArcPivot = () => { stepArcRadiusField.style.display = stepArcPivot.value === 'custom' ? '' : 'none'; };
      stepArcPivot.addEventListener('change', syncArcPivot);
      syncArcPivot();
    }
    const stepLineMode = document.getElementById('stepLineMode');
    const stepLineSingleFields = document.getElementById('stepLineSingleFields');
    const stepLineMaxDist = document.getElementById('stepLineMaxDist');
    const stepLineTarget = document.getElementById('stepLineTarget');
    const stepLineSide = document.getElementById('stepLineSide');
    const stepLineKp = document.getElementById('stepLineKp');
    const stepLineKd = document.getElementById('stepLineKd');
    const stepLineStopColour = document.getElementById('stepLineStopColour');
    if (stepLineMode && stepLineSingleFields) {
      const syncLineMode = () => { stepLineSingleFields.style.display = stepLineMode.value === 'twoSensor' ? 'none' : ''; };
      stepLineMode.addEventListener('change', syncLineMode);
      syncLineMode();
    }
    // These only exist on the Senior page (index.html) -- null here on
    // Elementary, which is fine, since the dropdown there has no options
    // that reach the branches below that read them.
    const stepToolSel = document.getElementById('stepTool');
    const stepTileColourSel = document.getElementById('stepTileColour');
    const stepFrameSlotSel = document.getElementById('stepFrameSlot');
    const stepCementColourSel = document.getElementById('stepCementColour');
    const stepCementCountInput = document.getElementById('stepCementCount');

    const stepsList = document.getElementById('programSteps');
    const actionsBox = document.getElementById('programActions');
    const stepAddBtn = document.getElementById('stepAddBtn');

    // Where the NEXT "+ Add step" click inserts -- null means "append to
    // the end" (the old, only behaviour). Set by clicking an insert marker
    // between two existing steps, so a step can be added at the position
    // being looked at instead of always at the bottom of a long list.
    let insertAtIndex = null;
    let dragSrcIndex = null; // index currently being dragged, or null

    // Small status readout next to the (sticky) Add-step button, so it's
    // obvious where the next step will land -- created once, not on every
    // render, since it never needs to move.
    const insertStatus = h('span', { class: 'program-insert-status' }, null);
    stepAddBtn.parentElement.insertBefore(insertStatus, stepAddBtn);
    function updateInsertStatus() {
      if (insertAtIndex == null) { insertStatus.textContent = ''; insertStatus.style.display = 'none'; return; }
      insertStatus.style.display = '';
      insertStatus.textContent = `Inserting at step ${insertAtIndex + 1} — `;
      const cancel = h('a', { href: '#', text: 'add to end instead' }, insertStatus);
      cancel.addEventListener('click', (e) => { e.preventDefault(); insertAtIndex = null; render(); });
    }

    function moveStep(fromIndex, toIndex) {
      // toIndex is a marker position (0..length), i.e. "insert before the
      // step currently at this index" -- dropping a step next to itself
      // (either side) is a no-op, not a delete-and-reinsert.
      if (toIndex === fromIndex || toIndex === fromIndex + 1) return;
      pushHistory();
      const [moved] = state.steps.splice(fromIndex, 1);
      const adjusted = fromIndex < toIndex ? toIndex - 1 : toIndex;
      state.steps.splice(adjusted, 0, moved);
      insertAtIndex = null;
      persist(state); render();
    }

    // The thin strip between rows (and one above the first / below the
    // last) doubles as both an insert-position picker (click) and a drop
    // target for dragged rows -- one control, two ways to use it.
    function renderInsertMarker(atIndex) {
      const marker = h('li', {
        class: 'program-insert-marker' + (insertAtIndex === atIndex ? ' active' : ''),
        title: 'Click: add the next new step here. Or drag a step onto this line to move it here.',
      }, stepsList);
      h('span', { class: 'program-insert-plus', text: '+' }, marker);
      marker.addEventListener('click', () => {
        insertAtIndex = (insertAtIndex === atIndex) ? null : atIndex;
        render();
      });
      marker.addEventListener('dragover', (e) => { e.preventDefault(); marker.classList.add('drag-over'); });
      marker.addEventListener('dragleave', () => marker.classList.remove('drag-over'));
      marker.addEventListener('drop', (e) => {
        e.preventDefault();
        marker.classList.remove('drag-over');
        if (dragSrcIndex == null) return;
        moveStep(dragSrcIndex, atIndex);
      });
    }

    function render() {
      stepsList.innerHTML = '';
      actionsBox.style.display = state.steps.length ? '' : 'none';
      updateInsertStatus();
      renderInsertMarker(0);
      state.steps.forEach((step, idx) => {
        const li = h('li', { class: 'program-step' }, stepsList);
        li.draggable = true;
        li.addEventListener('dragstart', (e) => {
          dragSrcIndex = idx;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(idx)); // Firefox won't start a drag without data set
          requestAnimationFrame(() => li.classList.add('dragging')); // after the drag ghost image is captured
        });
        li.addEventListener('dragend', () => { li.classList.remove('dragging'); dragSrcIndex = null; });

        h('span', { class: 'program-step-num', text: String(idx + 1) }, li);
        h('span', { class: 'program-step-desc', text: describeStep(step) }, li);
        const actions = h('span', { class: 'program-step-actions' }, li);

        const up = h('button', { type: 'button', title: 'Move up' }, actions);
        up.textContent = '↑';
        up.disabled = idx === 0;
        up.addEventListener('click', () => {
          pushHistory();
          [state.steps[idx - 1], state.steps[idx]] = [state.steps[idx], state.steps[idx - 1]];
          insertAtIndex = null;
          persist(state); render();
        });

        const down = h('button', { type: 'button', title: 'Move down' }, actions);
        down.textContent = '↓';
        down.disabled = idx === state.steps.length - 1;
        down.addEventListener('click', () => {
          pushHistory();
          [state.steps[idx + 1], state.steps[idx]] = [state.steps[idx], state.steps[idx + 1]];
          insertAtIndex = null;
          persist(state); render();
        });

        const del = h('button', { type: 'button', title: 'Delete step', class: 'danger' }, actions);
        del.textContent = '×';
        del.addEventListener('click', () => {
          pushHistory();
          state.steps.splice(idx, 1);
          insertAtIndex = null;
          persist(state); render();
        });

        renderInsertMarker(idx + 1);
      });
      renderWalker();
    }
    render();

    stepAddBtn.addEventListener('click', () => {
      const t = typeSel.value;
      const step = { type: t };
      if (t === 'drive' || t === 'lineFollow') {
        step.distanceMm = parseFloat(distanceInput.value) || 0;
        if (t === 'drive') {
          const spd = parseFloat(speedInput.value);
          if (!isNaN(spd) && spd > 0) step.speedMmS = spd;
        }
      } else if (t === 'turn') {
        step.degrees = Math.abs(parseFloat(degreesInput.value) || 0);
        step.direction = directionSel.value;
        const rate = parseFloat(stepTurnRateInput.value);
        if (!isNaN(rate) && rate > 0) step.turnRateDegS = rate;
      } else if (t === 'arc') {
        // 'arc' steps store a single SIGNED degrees (positive = right/CW),
        // not a separate direction field like 'turn' -- fold the shared
        // direction select into that sign here.
        const angle = Math.abs(parseFloat(degreesInput.value) || 0);
        step.degrees = directionSel.value === 'left' ? -angle : angle;
        if (stepArcPivot.value === 'custom') {
          step.radius = parseFloat(stepArcRadius.value) || 0;
        } else {
          const halfAxle = (state.config.axleTrack || 114) / 2;
          step.radius = stepArcPivot.value === 'right' ? halfAxle : -halfAxle;
        }
      } else if (t === 'unfold' || t === 'squareToWall') {
        // no parameters
      } else if (t === 'lineFollowPath') {
        const paths = loadSavedPathsForStep();
        const chosen = paths.find(p => String(p.id) === stepPathSelect.value);
        if (!chosen) return; // nothing saved / selected yet
        const pts = chosen.points.map(p => ({ x: p.x, y: p.y }));
        const reversed = !!(stepPathReverse && stepPathReverse.checked);
        step.points = reversed ? pts.slice().reverse() : pts;
        step.label = chosen.name;
        step.reversed = reversed;
      } else if (t === 'lineFollowSim') {
        step.mode = (stepLineMode && stepLineMode.value === 'twoSensor') ? 'twoSensor' : 'single';
        step.maxDistanceMm = parseFloat(stepLineMaxDist.value) || 0;
        step.kp = parseFloat(stepLineKp.value) || 0;
        step.kd = parseFloat(stepLineKd.value) || 0;
        if (step.mode === 'single') {
          step.targetReflection = parseFloat(stepLineTarget.value) || 50;
          step.side = stepLineSide.value;
        }
        if (stepLineStopColour.value) step.stopColour = stepLineStopColour.value;
      } else if (t === 'frontMotor' || t === 'backMotor') {
        step.degrees = Math.abs(parseFloat(degreesInput.value) || 0);
        step.action = motorActionSel.value;
      } else if (t === 'pickupTool' || t === 'deliverTool') {
        step.toolId = stepToolSel.value;
      } else if (t === 'pickupTile') {
        step.colour = stepTileColourSel.value;
      } else if (t === 'placeTile') {
        step.slot = parseInt(stepFrameSlotSel.value, 10) || 0;
      } else if (t === 'settleCement') {
        step.colour = stepCementColourSel.value;
        step.count = Math.max(1, Math.min(10, parseInt(stepCementCountInput.value, 10) || 1));
      } else if (t === 'wait') {
        step.seconds = parseFloat(secondsInput.value) || 0;
      } else if (t === 'comment') {
        step.text = commentInput.value.trim();
        if (!step.text) return;
        commentInput.value = '';
      }
      pushHistory();
      if (insertAtIndex != null) {
        const at = Math.max(0, Math.min(insertAtIndex, state.steps.length));
        state.steps.splice(at, 0, step);
        insertAtIndex = at + 1; // stay put so the next add continues right after this one
      } else {
        state.steps.push(step);
      }
      persist(state);
      render();
    });

    document.getElementById('programClearBtn').addEventListener('click', () => {
      if (!state.steps.length) return;
      pushHistory();
      state.steps = [];
      persist(state);
      render();
    });

    // ---- export modal ----
    const modal = document.getElementById('programModal');
    const exportBtn = document.getElementById('programExportBtn');
    const closeBtn = modal.querySelector('button.close');
    const codeArea = document.getElementById('programCode');

    exportBtn.addEventListener('click', () => {
      codeArea.value = generatePyBricks(state.steps, state.config);
      modal.classList.add('open');
    });
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

    document.getElementById('programCopyCode').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(codeArea.value); }
      catch { codeArea.select(); document.execCommand('copy'); }
    });
    document.getElementById('programDownloadCode').addEventListener('click', () => {
      const blob = new Blob([codeArea.value], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wro2026-route.py';
      a.click();
      URL.revokeObjectURL(url);
    });

    // ---- import modal: parse pasted/uploaded PyBricks code back into steps ----
    const importBtn = document.getElementById('programImportBtn');
    if (importBtn) {
      const importModal = document.getElementById('programImportModal');
      const importCloseBtn = importModal.querySelector('button.close');
      const importCodeArea = document.getElementById('programImportCode');
      const importFileInput = document.getElementById('programImportFile');
      const importFileName = document.getElementById('programImportFileName');
      const importStatus = document.getElementById('programImportStatus');
      const importRunBtn = document.getElementById('programImportRunBtn');

      importBtn.addEventListener('click', () => {
        importStatus.innerHTML = '';
        importModal.classList.add('open');
      });
      importCloseBtn.addEventListener('click', () => importModal.classList.remove('open'));
      importModal.addEventListener('click', e => { if (e.target === importModal) importModal.classList.remove('open'); });

      importFileInput.addEventListener('change', () => {
        const file = importFileInput.files[0];
        if (!file) return;
        importFileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = () => { importCodeArea.value = String(reader.result); };
        reader.readAsText(file);
      });

      importRunBtn.addEventListener('click', () => {
        const code = importCodeArea.value;
        importStatus.innerHTML = '';
        if (!code.trim()) {
          h('p', { class: 'import-warn', text: 'Paste or upload some code first.' }, importStatus);
          return;
        }
        const { steps, warnings, notes, config } = parsePyBricksCode(code);
        pushHistory();
        state.steps = steps;
        state.config = Object.assign({}, state.config, config);
        state.walker.stepIndex = 0;
        persist(state);
        // reflect any restored config (wheel/axle/ports/speeds) in the UI
        wheelInput.value = state.config.wheelDiameter;
        axleInput.value = state.config.axleTrack;
        portLeft.value = state.config.portLeft;
        portRight.value = state.config.portRight;
        portFront.value = state.config.portFront;
        portBack.value = state.config.portBack;
        straightSpeedInput.value = state.config.straightSpeed;
        straightAccelInput.value = state.config.straightAcceleration;
        turnRateInput.value = state.config.turnRate;
        turnAccelInput.value = state.config.turnAcceleration;
        render();

        h('p', { class: 'import-ok', text: `Imported ${steps.length} step${steps.length === 1 ? '' : 's'}.` }, importStatus);
        if (notes.length) {
          h('p', { class: 'import-note-head', text: `${notes.length} step${notes.length === 1 ? '' : 's'} simulated as an approximation -- double-check these against the real robot:` }, importStatus);
          const noteList = h('ul', { class: 'import-note-list' }, importStatus);
          notes.forEach(n => h('li', { text: n }, noteList));
        }
        if (warnings.length) {
          h('p', { class: 'import-warn', text: `${warnings.length} line${warnings.length === 1 ? '' : 's'} could not be parsed and ${warnings.length === 1 ? 'was' : 'were'} skipped:` }, importStatus);
          const list = h('ul', { class: 'import-warn-list' }, importStatus);
          warnings.forEach(w => h('li', { text: w }, list));
        }
      });
    }

    // ---- walker: place a robot on the mat and step through the route ----
    const stage = document.getElementById('stage');
    const measSvg = document.getElementById('measureSvg');
    const walkerLayer = document.getElementById('walkerLayer');
    const elementsLayer = document.getElementById('elementsLayer');
    const refSelect = document.getElementById('walkerRef');
    const placeBtn = document.getElementById('walkerPlaceBtn');
    const resetBtn = document.getElementById('walkerResetBtn');
    const prevBtn = document.getElementById('walkerPrevBtn');
    const nextBtn = document.getElementById('walkerNextBtn');
    const playBtn = document.getElementById('walkerPlayBtn');
    const playSpeedSel = document.getElementById('walkerPlaySpeed');
    const readout = document.getElementById('walkerReadout');

    // ---- game-element rendering (tiles/cement/tools/frame) + scoring
    // tie-in. Senior-only: WRO_ELEMENTS is undefined on Elementary, so all
    // of this is a no-op there. Real-world sizes (1 LEGO stud = 8mm):
    // mosaic tile = 4x4 plate (32x32mm), cement = 1x6 plate (48x8mm),
    // tools = exactly their pickup pad's footprint (elements-senior.js).
    const COLOUR_HEX = { white: '#e9edf5', green: '#22c55e', blue: '#3b82f6', yellow: '#facc15' };
    const TILE_MM = 32;
    const CEMENT_MM = { w: 48, h: 8 };
    function clearElementsLayer() { if (elementsLayer) elementsLayer.innerHTML = ''; }
    function carriedItemSize(item) {
      if (item.type === 'tile') return { w: TILE_MM, h: TILE_MM };
      const tool = window.WRO_ELEMENTS.tools.find(t => t.id === item.id);
      return tool ? { w: tool.w, h: tool.h } : { w: 24, h: 24 };
    }
    function renderElements(pose, sizeState, inv) {
      if (!window.WRO_ELEMENTS || !elementsLayer) return;
      clearElementsLayer();
      const E = window.WRO_ELEMENTS;
      const half = TILE_MM / 2;

      E.TILE_COLOURS.forEach(colour => {
        const positions = E.tiles.filter(t => t.colour === colour);
        positions.slice(0, inv.tilePool[colour]).forEach(p => {
          svg('rect', {
            x: p.x - half, y: p.y - half, width: TILE_MM, height: TILE_MM, rx: 2,
            class: 'elem-tile', fill: COLOUR_HEX[colour],
          }, elementsLayer);
        });
      });

      E.CEMENT_COLOURS.forEach(colour => {
        const positions = E.cement.filter(c => c.colour === colour);
        positions.forEach((p, i) => {
          const settled = i < inv.cementSettled[colour];
          svg('rect', {
            x: p.x - CEMENT_MM.w / 2, y: p.y - CEMENT_MM.h / 2, width: CEMENT_MM.w, height: CEMENT_MM.h, rx: 1.5,
            class: `elem-cement ${settled ? 'elem-cement-settled' : 'elem-cement-loose'}`,
            fill: COLOUR_HEX[colour],
          }, elementsLayer);
        });
      });

      E.tools.forEach(tool => {
        const carried = inv.carrying.some(c => c.type === 'tool' && c.id === tool.id);
        if (carried) return;
        const delivered = inv.toolsDelivered[tool.id];
        let x = tool.x, y = tool.y;
        if (delivered) {
          const zone = window.WRO_ZONES.find(z => z.id === tool.target);
          if (zone) { x = zone.centre.x; y = zone.centre.y; }
        }
        const cls = `elem-tool${delivered ? ' elem-tool-delivered' : ''}`;
        if (tool.shape === 'polygon') {
          svg('polygon', {
            points: tool.points.map(p => `${x + p.x},${y + p.y}`).join(' '),
            class: cls,
          }, elementsLayer);
        } else {
          svg('rect', {
            x: x - tool.w / 2, y: y - tool.h / 2, width: tool.w, height: tool.h, rx: 4,
            class: cls,
          }, elementsLayer);
        }
      });

      inv.frameSlots.forEach((filled, i) => {
        if (!filled) return;
        const slot = E.frameSlots[i];
        const correctness = filled.correct === true ? 'correct' : filled.correct === false ? 'incorrect' : 'unknown';
        svg('rect', {
          x: slot.x - half, y: slot.y - half, width: TILE_MM, height: TILE_MM, rx: 3,
          class: `elem-frame-tile elem-frame-tile-${correctness}`, fill: COLOUR_HEX[filled.colour],
        }, elementsLayer);
      });

      if (pose && inv.carrying.length) {
        const rad = pose.heading * Math.PI / 180;
        const fwd = { x: Math.sin(rad), y: -Math.cos(rad) };
        const right = { x: Math.cos(rad), y: Math.sin(rad) };
        const sizes = inv.carrying.map(carriedItemSize);
        const maxW = Math.max(...sizes.map(s => s.w));
        const out = tools.getRobotFootprint(sizeState).w / 2 + maxW / 2 + 14;
        const totalAlong = sizes.reduce((s, sz) => s + sz.h, 0) + (sizes.length - 1) * 6;
        let cursor = -totalAlong / 2;
        inv.carrying.forEach((item, i) => {
          const sz = sizes[i];
          const along = cursor + sz.h / 2;
          cursor += sz.h + 6;
          const px = pose.x - right.x * out + fwd.x * along;
          const py = pose.y - right.y * out + fwd.y * along;
          const colour = item.type === 'tile' ? COLOUR_HEX[item.colour] : '#cbd5e1';
          svg('rect', { x: px - sz.w / 2, y: py - sz.h / 2, width: sz.w, height: sz.h, rx: 2, class: 'elem-carried', fill: colour }, elementsLayer);
        });
      }
    }

    // Writes the tool/mosaic/cement scoring fields the simulation
    // understands into the same localStorage key the scoring panel reads,
    // then asks it to redraw. Only touches those specific fields -- the
    // barrier bonus checkboxes (which the simulation doesn't model) stay
    // fully under manual control.
    function syncScoringFromInventory(inv) {
      if (!window.WRO_ELEMENTS) return;
      try {
        const raw = localStorage.getItem('wro2026-scoring-state');
        const score = raw ? JSON.parse(raw) : {};
        window.WRO_ELEMENTS.tools.forEach(t => {
          score[t.scoringId] = inv.toolsDelivered[t.id] ? 'full' : 'none';
        });
        let correct = 0, incorrect = 0;
        inv.frameSlots.forEach(slot => {
          if (!slot || slot.correct == null) return;
          if (slot.correct) correct++; else incorrect++;
        });
        score.mosaic_correct = correct;
        score.mosaic_incorrect = incorrect;
        window.WRO_ELEMENTS.CEMENT_COLOURS.forEach(c => { score['cement_' + c] = inv.cementSettled[c]; });
        localStorage.setItem('wro2026-scoring-state', JSON.stringify(score));
        if (window.WRO_SCORING_REFRESH) window.WRO_SCORING_REFRESH();
      } catch { /* scoring sync is best-effort */ }
    }

    if (walkerLayer && refSelect) {
      refSelect.value = state.walker.ref;

      let placing = null; // null | 'position' | 'heading'
      let pendingStart = null;

      // ---- Play: animate the robot through the route in real time,
      // instead of only jumping between step endpoints via Prev/Next.
      // playFrac is 0..1 progress through state.walker.stepIndex's own
      // step -- deliberately not persisted (a reload should land back on
      // the clean step boundary, not mid-animation).
      let playing = false;
      let playFrac = 0;
      let playRAF = null;
      let playLastT = null;
      // stepDuration re-simulates a lineFollowSim step's real stopping
      // distance from its starting pose (see stepDuration's own comment) --
      // memoised by step index so playTick's per-frame (~60/s) calls reuse
      // one simulation per step instead of re-running it every frame.
      let lineFollowDurCache = { idx: -1, dur: 0 };

      function clientToMM(e) {
        const r = stage.getBoundingClientRect();
        return {
          x: ((e.clientX - r.left) / r.width) * window.WRO_MAT.width,
          y: ((e.clientY - r.top) / r.height) * window.WRO_MAT.height,
        };
      }
      // A TouchEvent has no clientX/clientY of its own -- pull it from
      // touches (start/move) or changedTouches (end), shared by the
      // placement flow and the robot-drag handlers below.
      function extractPoint(e) {
        if (e.touches && e.touches.length) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length) return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
        return { clientX: e.clientX, clientY: e.clientY };
      }

      function clearWalkerLayer() { walkerLayer.innerHTML = ''; }

      // Drag the placed robot's silhouette to reposition it, instead of
      // having to re-run the two-click place flow. Dragging shifts
      // state.walker.start by the same delta at whatever step is currently
      // shown, which slides the whole route uniformly (heading unchanged).
      let robotDrag = null; // { origin: {x,y}, startMouse: {x,y} }
      function onRobotMouseDown(e) {
        if (!state.walker.start || placing) return;
        e.preventDefault();
        e.stopPropagation();
        pausePlayback();
        pushHistory();
        robotDrag = { origin: { x: state.walker.start.x, y: state.walker.start.y }, startMouse: clientToMM(extractPoint(e)) };
        document.addEventListener('mousemove', onRobotDragMove);
        document.addEventListener('mouseup', onRobotDragEnd);
        document.addEventListener('touchmove', onRobotDragMoveTouch, { passive: false });
        document.addEventListener('touchend', onRobotDragEndTouch, { passive: false });
      }
      function moveRobotDragTo(pt) {
        if (!robotDrag) return;
        const mm = clientToMM(pt);
        state.walker.start.x = robotDrag.origin.x + (mm.x - robotDrag.startMouse.x);
        state.walker.start.y = robotDrag.origin.y + (mm.y - robotDrag.startMouse.y);
        renderWalker();
      }
      function onRobotDragMove(e) { moveRobotDragTo(extractPoint(e)); }
      function onRobotDragMoveTouch(e) { e.preventDefault(); moveRobotDragTo(extractPoint(e)); }
      function onRobotDragEndTouch(e) { e.preventDefault(); onRobotDragEnd(); }
      function onRobotDragEnd() {
        if (!robotDrag) return;
        robotDrag = null;
        persist(state);
        document.removeEventListener('mousemove', onRobotDragMove);
        document.removeEventListener('mouseup', onRobotDragEnd);
        document.removeEventListener('touchmove', onRobotDragMoveTouch);
        document.removeEventListener('touchend', onRobotDragEndTouch);
      }

      // Passed into poseAtIndex/trailPoints/applyStepPartial so a
      // 'squareToWall' step can size itself against the robot's real
      // open/closed footprint at that point in the route.
      function footprintForState(sizeState) { return tools.getRobotFootprint(sizeState); }

      // Drive wheels, front/back attachment motors, and both line-follow
      // sensors have no visual representation at all otherwise -- drawn
      // inside the robot's own rotated <g>, so they turn with it. Wheels
      // sit at the configured axle track; the attachment motors have no
      // configurable offset (only a port letter), so their position is
      // just the footprint's own front/back edge centre, a convention not
      // a measurement. Sensor A/B are drawn at their real configured
      // offsets from Robot config, so this doubles as a sanity check that
      // those numbers put the sensor somewhere sensible.
      function drawRobotMarkers(g, footprint) {
        const halfW = footprint.w / 2, halfL = footprint.l / 2;
        const cfg = state.config || {};
        const axleHalf = Math.min(halfW * 1.15, (cfg.axleTrack || 114) / 2);
        const wheelH = Math.min(36, halfL * 0.7);
        // Forward offset is a local -Y shift (forward = -Y in this
        // unrotated frame, same convention as the direction arrow) --
        // clamped loosely so an extreme value can't draw the wheel way
        // outside even a short footprint.
        const wheelY = Math.max(-halfL * 1.1, Math.min(halfL * 1.1, -(cfg.wheelForwardOffsetMm || 0)));
        [-1, 1].forEach(side => {
          const wheel = svg('rect', {
            x: side * axleHalf - 5, y: wheelY - wheelH / 2, width: 10, height: wheelH,
            class: 'walker-wheel',
          }, g);
          svg('title', {}, wheel).textContent = `${side < 0 ? 'Left' : 'Right'} wheel (port ${side < 0 ? cfg.portLeft : cfg.portRight})`;
        });

        const motor = (cy, port, label) => {
          const m = svg('circle', { cx: 0, cy, r: 8, class: 'walker-motor-marker' }, g);
          svg('title', {}, m).textContent = `${label} motor (port ${port})`;
          const t = svg('text', { x: 11, y: cy + 5, class: 'walker-marker-label' }, g);
          t.textContent = label === 'Front' ? 'FM' : 'BM';
        };
        motor(-halfL, cfg.portFront, 'Front');
        motor(halfL, cfg.portBack, 'Back');

        const sensor = (fwd, lat, cls, label, title) => {
          const s = svg('circle', { cx: lat, cy: -fwd, r: 7, class: `walker-sensor-marker ${cls}` }, g);
          svg('title', {}, s).textContent = title;
          const t = svg('text', { x: lat + 10, y: -fwd + 5, class: 'walker-marker-label' }, g);
          t.textContent = label;
        };
        sensor(
          cfg.lineSensorForwardMm != null ? cfg.lineSensorForwardMm : DEFAULT_LINE_CONFIG.lineSensorForwardMm,
          cfg.lineSensorLateralMm != null ? cfg.lineSensorLateralMm : DEFAULT_LINE_CONFIG.lineSensorLateralMm,
          'walker-sensor-a', 'A', 'Line sensor A (used in single-sensor mode, and as one side of two-sensor)'
        );
        sensor(
          cfg.lineSensor2ForwardMm != null ? cfg.lineSensor2ForwardMm : DEFAULT_LINE_CONFIG.lineSensor2ForwardMm,
          cfg.lineSensor2LateralMm != null ? cfg.lineSensor2LateralMm : DEFAULT_LINE_CONFIG.lineSensor2LateralMm,
          'walker-sensor-b', 'B', 'Line sensor B (two-sensor mode only)'
        );
      }

      function drawRobotAt(pose, sizeState) {
        clearWalkerLayer();
        const fp = tools.getRobotFootprint(sizeState || 'closed');
        const halfW = fp.w / 2, halfL = fp.l / 2;
        const arrowLen = Math.min(42, halfL + 10);
        const g = svg('g', { transform: `translate(${pose.x} ${pose.y}) rotate(${pose.heading})`, class: 'walker-robot-live' }, walkerLayer);
        g.addEventListener('mousedown', onRobotMouseDown);
        g.addEventListener('touchstart', onRobotMouseDown, { passive: false });
        svg('rect', { x: -halfW, y: -halfL, width: fp.w, height: fp.l, class: `walker-footprint walker-footprint-${sizeState || 'closed'}` }, g);
        svg('polygon', { points: `0,${-halfL + 10} ${-18},${-halfL + arrowLen} ${18},${-halfL + arrowLen}`, class: 'walker-arrow' }, g);
        drawRobotMarkers(g, fp);

        // trail so far — skipped during placement (drawRobotAt(pendingStart)
        // is called before state.walker.start exists, on the "click again to
        // set heading" step)
        if (state.walker.start) {
          const idx = Math.min(state.walker.stepIndex, state.steps.length);
          const pts = trailPoints(state.steps, state.walker.start, idx, footprintForState, state.config);
          // Mid-drive during Play: extend the trail's leading edge to the
          // live interpolated position instead of only jumping once the
          // whole step finishes, so the path visibly draws itself.
          const curStep = state.steps[idx];
          if (playFrac > 0 && curStep && (curStep.type === 'drive' || curStep.type === 'lineFollow' || curStep.type === 'arc' || curStep.type === 'squareToWall' || curStep.type === 'lineFollowPath' || curStep.type === 'lineFollowSim')) {
            pts.push({ x: pose.x, y: pose.y });
          }
          if (pts.length > 1) {
            svg('polyline', {
              points: pts.map(p => `${p.x},${p.y}`).join(' '),
              class: 'walker-trail',
            }, walkerLayer);
          }
        }

        // reference-point marker
        const rp = refPoint(pose, refSelect.value, fp);
        svg('circle', { cx: rp.x, cy: rp.y, r: 9, class: 'walker-refdot' }, walkerLayer);
      }

      // "In hand" preview while placing: a translucent footprint that
      // follows the cursor before the position click, then rotates live
      // toward the cursor before the heading click, so you can see how the
      // robot will land before committing to either click.
      function drawGhost(pose) {
        clearWalkerLayer();
        const sizeState = tools.getRobotState();
        const fp = tools.getRobotFootprint(sizeState);
        const halfW = fp.w / 2, halfL = fp.l / 2;
        const arrowLen = Math.min(42, halfL + 10);
        const g = svg('g', {
          transform: `translate(${pose.x} ${pose.y}) rotate(${pose.heading})`,
          class: 'walker-ghost',
        }, walkerLayer);
        svg('rect', { x: -halfW, y: -halfL, width: fp.w, height: fp.l, class: `walker-footprint walker-footprint-${sizeState}` }, g);
        svg('polygon', { points: `0,${-halfL + 10} ${-18},${-halfL + arrowLen} ${18},${-halfL + arrowLen}`, class: 'walker-arrow' }, g);
        drawRobotMarkers(g, fp);
      }

      // The live pose: fully-applied steps up to stepIndex, plus however far
      // into the *current* step Play has gotten (playFrac 0..1). At rest
      // (playFrac 0) this is identical to poseAtIndex(..., stepIndex).
      function currentPose() {
        const idx = Math.min(state.walker.stepIndex, state.steps.length);
        let pose = poseAtIndex(state.steps, state.walker.start, idx, footprintForState, state.config);
        if (playFrac > 0 && idx < state.steps.length) {
          const sizeState = sizeStateAtIndex(state.steps, idx);
          pose = applyStepPartial(pose, state.steps[idx], playFrac, footprintForState(sizeState), state.config);
        }
        return pose;
      }
      // Unlike drive/turn (which visibly interpolate via currentPose), an
      // instantaneous step -- pickup/place/deliver/settle/unfold -- has no
      // partial state to show mid-dwell. So it should read as "done" the
      // moment its dwell *starts* (playFrac > 0), not only once the dwell
      // finishes -- otherwise a picked-up tile wouldn't appear lifted onto
      // the robot until 0.6s after you'd expect it to.
      function appliedStepIndex() {
        const idx = Math.min(state.walker.stepIndex, state.steps.length);
        return playFrac > 0 ? Math.min(idx + 1, state.steps.length) : idx;
      }

      function updateReadout() {
        const total = state.steps.length;
        const idx = Math.min(state.walker.stepIndex, total);
        if (!state.walker.start) {
          readout.textContent = 'Click "Place robot on mat", then click the mat twice — once for position, once to set heading.';
          return;
        }
        const pose = currentPose();
        const sizeState = sizeStateAtIndex(state.steps, appliedStepIndex());
        const fp = tools.getRobotFootprint(sizeState);
        const rp = refPoint(pose, refSelect.value, fp);
        let stepNote;
        if (playing && idx < total) {
          stepNote = ` · running: ${describeStep(state.steps[idx])} (${Math.round(playFrac * 100)}%)`;
        } else {
          stepNote = idx > 0 && state.steps[idx - 1] ? ` · last: ${describeStep(state.steps[idx - 1])}` : ' · at start pose';
        }
        readout.textContent = `Step ${idx}/${total} — ${REF_LABELS[refSelect.value]} @ (${rp.x.toFixed(0)}, ${rp.y.toFixed(0)}) mm · heading ${pose.heading.toFixed(0)}° · ${sizeState}${stepNote}`;
      }

      renderWalker = function() {
        state.walker.stepIndex = Math.min(state.walker.stepIndex, state.steps.length);
        const hasRobot = !!state.walker.start;
        resetBtn.disabled = !hasRobot;
        prevBtn.disabled = !hasRobot || playing || state.walker.stepIndex === 0;
        nextBtn.disabled = !hasRobot || playing || state.walker.stepIndex >= state.steps.length;
        playBtn.disabled = !hasRobot || !state.steps.length;
        playBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
        let pose = null, sizeState = 'closed';
        if (hasRobot) {
          pose = currentPose();
          sizeState = sizeStateAtIndex(state.steps, appliedStepIndex());
          drawRobotAt(pose, sizeState);
        } else {
          clearWalkerLayer();
        }
        if (window.WRO_ELEMENTS) {
          const inv = inventoryAtIndex(state.steps, appliedStepIndex(), state.mosaicPattern);
          renderElements(pose, sizeState, inv);
          syncScoringFromInventory(inv);
        }
        updateReadout();
      };

      // ---- Play: animate stepIndex/playFrac forward in real time using
      // each step's actual duration (stepDuration), via requestAnimationFrame
      // so it stays smooth regardless of frame rate. ----
      function pausePlayback() {
        if (!playing) return;
        playing = false;
        if (playRAF != null) { cancelAnimationFrame(playRAF); playRAF = null; }
        playLastT = null;
        persist(state); // stepIndex only -- playFrac is deliberately not persisted
        renderWalker();
      }
      function playTick(t) {
        if (!playing) return;
        if (playLastT == null) playLastT = t;
        // Clamp so a backgrounded/throttled tab doesn't "catch up" in one huge jump.
        const dtSeconds = Math.min(0.25, (t - playLastT) / 1000);
        playLastT = t;
        const speed = parseFloat(playSpeedSel.value) || 1;

        let idx = state.walker.stepIndex;
        let remaining = dtSeconds * speed;
        while (remaining > 0 && idx < state.steps.length) {
          const curStep = state.steps[idx];
          let dur;
          if (curStep.type === 'lineFollowSim' && state.walker.start) {
            if (lineFollowDurCache.idx !== idx) {
              const startPose = poseAtIndex(state.steps, state.walker.start, idx, footprintForState, state.config);
              lineFollowDurCache = { idx, dur: Math.max(0.001, stepDuration(curStep, state.config, startPose)) };
            }
            dur = lineFollowDurCache.dur;
          } else {
            dur = Math.max(0.001, stepDuration(curStep, state.config));
          }
          const newElapsed = playFrac * dur + remaining;
          if (newElapsed >= dur) {
            remaining = newElapsed - dur;
            idx++;
            playFrac = 0;
          } else {
            playFrac = newElapsed / dur;
            remaining = 0;
          }
        }
        state.walker.stepIndex = idx;
        if (idx >= state.steps.length) {
          playFrac = 0;
          pausePlayback();
          return;
        }
        renderWalker();
        playRAF = requestAnimationFrame(playTick);
      }
      function startPlayback() {
        if (!state.walker.start || !state.steps.length) return;
        cancelPlacingAndReleaseTool();
        if (state.walker.stepIndex >= state.steps.length) { state.walker.stepIndex = 0; playFrac = 0; }
        playing = true;
        playLastT = null;
        renderWalker();
        playRAF = requestAnimationFrame(playTick);
      }
      playBtn.addEventListener('click', () => { playing ? pausePlayback() : startPlayback(); });

      refSelect.addEventListener('change', () => {
        cancelPlacingAndReleaseTool();
        state.walker.ref = refSelect.value;
        persist(state);
        renderWalker();
      });

      function cancelPlacing() {
        if (!placing) return;
        placing = null;
        // Don't touch stage.dataset.tool here — the toolbar button that
        // triggered this cancellation already set it via its own (earlier)
        // click listener in app.js. Overwriting it here would stomp
        // whichever real tool the user just picked.
        placeBtn.textContent = state.walker.start ? '📍 Re-place robot' : '📍 Place robot on mat';
        renderWalker();
      }

      // Reset/Prev/Next/ref-select don't select a different tool, so unlike
      // cancelPlacing() above they DO need to put the mat's click surface
      // back to normal themselves. Without this, clicking e.g. Reset
      // mid-placement only redraws over the ghost -- it doesn't leave
      // placement mode, so the next mat click is silently eaten as the
      // position/heading click instead of doing what it looks like it does.
      function cancelPlacingAndReleaseTool() {
        if (!placing) return;
        pendingStart = null;
        stage.dataset.tool = 'none';
        cancelPlacing();
      }

      placeBtn.addEventListener('click', () => {
        // Tapping the button again mid-placement backs out -- the touch
        // equivalent of pressing Esc, since a touchscreen has no Esc key.
        if (placing) { cancelPlacingAndReleaseTool(); return; }
        pausePlayback();
        tools.setTool('none');
        // tools.js's own click handler is now a no-op (its closure `tool` is
        // 'none'), but the CSS rule `[data-tool="none"] svg.measure {
        // pointer-events: none}` also makes the mat un-clickable — so the
        // stage needs a tool value that isn't "none" for OUR click handler
        // below to ever receive an event at all.
        stage.dataset.tool = 'placing';
        placing = 'position';
        pendingStart = null;
        placeBtn.textContent = '📍 Click the mat: set position…';
        readout.textContent = 'Move over the mat to see the robot, then click to set its position.';
      });

      // Placing a robot borrows the mat's click surface — if the user picks
      // a different tool mid-placement, back out cleanly instead of leaving
      // two click handlers racing each other.
      document.querySelectorAll('button[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => cancelPlacing());
      });

      // "In hand" ghost: follow the cursor before the position click, then
      // rotate toward the cursor before the heading click. Shared by mouse
      // hover and touch drag -- a touchscreen has no hover, so on touch this
      // only appears once a finger is actually down and moving.
      function updatePlacementGhost(e) {
        if (!placing) return;
        const pt = clientToMM(e);
        if (placing === 'position') {
          drawGhost({ x: pt.x, y: pt.y, heading: 0 });
        } else if (placing === 'heading') {
          const dx = pt.x - pendingStart.x, dy = pt.y - pendingStart.y;
          let heading = Math.atan2(dx, -dy) * 180 / Math.PI;
          heading = ((heading % 360) + 360) % 360;
          drawGhost({ x: pendingStart.x, y: pendingStart.y, heading });
          readout.textContent = `Heading ${heading.toFixed(0)}° — click to confirm, or Esc to cancel.`;
        }
      }
      measSvg.addEventListener('mousemove', updatePlacementGhost);

      function commitPlacementTap(e) {
        if (!placing) return;
        const pt = clientToMM(e);
        if (placing === 'position') {
          pendingStart = { x: pt.x, y: pt.y, heading: 0 };
          placing = 'heading';
          placeBtn.textContent = '📍 Click again: set heading…';
          readout.textContent = 'Move to aim the robot, then click to set its heading.';
          drawGhost(pendingStart);
        } else if (placing === 'heading') {
          const dx = pt.x - pendingStart.x, dy = pt.y - pendingStart.y;
          let heading = Math.atan2(dx, -dy) * 180 / Math.PI;
          heading = ((heading % 360) + 360) % 360;
          pendingStart.heading = heading;
          pushHistory();
          state.walker.start = pendingStart;
          state.walker.stepIndex = 0;
          placing = null;
          stage.dataset.tool = 'none';
          placeBtn.textContent = '📍 Re-place robot';
          persist(state);
          renderWalker();
        }
      }
      measSvg.addEventListener('click', commitPlacementTap);

      // Touch: press-and-drag to aim (mirrors mousemove), lift to commit
      // that phase (mirrors click) -- two taps in the right spots works too,
      // but drag-to-aim reads better on a touchscreen than a bare double-tap.
      measSvg.addEventListener('touchstart', (e) => {
        if (!placing) return;
        e.preventDefault();
        updatePlacementGhost(extractPoint(e));
      }, { passive: false });
      measSvg.addEventListener('touchmove', (e) => {
        if (!placing) return;
        e.preventDefault();
        updatePlacementGhost(extractPoint(e));
      }, { passive: false });
      measSvg.addEventListener('touchend', (e) => {
        if (!placing) return;
        e.preventDefault();
        commitPlacementTap(extractPoint(e));
      }, { passive: false });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          pausePlayback();
          if (placing) cancelPlacingAndReleaseTool();
        }
        // Undo/redo (window.WRO_HISTORY) can rewrite state.walker.stepIndex
        // out from under an in-progress animation -- stop it first.
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y' || e.key === 'Z' || e.key === 'Y')) {
          pausePlayback();
        }
        // Space toggles Play/Pause -- skipped while typing or focused on a
        // control (same guard tools.js uses for its own shortcuts), so
        // space still types a space or activates that control as normal.
        if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
          e.preventDefault();
          if (!playBtn.disabled) { playing ? pausePlayback() : startPlayback(); }
        }
      });

      resetBtn.addEventListener('click', () => {
        pausePlayback();
        cancelPlacingAndReleaseTool();
        state.walker.stepIndex = 0;
        persist(state);
        renderWalker();
      });
      prevBtn.addEventListener('click', () => {
        pausePlayback();
        cancelPlacingAndReleaseTool();
        state.walker.stepIndex = Math.max(0, state.walker.stepIndex - 1);
        persist(state);
        renderWalker();
      });
      nextBtn.addEventListener('click', () => {
        pausePlayback();
        cancelPlacingAndReleaseTool();
        state.walker.stepIndex = Math.min(state.steps.length, state.walker.stepIndex + 1);
        persist(state);
        renderWalker();
      });

      if (state.walker.start) placeBtn.textContent = '📍 Re-place robot';
      renderWalker();
    }
  }

  return { init, generatePyBricks, parsePyBricksCode };
})();
