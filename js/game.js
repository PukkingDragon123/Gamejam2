/* =========================================================
   GAME JAM SIMULATOR — game.js  (first-person typing edition)
   Loop:  type the code  →  mash the red RUN button  →  ship  →
   your itch page gains players over time  →  spend on upgrades.
   ========================================================= */
(function (global) {
  "use strict";

  var D = global.JamData, R = global.JamRender, A = global.JamAudio, AS = global.JamAssets;
  var UPG = D.UPGRADES, SNIPPETS = D.SNIPPETS, GAME = D.GAME;
  var W = R.W, H = R.H;

  var canvas, ctx, els = {};

  var G = {
    state: "boot",
    players: 0, perSec: GAME.basePlayersPerSec, shipped: 0,
    upg: { autocomplete: 0, marketing: 0, viral: 0, coffee: 0 },
    // typing
    target: "", typedLen: 0, mistakes: 0, mistakeFlash: 0, typeTime: 0, typing: false,
    pressed: {}, tick: 0,
    // ship mash
    build: 0, btn: 0,
    // fx
    pops: [], shake: 0, handTap: 0, t: 0, lastGain: 0
  };

  // ---------------------------------------------------------
  function init() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
    els.overlay = document.getElementById("overlay");
    els.stage = document.getElementById("stage");
    els.roombg = document.getElementById("roombg");
    els.hud = document.getElementById("hud");
    els.tray = document.getElementById("tray");
    els.tut = document.getElementById("tutorial");
    els.status = document.getElementById("statusbar");
    els.loading = document.getElementById("loading");
    els.loadBar = document.getElementById("load-bar");
    els.loadMsg = document.getElementById("load-msg");
    els.muteBtn = document.getElementById("btn-mute");

    // hide legacy chrome — this edition is visual-first
    if (els.hud) els.hud.classList.add("hidden");
    if (els.tray) els.tray.classList.add("hidden");
    if (els.roombg) els.roombg.classList.add("hidden");

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", function () { A.unlock(); }, { once: true });
    if (els.muteBtn) els.muteBtn.addEventListener("click", function () { els.muteBtn.textContent = A.toggleMute() ? "🔇" : "🔊"; });

    AS.load(function () {
      if (els.loadBar) els.loadBar.style.width = "100%";
      setTimeout(function () { if (els.loading) els.loading.classList.remove("show"); showTitle(); }, 350);
    });
    if (els.loadBar) els.loadBar.style.width = "70%";
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------
  function toXY(e) {
    var r = canvas.getBoundingClientRect();
    var sc = Math.min(r.width / W, r.height / H);
    return { x: (e.clientX - r.left - (r.width - W * sc) / 2) / sc, y: (e.clientY - r.top - (r.height - H * sc) / 2) / sc };
  }

  function onDown(e) {
    if (e.cancelable) e.preventDefault();
    var p = toXY(e);
    if (G.state === "code") {
      // tapping an on-screen key types it (this is the mobile/touch input path)
      var keys = R.keyboardLayout().keys;
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        // generous hit box for fingers
        if (p.x >= k.x - 2 && p.x <= k.x + k.w + 2 && p.y >= k.y - 2 && p.y <= k.y + k.h + 4) { typeChar(k.char); return; }
      }
    } else if (G.state === "ship") {
      mash();
    }
  }

  function onKey(e) {
    if (G.state === "code") {
      if (e.key === "Backspace") { e.preventDefault(); return; }
      if (e.key.length === 1) { typeChar(e.key); e.preventDefault(); }
    } else if (G.state === "ship") {
      if (e.key === " " || e.key === "Enter") { mash(); e.preventDefault(); }
    }
  }

  // =========================================================
  //  TYPING
  // =========================================================
  function startCode() {
    var idx = G.shipped % SNIPPETS.length;
    // pick a snippet scaling roughly with progress
    G.target = SNIPPETS[(idx + Math.floor(G.shipped / SNIPPETS.length) * 3) % SNIPPETS.length];
    var pre = Math.min(G.upg.autocomplete * 2, G.target.length - 1);
    G.typedLen = pre; G.mistakes = 0; G.mistakeFlash = 0; G.typeTime = 0; G.typing = false;
    G.pressed = {}; G.state = "code";
    hideOverlay();
  }

  function typeChar(ch) {
    if (G.state !== "code") return;
    animKey(ch);
    var exp = G.target[G.typedLen];
    var ok = (ch === exp) || (exp && exp.length === 1 && ch.toLowerCase() === exp.toLowerCase() && exp.toLowerCase() !== exp.toUpperCase());
    if (ok) {
      G.typedLen++; G.typing = true; G.handTap = 0.12; A.sfx.tick();
      if (G.typedLen >= G.target.length) startShip();
    } else {
      G.mistakes++; G.mistakeFlash = 0.5; G.shake = Math.max(G.shake, 4); A.sfx.error();
    }
  }
  function animKey(ch) { var up = (ch.length === 1 && ch >= "a" && ch <= "z") ? ch.toUpperCase() : ch; G.pressed[up] = 0.12; G.pressed[ch] = 0.12; }

  // =========================================================
  //  SHIP (mash the red button)
  // =========================================================
  function startShip() {
    G.state = "ship"; G.build = 0; A.sfx.submit();
  }
  function mash() {
    if (G.state !== "ship") return;
    G.build = Math.min(GAME.shipTarget + 1, G.build + GAME.mashPerHit);
    G.btn = 0.1; G.handTap = 0.14; A.sfx.place(); G.shake = Math.max(G.shake, 3);
    pop(W / 2, H * 0.42, "+", "#ff8a5a", 16);
    if (G.build >= GAME.shipTarget) shipGame();
  }

  function shipGame() {
    // reward
    var par = G.target.length * 0.35 * (1 + G.upg.coffee * 0.15);
    var speed = Math.max(0.5, Math.min(2.5, par / Math.max(0.5, G.typeTime)));
    var base = 10 + G.shipped * 4 + G.target.length * 0.5;
    var mult = 1 + G.upg.viral * 0.5;
    var gain = Math.max(1, Math.round(base * speed * mult));
    G.lastGain = gain; G.players += gain; G.shipped++;
    A.sfx.win(); G.shake = 8;
    showItch(gain, speed);
  }

  // =========================================================
  //  ITCH PAGE + UPGRADES
  // =========================================================
  function perSecNow() { return GAME.basePlayersPerSec + G.upg.marketing * 0.6; }
  function upgCost(u) { return Math.round(u.base * Math.pow(1.6, G.upg[u.id])); }

  function showItch(gain, speed) {
    G.state = "itch";
    var html = '<div class="itch">' +
      '<div class="itch-top"><span class="itch-logo">itch<span>.io</span></span>' +
      '<span class="itch-players"><canvas id="pplic" width="22" height="22"></canvas> <b id="itch-count">' + fmt(G.players) + '</b> players</span></div>' +
      '<div class="itch-card">' +
      '<div class="itch-thumb" id="itch-thumb"></div>' +
      '<div class="itch-meta"><div class="itch-title">My Game #' + G.shipped + '</div>' +
      '<div class="itch-sub">just shipped! +' + gain + ' players ' + (speed >= 1.6 ? "⚡ SPEED BONUS!" : "") + '</div>' +
      '<div class="itch-rate">📈 +' + perSecNow().toFixed(1) + ' players/sec</div></div></div>' +
      '<div class="up-title">UPGRADES</div><div class="up-grid" id="up-grid"></div>' +
      '<button class="big-btn" id="ov-btn">⌨ Make next game →</button></div>';
    overlay(html);
    // thumb
    var thumb = document.getElementById("itch-thumb");
    var tc = document.createElement("canvas"); tc.width = 96; tc.height = 72; var tx = tc.getContext("2d");
    R.deskScene(tx); thumb.appendChild(tc);
    // pixel players icon in header
    var pplic = document.getElementById("pplic"); if (pplic) R.peopleIcon(pplic.getContext("2d"), 11, 12, 16);
    renderUpgrades();
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); startCode(); };
  }

  function renderUpgrades() {
    var grid = document.getElementById("up-grid"); if (!grid) return;
    grid.innerHTML = "";
    UPG.forEach(function (u) {
      var cost = upgCost(u), owned = G.upg[u.id], afford = G.players >= cost;
      var div = document.createElement("div"); div.className = "up-card" + (afford ? "" : " broke");
      var cv = document.createElement("canvas"); cv.width = 40; cv.height = 40; var ux = cv.getContext("2d"); ux.imageSmoothingEnabled = false;
      R.upgradeIcon(ux, u.icon, 20, 20, 26); div.appendChild(cv);
      var nm = document.createElement("div"); nm.className = "up-name"; nm.textContent = u.name + (owned ? "  Lv" + owned : ""); div.appendChild(nm);
      var ds = document.createElement("div"); ds.className = "up-desc"; ds.textContent = u.desc; div.appendChild(ds);
      var co = document.createElement("div"); co.className = "up-cost"; co.textContent = "👥 " + fmt(cost); div.appendChild(co);
      div.onclick = function () { buyUpgrade(u); };
      grid.appendChild(div);
    });
  }
  function buyUpgrade(u) {
    var cost = upgCost(u);
    if (G.players < cost) { A.sfx.error(); return; }
    G.players -= cost; G.upg[u.id]++; G.perSec = perSecNow(); A.sfx.cash();
    var el = document.getElementById("itch-count"); if (el) el.textContent = fmt(G.players);
    renderUpgrades();
  }

  // =========================================================
  //  TITLE
  // =========================================================
  function showTitle() {
    G.state = "title";
    overlay('<div class="modal cozy"><h1>⌨ GAME JAM<br>SIMULATOR</h1>' +
      '<p class="lead">Type the code. Ship the game. Watch the players roll in.</p>' +
      '<p>Follow the glowing keys and <b>type fast</b> — the clock is ticking. Then <b>mash the red button</b> to ship it, and spend your players on <b>upgrades</b>.</p>' +
      '<button class="big-btn" id="ov-btn">▶ START CODING</button></div>');
    els.overlay.classList.add("title-mode");
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); G.players = 0; G.shipped = 0; G.upg = { autocomplete: 0, marketing: 0, viral: 0, coffee: 0 }; startCode(); };
  }

  // =========================================================
  //  LOOP
  // =========================================================
  var last = 0;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    update(dt, now / 1000); render(now / 1000);
    requestAnimationFrame(loop);
  }

  function update(dt, t) {
    G.t = t;
    // idle players income (always ticking once playing)
    if (G.state === "code" || G.state === "ship" || G.state === "itch") {
      G.players += perSecNow() * dt;
      if (G.state === "itch") { var el = document.getElementById("itch-count"); if (el) el.textContent = fmt(G.players); renderAfford(); }
    }
    // typing clock
    if (G.state === "code" && G.typing) {
      var before = Math.floor(G.typeTime); G.typeTime += dt;
      if (Math.floor(G.typeTime) !== before) A.sfx.timerLow();
    }
    // decays
    if (G.mistakeFlash > 0) G.mistakeFlash -= dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
    if (G.handTap > 0) G.handTap = Math.max(0, G.handTap - dt);
    if (G.btn > 0) G.btn = Math.max(0, G.btn - dt);
    for (var k in G.pressed) { G.pressed[k] -= dt; if (G.pressed[k] <= 0) delete G.pressed[k]; }
    if (G.state === "ship") G.build = Math.max(0, G.build - GAME.mashDecay * dt);
    for (var i = G.pops.length - 1; i >= 0; i--) { var p = G.pops[i]; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) G.pops.splice(i, 1); }
  }
  var affordTimer = 0;
  function renderAfford() { affordTimer++; if (affordTimer % 20 === 0) renderUpgrades(); } // refresh affordability periodically

  // =========================================================
  //  RENDER
  // =========================================================
  function render(t) {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (G.shake) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);

    R.deskScene(ctx);

    if (G.state === "code") {
      R.monitorCode(ctx, G.target, G.typedLen, t, { mistake: Math.max(0, G.mistakeFlash) });
      R.keyboard(ctx, { next: G.target[G.typedLen], pressed: G.pressed, t: t });
      R.handsSprite(ctx, 2, W / 2, t, { scale: 0.55, tap: G.handTap * 90, bobAmt: 2.5 });
      R.keyGlow(ctx, G.target[G.typedLen], t);   // shown over the hands so you always see the next key
      bigClock(t);
      hud();
    } else if (G.state === "ship") {
      // monitor keeps showing the finished code (aligned to the CRT)
      R.monitorCode(ctx, G.target, G.target.length, t, {});
      // red button sits on the desk to the RIGHT of the monitor
      var bx = W * 0.80, by = H * 0.60, squash = G.btn > 0 ? 1 : 0;
      // build bar above the button
      var barW = 120, barX = bx - barW / 2, barY = by - H * 0.30;
      ctx.fillStyle = "#ffca55"; ctx.font = "bold 11px 'Courier New',monospace"; ctx.textAlign = "center";
      var pulse = 1 + 0.06 * Math.sin(t * 14);
      ctx.save(); ctx.translate(bx, barY - 14); ctx.scale(pulse, pulse); ctx.fillText("MASH SPACE!", 0, 0); ctx.restore();
      R.fillRR(ctx, barX - 2, barY - 2, barW + 4, 12, 3, "#000");
      R.fillRR(ctx, barX, barY, barW, 8, 2, "#241812");
      R.fillRR(ctx, barX, barY, barW * (G.build / GAME.shipTarget), 8, 2, "#5fe0a0");
      // the button (squashes when pressed)
      R.runButton(ctx, bx, by, H * (0.30 - squash * 0.02), G.btn > 0, t);
      // press hand reaches in from the bottom-right toward the button
      R.handsSprite(ctx, 1, bx - 6, t, { scale: 0.6, tap: (G.btn > 0 ? 30 : 6), bobAmt: 2, fast: G.build > 0 });
      hud();
    } else {
      // title: a bouncy walking dev along the desk; itch: idle hands
      if (G.state === "title") walker(t);
      else R.handsSprite(ctx, 0, W / 2, t, { scale: 0.5, bobAmt: 3 });
    }

    // pops
    ctx.textAlign = "center";
    G.pops.forEach(function (p) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life)); ctx.font = "bold " + p.size + "px 'Courier New',monospace"; ctx.fillStyle = "#000"; ctx.fillText(p.txt, p.x + 1, p.y + 1); ctx.fillStyle = p.color; ctx.fillText(p.txt, p.x, p.y); ctx.globalAlpha = 1; });
    ctx.textAlign = "left";

    R.vignette(ctx);
    ctx.restore();
  }

  // minimal HUD: players (top-left)
  function hud() {
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    R.fillRR(ctx, 6, 6, 96, 16, 3, "rgba(20,12,8,.7)");
    ctx.font = "9px 'Courier New',monospace"; ctx.fillStyle = "#ffca55";
    ctx.fillText("👥 " + fmt(G.players), 12, 15);
    ctx.textBaseline = "alphabetic";
  }

  // big ticking clock (top-center)
  function bigClock(t) {
    var cx = W / 2, cy = 16;
    R.fillRR(ctx, cx - 44, cy - 10, 88, 22, 4, "rgba(20,12,8,.8)");
    ctx.strokeStyle = "#5c4636"; ctx.lineWidth = 1; R.rr(ctx, cx - 44, cy - 10, 88, 22, 4); ctx.stroke();
    // ticking colon
    var secs = G.typeTime, mm = Math.floor(secs / 60), ss = Math.floor(secs % 60);
    var colon = (Math.floor(t * 2) % 2) ? ":" : " ";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 15px 'Courier New',monospace";
    ctx.fillStyle = secs > 12 ? "#ff6a5a" : "#ffd24d";
    ctx.fillText(mm + colon + ("0" + ss).slice(-2), cx, cy + 1);
    // little clock face
    R.circle(ctx, cx - 34, cy + 1, 6, "#e8e2d4"); ctx.strokeStyle = "#3a2c1e"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx - 34, cy + 1, 6, 0, 6.28); ctx.stroke();
    var ha = t * 3; ctx.strokeStyle = "#c8324a"; ctx.beginPath(); ctx.moveTo(cx - 34, cy + 1); ctx.lineTo(cx - 34 + Math.cos(ha) * 4, cy + 1 + Math.sin(ha) * 4); ctx.stroke();
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  function pop(x, y, txt, color, size) { G.pops.push({ x: x, y: y, txt: txt, color: color, size: size || 14, life: 0.9, vy: -30 }); }

  // bouncy little dev walking across the desk edge (title screen)
  function walker(t) {
    var speed = 52, period = W + 140, x = ((t * speed) % period) - 70, feetY = H * 0.955;
    var hop = Math.abs(Math.sin(t * 6)), bob = -hop * 8;
    // shadow (shrinks on the up-beat)
    ctx.save(); ctx.globalAlpha = 0.28 - hop * 0.14; ctx.beginPath(); ctx.ellipse(x, feetY, 16 - hop * 4, 4.5, 0, 0, 6.28); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();
    var frame = (Math.floor(t * 6) % 2) ? "walkB" : "walkA";
    R.playerSprite(ctx, frame, x, feetY + bob, H * 0.34, true, t, "");
  }

  // =========================================================
  //  helpers
  // =========================================================
  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(n);
  }
  function overlay(html) { els.overlay.innerHTML = html; els.overlay.classList.add("show"); }
  function hideOverlay() { els.overlay.classList.remove("show", "title-mode"); els.overlay.innerHTML = ""; }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  global.Game = G;
})(window);
