/* =========================================================
   GAME JAM SIMULATOR — assets.js
   Loads uploaded pixel art from /assets. Handles green-screen +
   flood-fill background removal and sprite-sheet slicing. Missing
   files fall back to procedural art, so the game always runs.

   (The animated room GIF is handled separately in game.js via a
   DOM <img> layer so it keeps animating.)
   ========================================================= */
(function (global) {
  "use strict";

  var store = {}, meta = {};

  // Files are pre-baked to transparent backgrounds (see scratch/bake), so no
  // runtime keying is needed — just load and (for sheets) slice.
  // px = target pixel-grid size for that sprite (quantised at load so the
  // whole game shares one chunky pixel resolution). levels = colour steps.
  var MANIFEST = [
    { name: "hands",         src: "assets/hands.png",         sheet: { cols: 3, rows: 1 }, px: 90,  levels: 10 }, // 0 idle,1 press,2 type
    { name: "runbtn",        src: "assets/runbtn.png",        sheet: { cols: 2, rows: 1 }, px: 56,  levels: 8 },  // 0 up,1 down
    { name: "desk",          src: "assets/desk.png",          px: 256, levels: 24 },
    { name: "room",          src: "assets/room.gif" },
    { name: "player",        src: "assets/player.png",        sheet: { cols: 4, rows: 2 }, px: 64,  levels: 8 },
    { name: "drinks",        src: "assets/drinks.png",        sheet: { cols: 5, rows: 1 }, px: 56,  levels: 10 },
    { name: "pack_gears",    src: "assets/pack_gears.png",    px: 72, levels: 10 },
    { name: "pack_graphics", src: "assets/pack_graphics.png", px: 72, levels: 10 },
    { name: "pack_pets",     src: "assets/pack_pets.png",     px: 72, levels: 10 }
  ];

  function toCanvas(img) {
    var c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    var x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0);
    return c;
  }

  function isGreen(r, g, b) { return g > 135 && r < 135 && b < 140 && (g - r) > 55 && (g - b) > 45; }

  // Flood-fill from the border, clearing background-like pixels. Interior
  // pixels that match the bg colour (e.g. dark outlines, a green logo) are
  // NOT reachable through background, so they survive.
  function floodKey(canvas, mode, tol) {
    var ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height, d;
    try { d = ctx.getImageData(0, 0, w, h); } catch (e) { return canvas; }
    var p = d.data;
    var rr = 0, gg = 0, bb = 0;
    if (mode === "corner") {
      var cs = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
      for (var k = 0; k < 4; k++) { rr += p[cs[k]]; gg += p[cs[k] + 1]; bb += p[cs[k] + 2]; }
      rr /= 4; gg /= 4; bb /= 4;
    }
    function bg(i) {
      var r = p[i], g = p[i + 1], b = p[i + 2];
      return mode === "green" ? isGreen(r, g, b) : (Math.abs(r - rr) + Math.abs(g - gg) + Math.abs(b - bb) < tol);
    }
    var visited = new Uint8Array(w * h), stack = [];
    function seed(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      var idx = y * w + x; if (visited[idx]) return; visited[idx] = 1;
      var i = idx * 4; if (p[i + 3] !== 0 && bg(i)) { p[i + 3] = 0; stack.push(idx); }
    }
    for (var x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
    for (var y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
    while (stack.length) { var idx = stack.pop(), cx = idx % w, cy = (idx / w) | 0; seed(cx + 1, cy); seed(cx - 1, cy); seed(cx, cy + 1); seed(cx, cy - 1); }
    ctx.putImageData(d, 0, 0);
    return canvas;
  }

  // Quantise a canvas to a chunky pixel grid + a limited palette so every
  // sprite reads as real hand-made pixel art at the same resolution
  // (the source art is high-res and smooth, which is what looks "AI").
  function pixelate(canvas, targetPx, levels) {
    var w = canvas.width, h = canvas.height;
    var scale = Math.max(1, Math.round(Math.max(w, h) / targetPx));
    var sw = Math.max(1, Math.round(w / scale)), sh = Math.max(1, Math.round(h / scale));
    var small = document.createElement("canvas"); small.width = sw; small.height = sh;
    var sc = small.getContext("2d"); sc.imageSmoothingEnabled = false;
    sc.drawImage(canvas, 0, 0, sw, sh);
    // posterise colours a little (chunkier palette, crisper edges)
    try {
      var d = sc.getImageData(0, 0, sw, sh), p = d.data, step = 255 / (levels || 12);
      for (var i = 0; i < p.length; i += 4) {
        if (p[i + 3] < 110) { p[i + 3] = 0; continue; }   // harden alpha (no soft AI halo)
        p[i + 3] = 255;
        p[i] = Math.round(p[i] / step) * step;
        p[i + 1] = Math.round(p[i + 1] / step) * step;
        p[i + 2] = Math.round(p[i + 2] / step) * step;
      }
      sc.putImageData(d, 0, 0);
    } catch (e) { /* ignore */ }
    return small;   // drawn upscaled with smoothing off => crisp fat pixels
  }

  function sliceSheet(canvas, cols, rows) {
    var cw = Math.floor(canvas.width / cols), ch = Math.floor(canvas.height / rows), out = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var cell = document.createElement("canvas"); cell.width = cw; cell.height = ch;
      var x = cell.getContext("2d"); x.imageSmoothingEnabled = false;
      x.drawImage(canvas, c * cw, r * ch, cw, ch, 0, 0, cw, ch);
      out.push(cell);
    }
    return out;
  }

  function applyKey(canvas, spec) {
    if (!spec.key) return;
    floodKey(canvas, spec.key === "green" ? "green" : "corner", spec.tol || 46);
  }

  function process(spec, img) {
    var cv = toCanvas(img);
    if (spec.sheet) {
      var cells = sliceSheet(cv, spec.sheet.cols, spec.sheet.rows);
      cells = cells.map(function (c) { applyKey(c, spec); return spec.px ? pixelate(c, spec.px, spec.levels) : c; });
      store[spec.name] = cells;
      meta[spec.name] = { ok: true, frames: cells.length, w: cells[0].width, h: cells[0].height };
    } else {
      applyKey(cv, spec);
      if (spec.px) cv = pixelate(cv, spec.px, spec.levels);
      store[spec.name] = cv;
      meta[spec.name] = { ok: true, frames: 1, w: cv.width, h: cv.height };
    }
  }

  function load(done) {
    var remaining = MANIFEST.length; if (!remaining) { done && done(); return; }
    MANIFEST.forEach(function (spec) {
      var img = new Image();
      img.onload = function () { try { process(spec, img); } catch (e) { meta[spec.name] = { ok: false }; } if (--remaining === 0) done && done(); };
      img.onerror = function () { meta[spec.name] = { ok: false }; if (--remaining === 0) done && done(); };
      img.src = spec.src;
    });
  }

  global.JamAssets = {
    load: load,
    has: function (n) { return !!(meta[n] && meta[n].ok); },
    get: function (n) { return store[n] || null; },
    frame: function (n, i) { var s = store[n]; return (s && s.length) ? (s[i] || null) : null; },
    meta: function (n) { return meta[n] || { ok: false }; }
  };
})(window);
