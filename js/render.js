/* =========================================================
   GAME JAM SIMULATOR — render.js
   All procedural pixel art. Nothing here is loaded from disk;
   every sprite is drawn with the 2D canvas at a low internal
   resolution (512×288) and CSS-scaled up with pixelation.
   ========================================================= */
(function (global) {
  "use strict";

  var W = 512, H = 288;

  // Hotspots the game hit-tests against in room view (internal coords).
  var HOTSPOTS = {
    monitor: { x: 176, y: 92,  w: 150, h: 104 },
    fridge:  { x: 398, y: 150, w: 92,  h: 118 }
  };

  // ---- low level pixel helpers ----------------------------
  function px(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function clear(ctx) {
    ctx.clearRect(0, 0, W, H);
  }

  // ---- GEAR ----------------------------------------------
  // Draws a chunky rotating gear centred at (cx,cy).
  function gear(ctx, cx, cy, r, teeth, angle, tint, opts) {
    opts = opts || {};
    var i, a, step = (Math.PI * 2) / teeth;
    var dark = shade(tint, -0.4);
    var light = shade(tint, 0.35);

    ctx.save();
    ctx.translate(cx, cy);

    // connection glow ring
    if (opts.glow) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(angle * 3);
      px2circle(ctx, 0, 0, r + 4, opts.glowColor || "#ffd23f");
      ctx.restore();
    }

    ctx.rotate(angle);

    // teeth
    for (i = 0; i < teeth; i++) {
      a = i * step;
      var tx = Math.cos(a) * (r + 1);
      var ty = Math.sin(a) * (r + 1);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(a);
      px(ctx, -2.5, -2.5, 5, 5, dark);
      px(ctx, -2, -2.5, 4, 4, tint);
      ctx.restore();
    }

    // body
    px2circle(ctx, 0, 0, r, dark);
    px2circle(ctx, 0, 0, r - 1.5, tint);
    // top-left highlight
    ctx.save();
    ctx.globalAlpha = 0.5;
    px2circle(ctx, -r * 0.28, -r * 0.28, r * 0.5, light);
    ctx.restore();

    // hub
    px2circle(ctx, 0, 0, r * 0.42, dark);
    px2circle(ctx, 0, 0, r * 0.28, shade(tint, -0.15));
    // center hole
    px2circle(ctx, 0, 0, r * 0.12, "#0d0b16");

    ctx.restore();

    // art-style badge ring
    if (opts.graphicTint) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = opts.graphicTint;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // jammed marker
    if (opts.jammed) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      px2circle(ctx, cx, cy, r + 1, "#000");
      ctx.restore();
      ctx.strokeStyle = "#ff5555";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy - r * 0.6);
      ctx.lineTo(cx + r * 0.6, cy + r * 0.6);
      ctx.moveTo(cx + r * 0.6, cy - r * 0.6);
      ctx.lineTo(cx - r * 0.6, cy + r * 0.6);
      ctx.stroke();
    }
  }

  // Filled "pixel" circle (still crisp when the canvas is upscaled).
  function px2circle(ctx, cx, cy, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lighten / darken a #rrggbb colour by amount in [-1,1].
  function shade(hex, amt) {
    var c = hex.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.substr(0, 2), 16);
    var g = parseInt(c.substr(2, 2), 16);
    var b = parseInt(c.substr(4, 2), 16);
    if (amt >= 0) {
      r = r + (255 - r) * amt; g = g + (255 - g) * amt; b = b + (255 - b) * amt;
    } else {
      r = r * (1 + amt); g = g * (1 + amt); b = b * (1 + amt);
    }
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")";
  }

  // ---- CHARACTER (little dev, from behind at the desk) -----
  function character(ctx, x, y, t, mood) {
    var bob = Math.sin(t * 6) * 1.2;           // typing bob
    var hood = mood === "happy" ? "#ffd23f" : "#5b6bd0";
    // chair back
    px(ctx, x - 14, y - 2, 28, 30, "#3a2f52");
    px(ctx, x - 12, y, 24, 26, "#4a3d66");
    // body / hoodie
    px(ctx, x - 12, y - 18 + bob, 24, 26, hood);
    px(ctx, x - 12, y - 18 + bob, 24, 6, shade(hood, 0.2));
    // arms reaching to keyboard
    px(ctx, x - 14, y - 2 + bob, 6, 10, hood);
    px(ctx, x + 8,  y - 2 + bob, 6, 10, hood);
    // head
    px(ctx, x - 8, y - 32 + bob, 16, 16, "#e0b088"); // skin/back of head
    // beanie
    px(ctx, x - 9, y - 35 + bob, 18, 8, "#e2557a");
    px(ctx, x - 9, y - 30 + bob, 18, 3, shade("#e2557a", -0.2));
    // little antenna of hair
    px(ctx, x - 2, y - 37 + bob, 4, 3, "#3a2a1a");
  }

  // ---- ROOM SCENE -----------------------------------------
  function room(ctx, t, opts) {
    opts = opts || {};
    clear(ctx);

    // wall
    px(ctx, 0, 0, W, H, "#241f38");
    px(ctx, 0, 0, W, 150, "#2a2440");
    // subtle wall panel lines
    ctx.globalAlpha = 0.25;
    for (var i = 0; i < W; i += 32) px(ctx, i, 0, 1, 150, "#1c1830");
    ctx.globalAlpha = 1;
    // baseboard + floor
    px(ctx, 0, 150, W, 4, "#161226");
    px(ctx, 0, 154, W, H - 154, "#3a2c4a");
    // floorboards
    ctx.globalAlpha = 0.3;
    for (var f = 0; f < W; f += 40) px(ctx, f, 154, 1, H - 154, "#241a30");
    ctx.globalAlpha = 1;

    // window (night sky)
    px(ctx, 24, 20, 92, 70, "#0e1430");
    px(ctx, 22, 18, 96, 74, "#5b4b7a"); // frame
    px(ctx, 24, 20, 92, 70, "#0e1430");
    // stars
    var stars = [[36,34],[60,28],[88,40],[104,30],[48,58],[96,64],[72,48]];
    for (var s = 0; s < stars.length; s++) {
      var tw = 0.5 + 0.5 * Math.sin(t * 3 + s);
      ctx.globalAlpha = 0.4 + 0.6 * tw;
      px(ctx, stars[s][0], stars[s][1], 2, 2, "#ffffff");
    }
    ctx.globalAlpha = 1;
    // moon
    px2circle(ctx, 100, 34, 7, "#f4f0d0");
    px2circle(ctx, 96, 31, 5, "#0e1430");
    // window cross bars
    px(ctx, 68, 20, 2, 70, "#5b4b7a");
    px(ctx, 24, 53, 92, 2, "#5b4b7a");

    // poster
    px(ctx, 380, 22, 70, 54, "#1c1830");
    px(ctx, 384, 26, 62, 46, "#e2557a");
    px(ctx, 384, 26, 62, 14, "#ffd23f");
    px(ctx, 390, 46, 50, 4, "#1c1830");
    px(ctx, 390, 54, 40, 4, "#1c1830");
    px(ctx, 390, 62, 44, 4, "#1c1830");

    // string lights
    ctx.globalAlpha = 0.9;
    for (var L = 8; L < W; L += 26) {
      var yy = 8 + Math.sin(L * 0.3) * 3;
      var col = ["#ff5d8f", "#6ee7ff", "#ffd23f", "#a0e060"][(L / 26 | 0) % 4];
      px(ctx, L, yy, 3, 3, col);
    }
    ctx.globalAlpha = 1;

    // ---- desk ----
    px(ctx, 150, 176, 250, 10, "#6b4a2b");   // desk top
    px(ctx, 150, 176, 250, 3,  "#8a6540");   // top highlight
    px(ctx, 160, 186, 8, 70, "#4a3220");     // legs
    px(ctx, 384, 186, 8, 70, "#4a3220");

    // ---- monitor ----
    var m = HOTSPOTS.monitor;
    var hoverM = opts.hover === "monitor";
    // stand
    px(ctx, m.x + m.w / 2 - 6, m.y + m.h - 6, 12, 14, "#1a1626");
    px(ctx, m.x + m.w / 2 - 18, m.y + m.h + 6, 36, 4, "#1a1626");
    // bezel
    px(ctx, m.x - 4, m.y - 4, m.w + 8, m.h, hoverM ? "#4a4066" : "#2a2440");
    px(ctx, m.x, m.y, m.w, m.h - 10, "#0d0b16");
    // screen glow
    monitorScreen(ctx, m.x + 4, m.y + 4, m.w - 8, m.h - 22, t);
    if (hoverM) {
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 2;
      ctx.strokeRect(m.x - 5, m.y - 5, m.w + 10, m.h + 2);
    }

    // keyboard
    px(ctx, m.x + 6, m.y + m.h + 8, m.w - 12, 8, "#20263a");
    for (var kx = m.x + 9; kx < m.x + m.w - 10; kx += 8) {
      px(ctx, kx, m.y + m.h + 10, 5, 4, "#38405c");
    }

    // coffee mug w/ steam
    px(ctx, 344, 168, 14, 12, "#c94f4f");
    px(ctx, 356, 170, 4, 6, "#c94f4f");
    px(ctx, 346, 166, 10, 3, "#3a2a2a");
    ctx.globalAlpha = 0.4 + 0.2 * Math.sin(t * 4);
    px(ctx, 348, 156 + Math.sin(t * 3) * 2, 2, 6, "#cfc7e0");
    px(ctx, 352, 152 + Math.cos(t * 3) * 2, 2, 6, "#cfc7e0");
    ctx.globalAlpha = 1;

    // ---- character ----
    character(ctx, m.x + m.w / 2, m.y + m.h + 40, t, opts.mood);

    // ---- mini fridge ----
    var fr = HOTSPOTS.fridge;
    var hoverF = opts.hover === "fridge";
    var fridgeActive = opts.fridgeActive;
    px(ctx, fr.x, fr.y, fr.w, fr.h, hoverF || fridgeActive ? "#cfd6e6" : "#aeb6cc"); // body
    px(ctx, fr.x, fr.y, fr.w, 4, "#e6ecf6");
    px(ctx, fr.x, fr.y + 40, fr.w, 3, "#7c8298");      // door split
    px(ctx, fr.x + fr.w - 12, fr.y + 8, 5, 26, "#5b6072"); // top handle
    px(ctx, fr.x + fr.w - 12, fr.y + 50, 5, 40, "#5b6072"); // bottom handle
    // little logo
    px(ctx, fr.x + 10, fr.y + 12, 20, 14, "#e2557a");
    px(ctx, fr.x + 13, fr.y + 16, 14, 3, "#fff");
    px(ctx, fr.x + 13, fr.y + 21, 10, 3, "#fff");
    // magnet
    px(ctx, fr.x + 14, fr.y + 54, 8, 8, "#ffd23f");
    if (fridgeActive) {
      // glowing "OPEN ME" pulse
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 5);
      ctx.strokeStyle = "#6ee7ff";
      ctx.lineWidth = 3;
      ctx.strokeRect(fr.x - 3, fr.y - 3, fr.w + 6, fr.h + 6);
      ctx.globalAlpha = 1;
    }
    if (hoverF) {
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 2;
      ctx.strokeRect(fr.x - 3, fr.y - 3, fr.w + 6, fr.h + 6);
    }

    // plant in corner
    px(ctx, 470, 210, 26, 40, "#5a3b22");
    px(ctx, 472, 206, 22, 8, "#4a2f1a");
    px2circle(ctx, 483, 196, 12, "#3f8f4f");
    px2circle(ctx, 476, 188, 8, "#4fa85f");
    px2circle(ctx, 490, 190, 8, "#4fa85f");
    px2circle(ctx, 483, 182, 7, "#5fc06f");
  }

  // Animated monitor content: scrolling "code" + a spinning gear + hype bars.
  function monitorScreen(ctx, x, y, w, h, t) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // screen
    px(ctx, x, y, w, h, "#0a1e24");
    // scanline glow
    ctx.globalAlpha = 0.08;
    for (var sy = y; sy < y + h; sy += 3) px(ctx, x, sy, w, 1, "#6ee7ff");
    ctx.globalAlpha = 1;

    // scrolling code lines
    var off = (t * 18) % 12;
    ctx.globalAlpha = 0.8;
    for (var i = 0; i < 8; i++) {
      var ly = y + 6 + i * 12 - off;
      if (ly < y || ly > y + h - 4) continue;
      var lw = 20 + ((i * 37) % (w - 40));
      var col = i % 3 === 0 ? "#ff8a3d" : (i % 3 === 1 ? "#6ee7ff" : "#a0e060");
      px(ctx, x + 6, ly, 8, 3, "#ffd23f");
      px(ctx, x + 18, ly, lw * 0.4, 3, col);
      px(ctx, x + 18 + lw * 0.4 + 4, ly, lw * 0.3, 3, "#7c8298");
    }
    ctx.globalAlpha = 1;

    // spinning gear preview, bottom-right
    gear(ctx, x + w - 22, y + h - 18, 10, 8, t * 2, "#ffd23f", { glow: true, glowColor: "#ffd23f" });
    ctx.restore();
  }

  // ---- card thumbnail (drawn into a small offscreen canvas) ----
  function gearThumb(cvs, gdef, angle) {
    var ctx = cvs.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    var cx = cvs.width / 2, cy = cvs.height / 2;
    gear(ctx, cx, cy, cvs.width * 0.32, gdef.teeth || 8, angle || 0.4, gdef.tint);
  }

  function graphicThumb(cvs, gdef) {
    var ctx = cvs.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    var w = cvs.width, h = cvs.height;
    // little "art swatch": a framed canvas with a paint blob
    px(ctx, 6, 6, w - 12, h - 12, "#0d0b16");
    px(ctx, 6, 6, w - 12, h - 12, gdef.tint);
    px(ctx, 6, 6, w - 12, 5, shade(gdef.tint, 0.3));
    // paintbrush stroke
    px(ctx, w * 0.3, h * 0.55, w * 0.4, 4, "#0d0b16");
    px(ctx, w * 0.28, h * 0.4, 5, 5, "#fff");
    // frame
    ctx.strokeStyle = shade(gdef.tint, -0.4);
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }

  global.JamRender = {
    W: W, H: H,
    HOTSPOTS: HOTSPOTS,
    clear: clear,
    px: px,
    gear: gear,
    circle: px2circle,
    shade: shade,
    room: room,
    character: character,
    gearThumb: gearThumb,
    graphicThumb: graphicThumb
  };
})(window);
