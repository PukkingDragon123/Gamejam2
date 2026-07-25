/* =========================================================
   GAME JAM SIMULATOR — render.js
   Procedural pixel art. Cute, rounded, cartoony.
   Everything is drawn at runtime at 640×360 (no assets).
   ========================================================= */
(function (global) {
  "use strict";

  var L = global.JamData.LAYOUT;
  var W = L.W, H = L.H;

  var HOTSPOTS = {
    monitor: { x: 236, y: 150, w: 176, h: 118 },
    fridge:  { x: 512, y: 190, w: 104, h: 150 }
  };

  // -------------------------------------------------- helpers
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h)); }
  function clear(ctx) { ctx.clearRect(0, 0, W, H); }
  function circle(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fillRR(ctx, x, y, w, h, r, c) { rr(ctx, x, y, w, h, r); ctx.fillStyle = c; ctx.fill(); }

  function shade(hex, amt) {
    var c = hex.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")";
  }

  // -------------------------------------------------- glyphs
  // Small mechanic / logo icons drawn centred at (x,y) sized ~s.
  function glyph(ctx, key, x, y, s, col) {
    ctx.save();
    ctx.fillStyle = col; ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    var h = s / 2;
    switch (key) {
      case "core":
        ctx.beginPath(); ctx.arc(x, y, h * 0.8, 0, 6.28); ctx.stroke();
        circle(ctx, x, y, h * 0.28, col); break;
      case "up":
        ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.8, y + h * 0.2); ctx.lineTo(x - h * 0.8, y + h * 0.2); ctx.closePath(); ctx.fill();
        px(ctx, x - s * 0.14, y + h * 0.2, s * 0.28, h * 0.7, col); break;
      case "bullet":
        fillRR(ctx, x - h, y - s * 0.16, s * 0.9, s * 0.32, s * 0.16, col);
        circle(ctx, x + h * 0.7, y, s * 0.2, col); break;
      case "dash":
        px(ctx, x - h, y - s * 0.28, s, s * 0.16, col);
        px(ctx, x - h * 0.6, y - s * 0.02, s * 0.9, s * 0.16, col);
        px(ctx, x - h, y + s * 0.24, s * 0.7, s * 0.16, col); break;
      case "coin":
        ctx.beginPath(); ctx.arc(x, y, h * 0.85, 0, 6.28); ctx.stroke();
        // little star
        star(ctx, x, y, h * 0.5, col); break;
      case "note":
        px(ctx, x + h * 0.3, y - h, s * 0.16, s * 0.9, col);
        circle(ctx, x, y + h * 0.55, s * 0.24, col);
        px(ctx, x + h * 0.3, y - h, s * 0.5, s * 0.18, col); break;
      case "ball":
        ctx.beginPath(); ctx.arc(x, y, h * 0.8, 0, 6.28); ctx.stroke();
        circle(ctx, x - h * 0.25, y - h * 0.25, s * 0.16, col); break;
      case "bubble":
        fillRR(ctx, x - h, y - h * 0.9, s, s * 0.75, s * 0.2, col);
        ctx.beginPath(); ctx.moveTo(x - h * 0.2, y + h * 0.3); ctx.lineTo(x - h * 0.6, y + h); ctx.lineTo(x + h * 0.1, y + h * 0.3); ctx.closePath(); ctx.fill(); break;
      case "spark":
        star4(ctx, x, y, h, col); break;
      case "branch":
        ctx.beginPath();
        ctx.moveTo(x, y + h); ctx.lineTo(x, y);
        ctx.moveTo(x, y); ctx.lineTo(x - h * 0.7, y - h * 0.7);
        ctx.moveTo(x, y); ctx.lineTo(x + h * 0.7, y - h * 0.7);
        ctx.stroke();
        circle(ctx, x - h * 0.7, y - h * 0.7, s * 0.14, col);
        circle(ctx, x + h * 0.7, y - h * 0.7, s * 0.14, col); break;
      case "disk":
        fillRR(ctx, x - h, y - h, s, s, s * 0.12, col);
        px(ctx, x - h * 0.5, y - h, s * 0.6, s * 0.35, shade(col, -0.5));
        px(ctx, x - h * 0.3, y + h * 0.1, s * 0.6, s * 0.4, shade(col, -0.5)); break;
      case "skull":
        circle(ctx, x, y - h * 0.15, h * 0.75, col);
        px(ctx, x - h * 0.5, y + h * 0.3, s * 0.7, s * 0.28, col);
        px(ctx, x - h * 0.4, y - h * 0.25, s * 0.2, s * 0.24, shade(col, -0.7));
        px(ctx, x + h * 0.2, y - h * 0.25, s * 0.2, s * 0.24, shade(col, -0.7)); break;
      case "infin":
        ctx.beginPath(); ctx.arc(x - h * 0.4, y, h * 0.45, 0, 6.28); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + h * 0.4, y, h * 0.45, 0, 6.28); ctx.stroke(); break;
      case "cross":
        ctx.beginPath();
        ctx.moveTo(x - h * 0.7, y - h * 0.7); ctx.lineTo(x + h * 0.7, y + h * 0.7);
        ctx.moveTo(x + h * 0.7, y - h * 0.7); ctx.lineTo(x - h * 0.7, y + h * 0.7);
        ctx.stroke(); break;
      case "people":
        circle(ctx, x - h * 0.4, y - h * 0.3, s * 0.2, col);
        circle(ctx, x + h * 0.4, y - h * 0.3, s * 0.2, col);
        fillRR(ctx, x - h * 0.75, y + h * 0.05, s * 0.5, s * 0.5, s * 0.14, col);
        fillRR(ctx, x + h * 0.25, y + h * 0.05, s * 0.5, s * 0.5, s * 0.14, col); break;
      // drink logos
      case "bolt":
        ctx.beginPath(); ctx.moveTo(x + h * 0.2, y - h); ctx.lineTo(x - h * 0.5, y + h * 0.1);
        ctx.lineTo(x, y + h * 0.1); ctx.lineTo(x - h * 0.2, y + h); ctx.lineTo(x + h * 0.5, y - h * 0.1);
        ctx.lineTo(x, y - h * 0.1); ctx.closePath(); ctx.fill(); break;
      case "drop":
        ctx.beginPath(); ctx.moveTo(x, y - h); ctx.quadraticCurveTo(x + h, y + h * 0.3, x, y + h);
        ctx.quadraticCurveTo(x - h, y + h * 0.3, x, y - h); ctx.fill(); break;
      case "bean":
        ctx.beginPath(); ctx.ellipse(x, y, h * 0.6, h * 0.85, 0.4, 0, 6.28); ctx.fill();
        ctx.strokeStyle = shade(col, -0.6); ctx.beginPath(); ctx.moveTo(x - h * 0.2, y - h * 0.5); ctx.quadraticCurveTo(x + h * 0.2, y, x - h * 0.2, y + h * 0.5); ctx.stroke(); break;
      case "atom":
        circle(ctx, x, y, s * 0.16, col);
        ctx.save(); ctx.translate(x, y);
        for (var a = 0; a < 3; a++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, 0, h, h * 0.4, 0, 0, 6.28); ctx.stroke(); }
        ctx.restore(); break;
      case "star": star(ctx, x, y, h * 0.9, col); break;
      case "pad":
        fillRR(ctx, x - h, y - h * 0.4, s, s * 0.7, s * 0.2, col);
        circle(ctx, x + h * 0.5, y, s * 0.12, shade(col, -0.6));
        px(ctx, x - h * 0.65, y - s * 0.06, s * 0.28, s * 0.12, shade(col, -0.6));
        px(ctx, x - h * 0.53, y - s * 0.18, s * 0.12, s * 0.28, shade(col, -0.6)); break;
      case "cola":
        px(ctx, x - h * 0.7, y - h, s * 1.0, s * 0.22, col); // ribbon
        ctx.font = "italic " + Math.round(s * 0.7) + "px Georgia"; ctx.fillStyle = col;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("C", x, y + s * 0.15); break;
      case "void":
        circle(ctx, x, y, h * 0.85, col);
        circle(ctx, x, y, h * 0.5, shade(col, -0.8)); break;
      default:
        circle(ctx, x, y, s * 0.2, col);
    }
    ctx.restore();
  }
  function star(ctx, x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      var a2 = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
    }
    ctx.closePath(); ctx.fill();
  }
  function star4(ctx, x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.28, y - r * 0.28);
    ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.28, y + r * 0.28);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.28, y + r * 0.28);
    ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.28, y - r * 0.28);
    ctx.closePath(); ctx.fill();
  }

  // -------------------------------------------------- GEAR (machined metal, 3D)
  function gear(ctx, cx, cy, r, gdef, angle, opts) {
    opts = opts || {};
    var tint = gdef.tint;
    var edge = shade(tint, -0.68), dark = shade(tint, -0.42), mid = shade(tint, -0.08),
        lite = shade(tint, 0.32), hi = shade(tint, 0.6);

    // grounded contact shadow
    ctx.save(); ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.86, r * 0.86, r * 0.26, 0, 0, 6.28); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();

    // connection rim-glow
    if (opts.glow) {
      ctx.save(); ctx.globalAlpha = 0.32 + 0.12 * Math.sin((opts.t || 0) * 4);
      circle(ctx, cx, cy, r + 3.5, opts.glowColor || "#ffcf4d"); ctx.restore();
    }

    // ---- rotating cog ----
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    var teeth = gdef.teeth || 8, step = 6.2832 / teeth;
    // teeth: shaded trapezoid blocks with a lit top facet
    for (var i = 0; i < teeth; i++) {
      ctx.save(); ctx.rotate(i * step);
      var tw = r * 0.30, th = r * 0.34, ty = -r - th * 0.18;
      ctx.fillStyle = edge; fillRR(ctx, -tw * 0.62, ty, tw * 1.24, th + 2, r * 0.06);   // dark base/side
      ctx.fillStyle = mid;  fillRR(ctx, -tw * 0.5, ty, tw, th, r * 0.05);                // face
      ctx.fillStyle = hi; ctx.globalAlpha = 0.55; fillRR(ctx, -tw * 0.4, ty, tw * 0.8, th * 0.34, r * 0.05); ctx.globalAlpha = 1; // top light
      ctx.restore();
    }
    // body disc — radial metal gradient
    var bg = ctx.createRadialGradient(-r * 0.34, -r * 0.34, r * 0.08, 0, 0, r);
    bg.addColorStop(0, lite); bg.addColorStop(0.55, mid); bg.addColorStop(1, dark);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill();
    // outer bevel ring
    ctx.lineWidth = Math.max(1.5, r * 0.11); ctx.strokeStyle = edge; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, 6.28); ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = hi; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke(); ctx.globalAlpha = 1;
    // spokes (rotate with cog)
    for (var sp = 0; sp < 4; sp++) {
      ctx.save(); ctx.rotate(sp * 1.5708);
      ctx.fillStyle = dark; fillRR(ctx, -r * 0.09, -r * 0.66, r * 0.18, r * 0.5, r * 0.06);
      ctx.fillStyle = lite; ctx.globalAlpha = 0.5; fillRR(ctx, -r * 0.075, -r * 0.66, r * 0.05, r * 0.5, r * 0.04); ctx.globalAlpha = 1;
      ctx.restore();
    }
    ctx.restore();

    // ---- static raised hub w/ engraved insignia ----
    var hr = r * 0.5;
    var hg = ctx.createRadialGradient(cx - hr * 0.4, cy - hr * 0.4, hr * 0.1, cx, cy, hr);
    hg.addColorStop(0, hi); hg.addColorStop(0.6, lite); hg.addColorStop(1, dark);
    ctx.fillStyle = hg; circle(ctx, cx, cy, hr);
    ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = edge; ctx.beginPath(); ctx.arc(cx, cy, hr, 0, 6.28); ctx.stroke();
    ctx.strokeStyle = hi; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(cx, cy, hr * 0.86, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke(); ctx.globalAlpha = 1;
    // engraved icon (embossed: darkbase + light top)
    if (gdef.icon && gdef.icon !== "core") {
      glyph(ctx, gdef.icon, cx, cy + Math.max(1, r * 0.04), hr * 1.02, "rgba(0,0,0,0.45)");
      glyph(ctx, gdef.icon, cx, cy - Math.max(0.5, r * 0.02), hr * 1.02, shade(tint, 0.62));
    } else {
      // core: a central bolt hole with depth
      ctx.fillStyle = edge; circle(ctx, cx, cy, hr * 0.4);
      ctx.fillStyle = dark; circle(ctx, cx, cy, hr * 0.28);
      ctx.fillStyle = hi; ctx.globalAlpha = 0.6; circle(ctx, cx - hr * 0.1, cy - hr * 0.1, hr * 0.1); ctx.globalAlpha = 1;
    }

    // art-style ring
    if (opts.graphicTint) {
      ctx.save(); ctx.lineWidth = 2.5; ctx.strokeStyle = opts.graphicTint;
      ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 6.28); ctx.stroke();
      circle(ctx, cx + r * 0.72, cy - r * 0.72, 2.6, opts.graphicTint); ctx.restore();
    }

    if (opts.jammed) {
      ctx.save(); ctx.globalAlpha = 0.5; circle(ctx, cx, cy, r + 1, "#000"); ctx.restore();
      ctx.strokeStyle = "#ff5566"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy - r * 0.6); ctx.lineTo(cx + r * 0.6, cy + r * 0.6);
      ctx.moveTo(cx + r * 0.6, cy - r * 0.6); ctx.lineTo(cx - r * 0.6, cy + r * 0.6); ctx.stroke();
    }
  }

  // -------------------------------------------------- card thumbs
  function gearThumb(cvs, gdef) {
    var ctx = cvs.getContext("2d"); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    gear(ctx, cvs.width / 2, cvs.height * 0.46, cvs.width * 0.36, gdef, 0.5, {});
  }

  function graphicThumb(cvs, gd) {
    var ctx = cvs.getContext("2d"); ctx.imageSmoothingEnabled = false;
    var w = cvs.width, h = cvs.height;
    ctx.clearRect(0, 0, w, h);
    fillRR(ctx, 4, 4, w - 8, h - 8, 5, "#0d0b16");
    fillRR(ctx, 6, 6, w - 12, h - 12, 4, gd.tint);
    // style-specific swatch
    var cx = w / 2, cy = h / 2, s = w * 0.5, dk = shade(gd.tint, -0.55), lt = shade(gd.tint, 0.5);
    ctx.save();
    switch (gd.icon) {
      case "pixel":
        for (var yy = 0; yy < 3; yy++) for (var xx = 0; xx < 3; xx++)
          px(ctx, cx - s * 0.5 + xx * s * 0.34, cy - s * 0.5 + yy * s * 0.34, s * 0.3, s * 0.3, (xx + yy) % 2 ? dk : lt);
        break;
      case "neon":
        ctx.shadowColor = "#fff"; ctx.shadowBlur = 6; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        rr(ctx, cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8, 4); ctx.stroke(); break;
      case "lowpoly":
        ctx.fillStyle = dk; ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.5); ctx.lineTo(cx + s * 0.5, cy + s * 0.4); ctx.lineTo(cx - s * 0.5, cy + s * 0.4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = lt; ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.5); ctx.lineTo(cx + s * 0.5, cy + s * 0.4); ctx.lineTo(cx, cy + s * 0.1); ctx.closePath(); ctx.fill(); break;
      case "vapor":
        circle(ctx, cx, cy - s * 0.05, s * 0.4, lt);
        for (var g = 0; g < 3; g++) px(ctx, cx - s * 0.4, cy + s * 0.05 + g * s * 0.16, s * 0.8, s * 0.06, dk); break;
      case "clay":
        circle(ctx, cx, cy, s * 0.42, lt); circle(ctx, cx - s * 0.12, cy - s * 0.12, s * 0.16, "#fff"); break;
      case "crt":
        for (var l = 0; l < 5; l++) px(ctx, cx - s * 0.45, cy - s * 0.45 + l * s * 0.22, s * 0.9, s * 0.1, l % 2 ? dk : lt); break;
      case "hand":
        ctx.strokeStyle = dk; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy + s * 0.2); ctx.quadraticCurveTo(cx, cy - s * 0.6, cx + s * 0.4, cy + s * 0.1); ctx.stroke(); break;
      case "anime":
        star(ctx, cx, cy, s * 0.45, "#fff"); circle(ctx, cx + s * 0.15, cy - s * 0.15, s * 0.08, gd.tint); break;
      default:
        glyph(ctx, gd.icon, cx, cy, s, dk);
    }
    ctx.restore();
    ctx.strokeStyle = shade(gd.tint, -0.4); ctx.lineWidth = 2; rr(ctx, 6, 6, w - 12, h - 12, 4); ctx.stroke();
  }

  // -------------------------------------------------- drink can
  function drinkCan(ctx, cx, cy, s, drink) {
    var b = drink.can.body, a = drink.can.accent;
    var w = s * 0.62, h = s;
    // shadow
    ctx.save(); ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.5, w * 0.7, s * 0.09, 0, 0, 6.28); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();
    // body
    fillRR(ctx, cx - w / 2, cy - h / 2, w, h, w * 0.22, b);
    // top rim
    fillRR(ctx, cx - w / 2, cy - h / 2, w, h * 0.12, w * 0.22, shade(b, 0.35));
    px(ctx, cx - w * 0.18, cy - h / 2 - h * 0.05, w * 0.36, h * 0.06, "#c7ccd6"); // pull tab area
    // accent band
    px(ctx, cx - w / 2, cy - h * 0.06, w, h * 0.30, a);
    px(ctx, cx - w / 2, cy - h * 0.06, w, h * 0.05, shade(a, 0.4));
    // logo
    glyph(ctx, drink.can.logo, cx, cy + h * 0.09, w * 0.5, shade(b, -0.5));
    // highlight
    ctx.save(); ctx.globalAlpha = 0.25; fillRR(ctx, cx - w * 0.34, cy - h * 0.4, w * 0.18, h * 0.8, w * 0.09, "#fff"); ctx.restore();
    // outline
    ctx.strokeStyle = shade(b, -0.5); ctx.lineWidth = 1.5; rr(ctx, cx - w / 2, cy - h / 2, w, h, w * 0.22); ctx.stroke();
  }

  // -------------------------------------------------- booster pack
  function boosterPack(ctx, cx, cy, s, t) {
    var w = s * 0.72, h = s;
    ctx.save(); ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.55, w * 0.7, s * 0.08, 0, 0, 6.28); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();
    // foil body
    var grad = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
    grad.addColorStop(0, "#3a2f6a"); grad.addColorStop(0.5, "#7a5fd0"); grad.addColorStop(1, "#3a2f6a");
    fillRR(ctx, cx - w / 2, cy - h / 2, w, h, 6, "#2a2450"); ctx.save(); rr(ctx, cx - w / 2, cy - h / 2, w, h, 6); ctx.clip();
    ctx.fillStyle = grad; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    // shine sweep
    ctx.globalAlpha = 0.3; ctx.fillStyle = "#fff";
    var sx = cx - w / 2 + ((t * 40) % (w + 40)) - 20;
    ctx.beginPath(); ctx.moveTo(sx, cy - h / 2); ctx.lineTo(sx + 10, cy - h / 2); ctx.lineTo(sx - 6, cy + h / 2); ctx.lineTo(sx - 16, cy + h / 2); ctx.closePath(); ctx.fill();
    ctx.restore();
    // crimped top
    for (var i = 0; i < 8; i++) px(ctx, cx - w / 2 + i * (w / 8), cy - h / 2, w / 16, h * 0.06, i % 2 ? "#e0d6ff" : "#8a7fd0");
    // label
    fillRR(ctx, cx - w * 0.38, cy - h * 0.12, w * 0.76, h * 0.34, 4, "#12101c");
    ctx.fillStyle = "#ffcf4d"; ctx.font = "bold 8px 'Courier New',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("ASSET", cx, cy); ctx.fillStyle = "#5df0ff"; ctx.fillText("PACK", cx, cy + h * 0.11);
    // star
    star(ctx, cx, cy - h * 0.3, s * 0.1, "#ffcf4d");
    ctx.strokeStyle = "#1a1630"; ctx.lineWidth = 1.5; rr(ctx, cx - w / 2, cy - h / 2, w, h, 6); ctx.stroke();
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  // -------------------------------------------------- character (cute dev)
  function character(ctx, x, y, t, mood) {
    var bob = Math.sin(t * 5) * 1.4;
    var hood = mood === "happy" ? "#ffcf4d" : (mood === "sad" ? "#8a6bd0" : "#5b6bd0");
    // chair
    fillRR(ctx, x - 17, y - 6, 34, 34, 6, "#3a2f52");
    fillRR(ctx, x - 14, y - 3, 28, 28, 5, "#4a3d66");
    // body/hoodie
    fillRR(ctx, x - 14, y - 20 + bob, 28, 28, 8, hood);
    fillRR(ctx, x - 14, y - 20 + bob, 28, 8, 8, shade(hood, 0.2));
    // arms
    fillRR(ctx, x - 17, y - 4 + bob, 8, 12, 4, hood);
    fillRR(ctx, x + 9, y - 4 + bob, 8, 12, 4, hood);
    // head (big round, cute)
    circle(ctx, x, y - 30 + bob, 12, "#f0c096");
    // beanie
    fillRR(ctx, x - 12, y - 42 + bob, 24, 12, 6, "#e2557a");
    fillRR(ctx, x - 12, y - 34 + bob, 24, 4, 2, shade("#e2557a", -0.2));
    circle(ctx, x, y - 44 + bob, 3, "#ffd94d"); // pom
    // headphones (cute + dev)
    ctx.strokeStyle = "#2a2440"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 33 + bob, 13, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    circle(ctx, x - 12, y - 29 + bob, 4, "#5df0ff");
    circle(ctx, x + 12, y - 29 + bob, 4, "#5df0ff");
    if (mood === "happy") { // little smile turn (3/4)
      circle(ctx, x + 6, y - 29 + bob, 1.5, "#2a2440");
    }
  }

  // -------------------------------------------------- ROOM (cute, detailed)
  function room(ctx, t, opts) {
    opts = opts || {};
    clear(ctx);
    // wall
    var wg = ctx.createLinearGradient(0, 0, 0, 200); wg.addColorStop(0, "#332a54"); wg.addColorStop(1, "#2a2444");
    ctx.fillStyle = wg; ctx.fillRect(0, 0, W, 210);
    // wainscoting
    px(ctx, 0, 190, W, 6, "#241d3c");
    px(ctx, 0, 196, W, 20, "#3a2f56");
    ctx.globalAlpha = 0.3; for (var wv = 12; wv < W; wv += 30) px(ctx, wv, 196, 2, 20, "#241d3c"); ctx.globalAlpha = 1;
    // floor
    var fg = ctx.createLinearGradient(0, 216, 0, H); fg.addColorStop(0, "#6b4a2f"); fg.addColorStop(1, "#503522");
    ctx.fillStyle = fg; ctx.fillRect(0, 216, W, H - 216);
    ctx.globalAlpha = 0.25; for (var fb = 0; fb < W; fb += 46) px(ctx, fb + (Math.floor(t) % 2 ? 0 : 0), 216, 2, H - 216, "#3a2416"); ctx.globalAlpha = 1;
    // round rug
    ctx.save(); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(300, 322, 150, 34, 0, 0, 6.28); ctx.fillStyle = "#c14f6a"; ctx.fill();
    ctx.beginPath(); ctx.ellipse(300, 322, 110, 24, 0, 0, 6.28); ctx.fillStyle = "#e07a94"; ctx.fill();
    ctx.beginPath(); ctx.ellipse(300, 322, 70, 15, 0, 0, 6.28); ctx.fillStyle = "#c14f6a"; ctx.fill(); ctx.restore();

    // string lights
    for (var s = 6; s < W; s += 28) {
      var yy = 6 + Math.sin(s * 0.25 + t) * 3;
      var lc = ["#ff5d8f", "#5df0ff", "#ffd94d", "#8ee65a"][(s / 28 | 0) % 4];
      ctx.globalAlpha = 0.5; circle(ctx, s, yy, 4, lc); ctx.globalAlpha = 1; circle(ctx, s, yy, 2.2, lc);
    }

    // window w/ night city
    fillRR(ctx, 30, 26, 118, 92, 8, "#4a3d6e");
    ctx.save(); rr(ctx, 36, 32, 106, 80, 5); ctx.clip();
    var sky = ctx.createLinearGradient(0, 32, 0, 112); sky.addColorStop(0, "#12183a"); sky.addColorStop(1, "#3a2a5a");
    ctx.fillStyle = sky; ctx.fillRect(36, 32, 106, 80);
    // stars
    var st = [[52, 46], [80, 40], [110, 52], [128, 44], [66, 60], [120, 68]];
    for (var i = 0; i < st.length; i++) { ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3 + i)); circle(ctx, st[i][0], st[i][1], 1.4, "#fff"); }
    ctx.globalAlpha = 1;
    circle(ctx, 120, 50, 9, "#f4f0d0"); circle(ctx, 116, 47, 6, sky ? "#20264a" : "#20264a");
    // city silhouette
    var b = "#1a1436";
    px(ctx, 36, 92, 16, 20, b); px(ctx, 54, 84, 12, 28, b); px(ctx, 68, 96, 18, 16, b);
    px(ctx, 88, 78, 14, 34, b); px(ctx, 104, 90, 12, 22, b); px(ctx, 118, 84, 16, 28, b);
    // lit windows
    ctx.fillStyle = "#ffd94d"; ctx.globalAlpha = 0.8;
    px(ctx, 92, 84, 3, 3, "#ffd94d"); px(ctx, 98, 92, 3, 3, "#ffd94d"); px(ctx, 58, 92, 3, 3, "#ffd94d"); px(ctx, 122, 92, 3, 3, "#ffd94d");
    ctx.globalAlpha = 1;
    ctx.restore();
    px(ctx, 88, 32, 3, 80, "#4a3d6e"); px(ctx, 36, 70, 106, 3, "#4a3d6e");

    // wall clock (ticking, thematic stress)
    circle(ctx, 470, 60, 22, "#e8e6f0"); circle(ctx, 470, 60, 22, "#e8e6f0");
    ctx.strokeStyle = "#3a2f56"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(470, 60, 21, 0, 6.28); ctx.stroke();
    for (var m = 0; m < 12; m++) { var ma = m * Math.PI / 6; px(ctx, 470 + Math.cos(ma) * 17 - 1, 60 + Math.sin(ma) * 17 - 1, 2, 2, "#3a2f56"); }
    var mh = t * 0.5, hh = t * 0.06;
    ctx.strokeStyle = "#c8324a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(470, 60); ctx.lineTo(470 + Math.cos(mh) * 15, 60 + Math.sin(mh) * 15); ctx.stroke();
    ctx.strokeStyle = "#3a2f56"; ctx.beginPath(); ctx.moveTo(470, 60); ctx.lineTo(470 + Math.cos(hh) * 10, 60 + Math.sin(hh) * 10); ctx.stroke();
    circle(ctx, 470, 60, 2, "#3a2f56");

    // corkboard w/ sticky notes
    fillRR(ctx, 176, 34, 96, 64, 4, "#b58a4a");
    fillRR(ctx, 180, 38, 88, 56, 2, "#caa060");
    fillRR(ctx, 186, 44, 30, 26, 2, "#ffe66a"); fillRR(ctx, 222, 46, 30, 24, 2, "#7ae0ff"); fillRR(ctx, 196, 66, 32, 22, 2, "#ff9ec2");
    ctx.globalAlpha = 0.5; px(ctx, 190, 52, 20, 2, "#7a5a2a"); px(ctx, 190, 58, 16, 2, "#7a5a2a"); px(ctx, 226, 54, 20, 2, "#3a6a7a"); ctx.globalAlpha = 1;

    // shelf w/ plant + trophy + sleeping cat
    px(ctx, 300, 96, 150, 6, "#5a3d24"); px(ctx, 300, 102, 150, 3, "#3a2416");
    // plant
    fillRR(ctx, 312, 78, 16, 18, 3, "#c86a3a"); circle(ctx, 320, 74, 10, "#3f9f4f"); circle(ctx, 313, 68, 7, "#4fb85f"); circle(ctx, 327, 70, 7, "#4fb85f");
    // trophy
    circle(ctx, 366, 84, 8, "#ffd24d"); px(ctx, 362, 88, 8, 6, "#ffd24d"); px(ctx, 360, 94, 12, 3, "#e0a020"); px(ctx, 358, 90, 4, 4, "#ffd24d"); px(ctx, 370, 90, 4, 4, "#ffd24d");
    // sleeping cat
    ctx.fillStyle = "#4a4458"; ctx.beginPath(); ctx.ellipse(418, 92, 22, 9, 0, 0, 6.28); ctx.fill();
    circle(ctx, 400, 90, 8, "#4a4458"); px(ctx, 396, 84, 3, 4, "#4a4458"); px(ctx, 402, 84, 3, 4, "#4a4458");
    ctx.strokeStyle = "#2a2440"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(400, 90, 5, 0.2, 1.2); ctx.stroke(); // closed eye
    ctx.fillStyle = "#9a93b8"; ctx.font = "8px 'Courier New',monospace"; ctx.fillText("z", 388, 82); ctx.fillText("Z", 382, 76);

    // ---- desk ----
    fillRR(ctx, 176, 250, 300, 14, 5, "#7a5432"); px(ctx, 176, 250, 300, 4, "#946640");
    px(ctx, 190, 264, 10, 78, "#5a3d24"); px(ctx, 452, 264, 10, 78, "#5a3d24");

    // desk lamp (glow)
    px(ctx, 200, 214, 6, 38, "#3a3550"); px(ctx, 200, 214, 26, 6, "#3a3550");
    fillRR(ctx, 218, 206, 20, 12, 4, "#ffd24d");
    ctx.save(); ctx.globalAlpha = 0.18 + 0.05 * Math.sin(t * 4); ctx.fillStyle = "#ffe9a0";
    ctx.beginPath(); ctx.moveTo(228, 218); ctx.lineTo(200, 252); ctx.lineTo(268, 252); ctx.closePath(); ctx.fill(); ctx.restore();

    // ---- monitor (hotspot) ----
    var mo = HOTSPOTS.monitor, hovM = opts.hover === "monitor";
    px(ctx, mo.x + mo.w / 2 - 6, mo.y + mo.h - 4, 12, 14, "#2a2440");
    px(ctx, mo.x + mo.w / 2 - 20, mo.y + mo.h + 8, 40, 5, "#2a2440");
    fillRR(ctx, mo.x - 6, mo.y - 6, mo.w + 12, mo.h + 4, 8, hovM ? "#5a4d80" : "#2f2850");
    fillRR(ctx, mo.x - 2, mo.y - 2, mo.w + 4, mo.h - 8, 4, "#0b1418");
    monitorScreen(ctx, mo.x + 2, mo.y + 2, mo.w, mo.h - 14, t);
    if (hovM) { ctx.strokeStyle = "#ffcf4d"; ctx.lineWidth = 2; rr(ctx, mo.x - 7, mo.y - 7, mo.w + 14, mo.h + 6, 9); ctx.stroke(); }
    // sticky on monitor
    fillRR(ctx, mo.x + mo.w - 6, mo.y + 8, 22, 20, 2, "#ffe66a"); ctx.fillStyle = "#a07a2a"; ctx.font = "6px monospace"; ctx.fillText("FIX", mo.x + mo.w - 2, mo.y + 20);

    // keyboard + mouse
    fillRR(ctx, mo.x + 2, mo.y + mo.h + 14, mo.w - 4, 12, 3, "#252b40");
    for (var kx = mo.x + 8; kx < mo.x + mo.w - 8; kx += 9) px(ctx, kx, mo.y + mo.h + 17, 6, 5, "#3a4260");
    fillRR(ctx, mo.x + mo.w + 8, mo.y + mo.h + 15, 12, 16, 5, "#252b40");

    // coffee mug w/ steam
    fillRR(ctx, 420, 232, 18, 16, 3, "#c94f4f"); px(ctx, 438, 235, 5, 8, "#c94f4f"); px(ctx, 422, 230, 14, 3, "#3a2a2a");
    ctx.globalAlpha = 0.4 + 0.15 * Math.sin(t * 4); px(ctx, 424, 218 + Math.sin(t * 3) * 2, 2, 8, "#cfc7e0"); px(ctx, 430, 214 + Math.cos(t * 3) * 2, 2, 8, "#cfc7e0"); ctx.globalAlpha = 1;

    // character
    character(ctx, mo.x + mo.w / 2, mo.y + mo.h + 52, t, opts.mood);

    // scattered empty cans (jam mess)
    tinyCan(ctx, 250, 336, "#2f8f3f"); tinyCan(ctx, 268, 340, "#c8324a"); tinyCan(ctx, 156, 330, "#3a4a6a");

    // ---- mini fridge (hotspot) ----
    var fr = HOTSPOTS.fridge, hovF = opts.hover === "fridge", act = opts.fridgeActive;
    fillRR(ctx, fr.x, fr.y, fr.w, fr.h, 10, (hovF || act) ? "#e2e8f4" : "#c6cde0");
    fillRR(ctx, fr.x, fr.y, fr.w, 10, 8, "#eef2fa");
    px(ctx, fr.x + 6, fr.y + fr.h * 0.42, fr.w - 12, 3, "#8a90a6"); // door split
    fillRR(ctx, fr.x + fr.w - 12, fr.y + 12, 5, fr.h * 0.32, 2, "#6a7086");
    fillRR(ctx, fr.x + fr.w - 12, fr.y + fr.h * 0.5, 5, fr.h * 0.4, 2, "#6a7086");
    // brand + magnets + stickers
    fillRR(ctx, fr.x + 12, fr.y + 14, 26, 18, 3, "#ff5d8f"); ctx.fillStyle = "#fff"; ctx.font = "bold 7px monospace"; ctx.fillText("COOL", fr.x + 15, fr.y + 26);
    star(ctx, fr.x + 20, fr.y + fr.h * 0.62, 6, "#ffd24d");
    circle(ctx, fr.x + 40, fr.y + fr.h * 0.6, 5, "#5df0ff");
    fillRR(ctx, fr.x + 30, fr.y + fr.h * 0.72, 22, 12, 2, "#8ee65a"); ctx.fillStyle="#2a4a1a"; ctx.font="6px monospace"; ctx.fillText("JAM", fr.x+34, fr.y+fr.h*0.72+9);
    if (act) { ctx.save(); ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 5); ctx.strokeStyle = "#5df0ff"; ctx.lineWidth = 3; rr(ctx, fr.x - 3, fr.y - 3, fr.w + 6, fr.h + 6, 12); ctx.stroke(); ctx.restore(); }
    if (hovF) { ctx.strokeStyle = "#ffcf4d"; ctx.lineWidth = 2; rr(ctx, fr.x - 3, fr.y - 3, fr.w + 6, fr.h + 6, 12); ctx.stroke(); }
  }

  function tinyCan(ctx, x, y, c) { fillRR(ctx, x, y, 7, 11, 2, c); px(ctx, x, y + 4, 7, 3, shade(c, 0.4)); }

  function monitorScreen(ctx, x, y, w, h, t) {
    ctx.save(); rr(ctx, x, y, w, h, 3); ctx.clip();
    px(ctx, x, y, w, h, "#0a1a20");
    ctx.globalAlpha = 0.06; for (var sy = y; sy < y + h; sy += 3) px(ctx, x, sy, w, 1, "#5df0ff"); ctx.globalAlpha = 1;
    var off = (t * 16) % 12;
    ctx.globalAlpha = 0.85;
    for (var i = 0; i < 9; i++) {
      var ly = y + 5 + i * 12 - off; if (ly < y + 1 || ly > y + h - 3) continue;
      var lw = 16 + ((i * 43) % (w - 34));
      var col = i % 3 === 0 ? "#ff934d" : (i % 3 === 1 ? "#5df0ff" : "#8ee65a");
      px(ctx, x + 5, ly, 6, 3, "#ffcf4d"); px(ctx, x + 14, ly, lw * 0.4, 3, col); px(ctx, x + 14 + lw * 0.4 + 4, ly, lw * 0.3, 3, "#6a7290");
    }
    ctx.globalAlpha = 1;
    gear(ctx, x + w - 20, y + h - 16, 11, { teeth: 8, tint: "#ffcf4d", icon: "core" }, t * 2, { glow: true, eyes: false });
    ctx.restore();
  }

  // -------------------------------------------------- IDE panel frame
  function panel(ctx, r, title, accent) {
    fillRR(ctx, r.x, r.y, r.w, r.h, 4, "#1c140d");
    px(ctx, r.x, r.y, r.w, 16, "#2c2016");
    fillRR(ctx, r.x, r.y, r.w, 16, 4, "#2c2016"); px(ctx, r.x, r.y + 8, r.w, 8, "#2c2016");
    circle(ctx, r.x + 8, r.y + 8, 2.5, accent || "#ff7a9c");
    circle(ctx, r.x + 16, r.y + 8, 2.5, "#ffca55");
    circle(ctx, r.x + 24, r.y + 8, 2.5, "#7bd88a");
    ctx.fillStyle = "#e4d6c2"; ctx.font = "8px 'Courier New',monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(title, r.x + 34, r.y + 8);
    ctx.strokeStyle = "#4a3928"; ctx.lineWidth = 1; rr(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 4); ctx.stroke();
    ctx.textBaseline = "alphabetic";
  }

  // ============================================================
  //  ASSET-AWARE DRAWING (uses uploaded art if present, else falls
  //  back to the procedural sprites above)
  // ============================================================
  var AS = function () { return global.JamAssets; };

  // Draw an image "cover" style, filling w×h, cropping overflow.
  function drawCover(ctx, cv, x, y, w, h) {
    var s = Math.max(w / cv.width, h / cv.height);
    var dw = cv.width * s, dh = cv.height * s;
    ctx.drawImage(cv, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  // Draw an image scaled to a target height, centred at (cx, bottomY=feet).
  function drawSprite(ctx, cv, cx, feetY, targetH, flip) {
    var s = targetH / cv.height, dw = cv.width * s, dh = targetH;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(cx + dw / 2, feetY - dh);
      ctx.scale(-1, 1);
      ctx.drawImage(cv, 0, 0, dw, dh);
    } else {
      ctx.drawImage(cv, cx - dw / 2, feetY - dh, dw, dh);
    }
    ctx.restore();
  }

  // ---- room background (image if available, else simple fallback) ----
  function roomScene(ctx, t, opts) {
    opts = opts || {};
    var A = AS();
    if (A && A.has("room")) {
      drawCover(ctx, A.get("room"), 0, 0, W, H);
    } else {
      // minimal fallback: wall + carpet + a little desk/CRT on the left
      clear(ctx);
      var wg = ctx.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, "#2e2746"); wg.addColorStop(1, "#241d38");
      ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
      px(ctx, 0, H * 0.62, W, H * 0.38, "#3a4a3a");           // carpet
      px(ctx, 0, H * 0.62, W, 4, "#2a3a2a");
      // desk + CRT (roughly at the computer zone)
      var cz = global.JamData.CONFIG.room.computerZone;
      var dx = cz.x * W, dy = cz.y * H, dw = cz.w * W, dh = cz.h * H;
      fillRR(ctx, dx, dy + dh * 0.75, dw, dh * 0.4, 4, "#6b4a2f");
      fillRR(ctx, dx + dw * 0.14, dy, dw * 0.7, dh * 0.8, 6, "#c9cdd8"); // CRT body
      fillRR(ctx, dx + dw * 0.22, dy + dh * 0.1, dw * 0.54, dh * 0.5, 3, "#0b1418");
      monitorScreen(ctx, dx + dw * 0.24, dy + dh * 0.12, dw * 0.5, dh * 0.44, t);
    }
    // computer hover highlight
    if (opts.hoverComputer) {
      var z = global.JamData.CONFIG.room.computerZone;
      ctx.save(); ctx.strokeStyle = "#ffcf4d"; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 6);
      rr(ctx, z.x * W, z.y * H, z.w * W, z.h * H, 6); ctx.stroke(); ctx.restore();
    }
  }

  // ---- player sprite (sheet frame if available, else procedural) ----
  function playerSprite(ctx, frameName, cx, feetY, targetH, flip, t, mood) {
    var A = AS(), F = global.JamData.CONFIG.playerFrames;
    if (A && A.has("player") && F[frameName] != null) {
      var cv = A.frame("player", F[frameName]);
      if (cv) { drawSprite(ctx, cv, cx, feetY, targetH, flip); return; }
    }
    // fallback: procedural chibi (mood approximated from frame)
    var m = (frameName === "cheer") ? "happy" : (frameName === "tired" ? "sad" : "");
    character(ctx, cx, feetY - targetH * 0.5, t || 0, mood || m);
  }

  // ---- drink (sheet slice if available, else procedural can) ----
  function drinkSprite(ctx, drink, cx, cy, targetH) {
    var A = AS();
    if (A && A.has("drinks")) {
      var cv = A.frame("drinks", drink.sprite || 0);
      if (cv) {
        var s = targetH / cv.height;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cv, cx - cv.width * s / 2, cy - targetH / 2, cv.width * s, targetH);
        return;
      }
    }
    drinkCan(ctx, cx, cy, targetH, drink);
  }

  // ---- pack tearing open (rip 0..1) ----
  function packRip(ctx, type, cx, cy, targetH, rip, t) {
    var A = AS();
    var name = type === "graphics" ? "pack_graphics" : (type === "pets" ? "pack_pets" : "pack_gears");
    var img = (A && A.has(name)) ? A.get(name) : null;
    var bob = rip <= 0 ? Math.sin(t * 3) * 3 : 0;
    if (!img) { boosterPack(ctx, cx + (rip > 0 ? (Math.random() - 0.5) * 5 : 0), cy + bob, targetH, t); }
    else {
      var s = targetH / img.height, dw = img.width * s, dh = targetH;
      var tearY = img.height * 0.40;                 // tear just below the crimped top
      var sep = rip * dh * 0.55;
      var jitter = rip > 0 ? (Math.random() - 0.5) * 4 * rip : 0;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      // bottom half (draw first, behind)
      ctx.drawImage(img, 0, tearY, img.width, img.height - tearY, cx - dw / 2 + jitter, cy - dh / 2 + tearY * s + sep, dw, (img.height - tearY) * s);
      // top strip (the ripped-off lid), flies up + tilts
      ctx.save(); ctx.translate(cx, cy - dh / 2 - sep); ctx.rotate(-rip * 0.15);
      ctx.drawImage(img, 0, 0, img.width, tearY, -dw / 2 + jitter, -bob, dw, tearY * s);
      ctx.restore();
      // torn foil glint along the tear
      if (rip > 0 && rip < 1) {
        ctx.globalAlpha = 1 - rip; ctx.fillStyle = "#fff";
        for (var j = 0; j < dw; j += 6) px(ctx, cx - dw / 2 + j, cy - dh / 2 + tearY * s - 2 + (j % 12 ? 0 : 2), 4, 3, "#fff");
      }
      ctx.restore();
    }
    // sparkle burst
    if (rip > 0 && rip < 1) {
      var nsp = 10;
      for (var i = 0; i < nsp; i++) {
        var a = (i / nsp) * 6.28, rad = rip * targetH * 0.7;
        ctx.globalAlpha = 1 - rip;
        star(ctx, cx + Math.cos(a) * rad, cy - targetH * 0.1 + Math.sin(a) * rad * 0.7, 2 + (1 - rip) * 2, i % 2 ? "#ffd24d" : "#5df0ff");
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---- booster pack (image if available, else procedural) ----
  function packSprite(ctx, type, cx, cy, targetH, t) {
    var A = AS();
    var name = type === "graphics" ? "pack_graphics" : (type === "pets" ? "pack_pets" : "pack_gears");
    if (A && A.has(name)) {
      var cv = A.get(name);
      var s = targetH / cv.height;
      ctx.save(); ctx.translate(cx, cy);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cv, -cv.width * s / 2, -targetH / 2, cv.width * s, targetH);
      ctx.restore();
      return;
    }
    boosterPack(ctx, cx, cy, targetH, t);
  }

  // ============================================================
  //  FIRST-PERSON TYPING GAME rendering
  // ============================================================
  var L = global.JamData.LAYOUT;

  function screenRect() {
    var s = L.screen;
    return { x: s.x * W, y: s.y * H, w: s.w * W, h: s.h * H };
  }

  // ---- desk scene background ----
  function deskScene(ctx) {
    var A = AS();
    if (A && A.has("desk")) { drawCover(ctx, A.get("desk"), 0, 0, W, H); return; }
    // fallback: warm wall + desk + CRT
    clear(ctx);
    var wg = ctx.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, "#3a2a22"); wg.addColorStop(1, "#241812");
    ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
    px(ctx, 0, H * 0.62, W, H * 0.4, "#5a3d28");
    var sr = screenRect();
    fillRR(ctx, sr.x - 14, sr.y - 14, sr.w + 28, sr.h + 40, 10, "#cbcdbf");
    fillRR(ctx, sr.x, sr.y, sr.w, sr.h, 6, "#0b140f");
  }

  // ---- code on the monitor ----
  function monitorCode(ctx, target, typedLen, t, opts) {
    opts = opts || {};
    var r = screenRect();
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, 6); ctx.clip();
    // screen
    var sg = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 4, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.7);
    sg.addColorStop(0, "#0e2018"); sg.addColorStop(1, "#081410");
    ctx.fillStyle = sg; ctx.fillRect(r.x, r.y, r.w, r.h);
    // scanlines
    ctx.globalAlpha = 0.07; for (var sy = r.y; sy < r.y + r.h; sy += 3) px(ctx, r.x, sy, r.w, 1, "#8effc0"); ctx.globalAlpha = 1;

    // header line (title bar)
    ctx.font = "7px 'Courier New',monospace"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#4a7a5c"; ctx.fillText("~/mygame/main.js", r.x + 8, r.y + 14);

    // the code line, centred
    var fs = Math.max(9, Math.min(15, r.w / (target.length * 0.62)));
    ctx.font = fs + "px 'Courier New',monospace";
    var totalW = ctx.measureText(target).width;
    var startX = r.x + (r.w - totalW) / 2, baseY = r.y + r.h * 0.5;
    var cx = startX;
    for (var i = 0; i < target.length; i++) {
      var ch = target[i], cw = ctx.measureText(ch).width;
      if (i < typedLen) { ctx.fillStyle = "#9ff0b6"; ctx.fillText(ch, cx, baseY); }
      else if (i === typedLen) {
        // caret block
        var blink = (Math.floor(t * 2) % 2) === 0;
        if (blink) { ctx.fillStyle = "#ffd24d"; px(ctx, cx - 1, baseY - fs + 2, cw + 2, fs + 2, "#ffd24d"); }
        ctx.fillStyle = blink ? "#241812" : "#ffd24d"; ctx.fillText(ch === " " ? "" : ch, cx, baseY);
      } else { ctx.fillStyle = "#4f7a60"; ctx.fillText(ch, cx, baseY); }
      cx += cw;
    }
    // progress ticks
    ctx.fillStyle = "#2a4a38"; px(ctx, r.x + 8, r.y + r.h - 12, r.w - 16, 4, "#12281c");
    var pf = target.length ? typedLen / target.length : 0;
    px(ctx, r.x + 8, r.y + r.h - 12, (r.w - 16) * pf, 4, "#5fe0a0");

    // mistake flash
    if (opts.mistake > 0) { ctx.globalAlpha = Math.min(0.5, opts.mistake); ctx.fillStyle = "#ff4d4d"; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
    ctx.restore();
    // green screen glow spill
    ctx.save(); ctx.globalAlpha = 0.10 + 0.03 * Math.sin(t * 3); ctx.fillStyle = "#6effb0";
    ctx.fillRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12); ctx.restore();
  }

  // ---- interactive pixel keyboard ----
  var _kb = null;
  function keyboardLayout() {
    if (_kb) return _kb;
    var reg = { x: L.keyboard.x * W, y: L.keyboard.y * H, w: L.keyboard.w * W, h: L.keyboard.h * H };
    var rows = global.JamData.KEYROWS, keys = [];
    var gap = 3, kh = reg.h / rows.length - gap;
    for (var r = 0; r < rows.length; r++) {
      var y = reg.y + r * (kh + gap);
      if (rows[r] === "_SPACE_") { var sw = reg.w * 0.52; keys.push({ label: "SPACE", char: " ", x: reg.x + (reg.w - sw) / 2, y: y, w: sw, h: kh }); continue; }
      var chars = rows[r], n = chars.length, kw = reg.w / 10.4 - gap, rowW = n * (kw + gap) - gap, sx = reg.x + (reg.w - rowW) / 2;
      for (var k = 0; k < n; k++) keys.push({ label: chars[k], char: chars[k], x: sx + k * (kw + gap), y: y, w: kw, h: kh });
    }
    _kb = { region: reg, keys: keys };
    return _kb;
  }
  function keyForChar(ch) {
    if (ch == null) return null;
    var up = ch.length === 1 && ch >= "a" && ch <= "z" ? ch.toUpperCase() : ch;
    var keys = keyboardLayout().keys;
    for (var i = 0; i < keys.length; i++) if (keys[i].char === up || keys[i].char === ch) return keys[i];
    return null;
  }
  // Fat, cozy ivory keycaps with chunky 3D depth.
  function keyboard(ctx, opts) {
    opts = opts || {};
    var kb = keyboardLayout(), nextK = opts.next ? keyForChar(opts.next) : null, pressed = opts.pressed || {}, t = opts.t || 0;
    var reg = kb.region;
    // wooden/cream deck tray
    fillRR(ctx, reg.x - 10, reg.y - 9, reg.w + 20, reg.h + 20, 8, "#2a1d13");
    fillRR(ctx, reg.x - 7, reg.y - 7, reg.w + 14, reg.h + 15, 7, "#6a5136");
    fillRR(ctx, reg.x - 7, reg.y - 7, reg.w + 14, 5, 7, "#8a6f4a");
    var depth = 8;
    kb.keys.forEach(function (key) {
      var down = pressed[key.char] > 0 ? depth - 1 : 0;
      var isNext = nextK && nextK === key;
      var kx = key.x, ky = key.y, kw = key.w, kh = key.h - depth;
      // base / side (the chunky depth block)
      fillRR(ctx, kx, ky + kh - 2, kw, depth + 4, 4, "#5a4026");
      fillRR(ctx, kx, ky + kh + depth - 2 - down, kw, 3, 3, "#3a2818");
      // keycap top (ivory), depresses when down
      var topY = ky + down;
      var capTop = isNext ? "#ffe6a0" : "#f0e6cf";
      var capBot = isNext ? "#e0b24d" : "#c9b78e";
      var g = ctx.createLinearGradient(0, topY, 0, topY + kh);
      g.addColorStop(0, capTop); g.addColorStop(1, capBot);
      ctx.fillStyle = g; rr(ctx, kx, topY, kw, kh, 4); ctx.fill();
      // dish highlight + inner shade
      ctx.globalAlpha = 0.55; fillRR(ctx, kx + 2, topY + 2, kw - 4, kh * 0.34, 3, "#fffaf0"); ctx.globalAlpha = 1;
      ctx.strokeStyle = shade(capBot, -0.25); ctx.lineWidth = 1; rr(ctx, kx + 0.5, topY + 0.5, kw - 1, kh - 1, 4); ctx.stroke();
      if (isNext) {
        ctx.strokeStyle = "#ff9a3d"; ctx.lineWidth = 2; rr(ctx, kx - 0.5, topY - 0.5, kw + 1, kh + 1, 4); ctx.stroke();
        ctx.save(); ctx.globalAlpha = 0.25 + 0.18 * Math.sin(t * 8); circle(ctx, kx + kw / 2, topY + kh / 2, kw * 0.6, "#ffca55"); ctx.restore();
      }
      // label (dark, engraved look)
      ctx.fillStyle = isNext ? "#7a4a12" : "#7c6a4a"; ctx.font = "bold 7px 'Courier New',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(key.label === "SPACE" ? "___" : key.label, kx + kw / 2, topY + kh / 2 + 1);
    });
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  // ---- first-person hands ----
  function handsSprite(ctx, frameIndex, cx, t, opts) {
    opts = opts || {};
    var A = AS(), bob = Math.sin(t * (opts.fast ? 9 : 2.4)) * (opts.bobAmt || 3);
    var tap = opts.tap || 0;
    var yBottom = H + H * 0.06 - tap;         // wrists just off the bottom
    if (A && A.has("hands")) {
      var cv = A.frame("hands", frameIndex);
      if (cv) { var targetH = H * (opts.scale || 0.62); drawSpriteBottom(ctx, cv, cx, yBottom + bob, targetH); return; }
    }
    // fallback: two rounded blobs
    circle(ctx, cx - 30, H - 20 + bob, 22, "#f0c896"); circle(ctx, cx + 30, H - 20 + bob, 22, "#f0c896");
  }
  function drawSpriteBottom(ctx, cv, cx, bottomY, targetH) {
    var s = targetH / cv.height, dw = cv.width * s;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, cx - dw / 2, bottomY - targetH, dw, targetH);
  }

  // ---- red RUN button ----
  function runButton(ctx, cx, cy, targetH, pressed, t) {
    var A = AS();
    if (A && A.has("runbtn")) {
      var cv = A.frame("runbtn", pressed ? 1 : 0);
      if (cv) { var s = targetH / cv.height; ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, cx - cv.width * s / 2, cy - targetH / 2 + (pressed ? targetH * 0.05 : 0), cv.width * s, targetH); return; }
    }
    // fallback
    circle(ctx, cx, cy + 6, targetH * 0.4, "#5a3a24");
    circle(ctx, cx, cy - (pressed ? 0 : 4), targetH * 0.34, pressed ? "#c8324a" : "#ff5d5d");
  }

  // ---- upgrade icons (pixel) ----
  function upgradeIcon(ctx, key, cx, cy, s) {
    ctx.save();
    switch (key) {
      case "kb":
        fillRR(ctx, cx - s * 0.5, cy - s * 0.3, s, s * 0.6, 2, "#3a3020");
        for (var i = 0; i < 4; i++) for (var j = 0; j < 2; j++) px(ctx, cx - s * 0.4 + i * s * 0.24, cy - s * 0.2 + j * s * 0.22, s * 0.16, s * 0.14, "#c9b98f");
        break;
      case "mega":
        ctx.fillStyle = "#ffca55"; ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.22); ctx.lineTo(cx + s * 0.1, cy - s * 0.42); ctx.lineTo(cx + s * 0.1, cy + s * 0.42); ctx.lineTo(cx - s * 0.5, cy + s * 0.22); ctx.closePath(); ctx.fill();
        px(ctx, cx - s * 0.6, cy - s * 0.16, s * 0.12, s * 0.32, "#3a2a1a");
        star(ctx, cx + s * 0.4, cy - s * 0.3, s * 0.14, "#fff"); break;
      case "rocket":
        ctx.fillStyle = "#e8e6f0"; fillRR(ctx, cx - s * 0.16, cy - s * 0.5, s * 0.32, s * 0.8, s * 0.16, "#e8e6f0");
        circle(ctx, cx, cy - s * 0.2, s * 0.1, "#5df0ff");
        ctx.fillStyle = "#ff7a4d"; ctx.beginPath(); ctx.moveTo(cx - s * 0.16, cy + s * 0.3); ctx.lineTo(cx, cy + s * 0.55); ctx.lineTo(cx + s * 0.16, cy + s * 0.3); ctx.fill(); break;
      case "coffee":
        fillRR(ctx, cx - s * 0.34, cy - s * 0.24, s * 0.6, s * 0.5, 3, "#e8e2d4");
        px(ctx, cx - s * 0.28, cy - s * 0.18, s * 0.48, s * 0.14, "#6a3a1a");
        px(ctx, cx + s * 0.26, cy - s * 0.14, s * 0.12, s * 0.24, "#e8e2d4"); break;
      default: circle(ctx, cx, cy, s * 0.3, "#ffca55");
    }
    ctx.restore();
  }

  // floating "type this next" indicator, drawn over the hands
  function keyGlow(ctx, char, t) {
    var k = keyForChar(char); if (!k) return;
    var cx = k.x + k.w / 2;
    var ay = k.y - 11 - Math.abs(Math.sin(t * 7)) * 5;
    ctx.save();
    // ring on the key
    ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 8); ctx.strokeStyle = "#ffca55"; ctx.lineWidth = 2.5;
    rr(ctx, k.x - 1, k.y - 1, k.w + 2, k.h + 2, 5); ctx.stroke();
    ctx.globalAlpha = 1;
    // bouncing arrow above
    ctx.fillStyle = "#ffd24d"; ctx.beginPath(); ctx.moveTo(cx - 6, ay); ctx.lineTo(cx + 6, ay); ctx.lineTo(cx, ay + 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#7a4a12"; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  // little pixel "players" icon (two folks)
  function peopleIcon(ctx, cx, cy, s) {
    var folks = [[-s * 0.26, "#6ee0ff"], [s * 0.26, "#ffca55"]];
    folks.forEach(function (f) {
      var x = cx + f[0];
      fillRR(ctx, x - s * 0.22, cy - s * 0.02, s * 0.44, s * 0.36, s * 0.12, f[1]);
      circle(ctx, x, cy - s * 0.22, s * 0.18, f[1]);
      circle(ctx, x, cy - s * 0.22, s * 0.18, f[1]);
      ctx.globalAlpha = 0.35; fillRR(ctx, x - s * 0.14, cy, s * 0.1, s * 0.3, s * 0.05, "#000"); ctx.globalAlpha = 1;
    });
  }

  function vignette(ctx) {
    var g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.35, W / 2, H * 0.5, H * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  global.JamRender = {
    W: W, H: H, HOTSPOTS: HOTSPOTS,
    clear: clear, px: px, circle: circle, rr: rr, fillRR: fillRR, shade: shade, glyph: glyph, star: star,
    gear: gear, gearThumb: gearThumb, graphicThumb: graphicThumb,
    drinkCan: drinkCan, boosterPack: boosterPack, character: character,
    room: room, panel: panel,
    roomScene: roomScene, playerSprite: playerSprite, drinkSprite: drinkSprite, packSprite: packSprite, packRip: packRip,
    screenRect: screenRect, deskScene: deskScene, monitorCode: monitorCode,
    keyboardLayout: keyboardLayout, keyForChar: keyForChar, keyboard: keyboard,
    handsSprite: handsSprite, runButton: runButton, upgradeIcon: upgradeIcon, peopleIcon: peopleIcon, keyGlow: keyGlow, vignette: vignette
  };
})(window);
