/* =========================================================
   GAME JAM SIMULATOR — assets.js
   Loads the real uploaded pixel-art (room, player sheet, drinks,
   packs) from /assets. Handles green-screen keying + sheet
   slicing. If a file is missing, that asset is simply absent and
   the renderer falls back to its procedural version — so the game
   always runs, and drops in the real art the moment it exists.
   ========================================================= */
(function (global) {
  "use strict";

  var store = {};   // name -> canvas (single) or array of canvases (sheet)
  var meta = {};    // name -> { ok, w, h, frames }

  // Manifest: what we try to load and how to process each file.
  var MANIFEST = [
    { name: "room",          src: "assets/room.png" },
    { name: "player",        src: "assets/player.png",        sheet: { cols: 4, rows: 2 }, key: "corner", tol: 40 },
    { name: "drinks",        src: "assets/drinks.png",        sheet: { cols: 5, rows: 1 }, key: "green", tol: 90 },
    { name: "pack_gears",    src: "assets/pack_gears.png",    key: "corner", tol: 30 },
    { name: "pack_graphics", src: "assets/pack_graphics.png", key: "corner", tol: 30 }
  ];

  function toCanvas(img) {
    var c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    var x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.drawImage(img, 0, 0);
    return c;
  }

  // Make background pixels transparent.
  //   mode 'green'  -> chroma-key vivid green screens
  //   mode 'corner' -> key whatever colour the top-left pixel is
  function keyOut(canvas, mode, tol) {
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    var d;
    try { d = ctx.getImageData(0, 0, w, h); }
    catch (e) { return canvas; } // tainted (file://) — skip keying gracefully
    var p = d.data;
    var kr, kg, kb;
    if (mode === "green") { kr = 40; kg = 200; kb = 40; }
    else { kr = p[0]; kg = p[1]; kb = p[2]; } // corner sample
    tol = tol || 40;
    for (var i = 0; i < p.length; i += 4) {
      var r = p[i], g = p[i + 1], b = p[i + 2];
      var hit;
      if (mode === "green") hit = (g > 140 && r < 150 && b < 150 && (g - r) > 50 && (g - b) > 50);
      else hit = (Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb)) < tol;
      if (hit) p[i + 3] = 0;
    }
    ctx.putImageData(d, 0, 0);
    return canvas;
  }

  function sliceSheet(canvas, cols, rows) {
    var cw = Math.floor(canvas.width / cols), ch = Math.floor(canvas.height / rows);
    var out = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var cell = document.createElement("canvas");
      cell.width = cw; cell.height = ch;
      var x = cell.getContext("2d");
      x.imageSmoothingEnabled = false;
      x.drawImage(canvas, c * cw, r * ch, cw, ch, 0, 0, cw, ch);
      out.push(cell);
    }
    return out;
  }

  function process(spec, img) {
    var cv = toCanvas(img);
    if (spec.key) keyOut(cv, spec.key, spec.tol);
    if (spec.sheet) {
      var cells = sliceSheet(cv, spec.sheet.cols, spec.sheet.rows);
      store[spec.name] = cells;
      meta[spec.name] = { ok: true, frames: cells.length, w: cells[0].width, h: cells[0].height };
    } else {
      store[spec.name] = cv;
      meta[spec.name] = { ok: true, frames: 1, w: cv.width, h: cv.height };
    }
  }

  function load(done) {
    var remaining = MANIFEST.length;
    if (!remaining) { done && done(); return; }
    MANIFEST.forEach(function (spec) {
      var img = new Image();
      img.onload = function () {
        try { process(spec, img); } catch (e) { meta[spec.name] = { ok: false }; }
        if (--remaining === 0) done && done();
      };
      img.onerror = function () {
        meta[spec.name] = { ok: false };   // fall back to procedural
        if (--remaining === 0) done && done();
      };
      img.src = spec.src;
    });
  }

  var JamAssets = {
    load: load,
    has: function (name) { return !!(meta[name] && meta[name].ok); },
    get: function (name) { return store[name] || null; },
    // For sheets: return one sliced frame canvas (or null).
    frame: function (name, i) {
      var s = store[name];
      if (!s || !s.length) return null;
      return s[i] || null;
    },
    meta: function (name) { return meta[name] || { ok: false }; }
  };

  global.JamAssets = JamAssets;
})(window);
