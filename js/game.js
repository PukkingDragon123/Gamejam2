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
    // room hub
    player: { x: 0, feetY: 0, target: null, facing: 1, moving: false, animT: 0, intend: false },
    // drink buffs (consumed at the next coding session)
    buff: { shipMult: 1, clockSlow: 1, preType: 0 }, buffName: "",
    // fx
    pops: [], shake: 0, handTap: 0, t: 0, lastGain: 0
  };

  // room hotspots, normalized to the room image (drawn "contain" on canvas)
  var ROOM = {
    computer: { x: 0.0, y: 0.40, w: 0.21, h: 0.32 },
    standX: 0.16, floorY: 0.90, spawnX: 0.58, scale: 0.42, walk: 0.28
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
    canvas.addEventListener("pointermove", onMove);
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

  function onMove(e) {
    if (G.state !== "room") return;
    var p = toXY(e), cz = computerRectC();
    G.hoverComputer = (p.x >= cz.x && p.x <= cz.x + cz.w && p.y >= cz.y && p.y <= cz.y + cz.h);
  }

  function onDown(e) {
    if (e.cancelable) e.preventDefault();
    var p = toXY(e);
    if (G.state === "room") {
      var cz = computerRectC();
      if (p.x >= cz.x && p.x <= cz.x + cz.w && p.y >= cz.y && p.y <= cz.y + cz.h) { G.player.target = R.roomMap(ROOM.standX, 0).x; G.player.intend = true; }
      else { G.player.target = Math.max(20, Math.min(W - 20, p.x)); G.player.intend = false; }
      return;
    }
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
    } else if (G.state === "chug") {
      chugClick();
    }
  }

  function onKey(e) {
    if (G.state === "code") {
      if (e.key === "Backspace") { e.preventDefault(); return; }
      if (e.key.length === 1) { typeChar(e.key); e.preventDefault(); }
    } else if (G.state === "ship") {
      if (e.key === " " || e.key === "Enter") { mash(); e.preventDefault(); }
    } else if (G.state === "chug") {
      if (e.key === " " || e.key === "Enter") { chugClick(); e.preventDefault(); }
    }
  }

  // =========================================================
  //  TYPING
  // =========================================================
  function startCode() {
    var idx = G.shipped % SNIPPETS.length;
    // pick a snippet scaling roughly with progress
    G.target = SNIPPETS[(idx + Math.floor(G.shipped / SNIPPETS.length) * 3) % SNIPPETS.length];
    var pre = Math.min(G.upg.autocomplete * 2 + (G.buff.preType || 0), G.target.length - 1);
    G.buff.preType = 0;                                  // brew buff is one-shot
    G.typedLen = pre; G.mistakes = 0; G.mistakeFlash = 0; G.typeTime = 0; G.typing = false;
    G.pressed = {}; G.state = "code";
    hideOverlay();
  }

  // =========================================================
  //  ROOM HUB (walk to the computer)
  // =========================================================
  function enterRoom() {
    G.state = "room"; hideOverlay();
    R.roomCanvas(ctx);                                  // establish the room rect
    var rr = R.roomRect();
    G.player.feetY = R.roomMap(0, ROOM.floorY).y;
    G.player.x = R.roomMap(ROOM.spawnX, 0).x;
    G.player.target = null; G.player.intend = false; G.player.moving = false;
  }
  function updateRoom(dt) {
    var pl = G.player, rr = R.roomRect();
    pl.idleT = (pl.idleT || 0) + dt;
    if (pl.target != null) {
      var dx = pl.target - pl.x, dist = Math.abs(dx);
      // ease-out as we arrive so stops feel soft, not robotic
      var maxSpd = ROOM.walk * rr.w, spd = maxSpd * Math.min(1, 0.25 + dist / 60) * dt;
      if (dist <= spd) { pl.x = pl.target; pl.target = null; pl.moving = false; pl.animT = 0; if (pl.intend) { pl.intend = false; openDesktop(); } }
      else { pl.x += Math.sign(dx) * spd; pl.facing = dx < 0 ? -1 : 1; pl.moving = true; pl.animT += dt * Math.min(1.6, 0.6 + dist / 90); }
    } else pl.moving = false;
  }
  function computerRectC() {
    var a = R.roomMap(ROOM.computer.x, ROOM.computer.y), rr = R.roomRect();
    return { x: a.x, y: a.y, w: ROOM.computer.w * rr.w, h: ROOM.computer.h * rr.h };
  }
  function renderRoom(t) {
    R.roomCanvas(ctx);
    var cz = computerRectC(), pl = G.player, hgt = ROOM.scale * R.roomRect().h;
    var hover = G.hoverComputer;
    if (hover) { ctx.save(); ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.35 * Math.sin(t * 6); R.rr(ctx, cz.x + 2, cz.y, cz.w - 4, cz.h, 6); ctx.stroke(); ctx.restore(); }
    // warm light spilling from the window + the CRT glow (lighting pass)
    var win = R.roomMap(0.42, 0.35), mon = R.roomMap(0.09, 0.55);
    R.lightPool(ctx, win.x, win.y, R.roomRect().w * 0.30, "#ffcf8a", 0.20 + 0.02 * Math.sin(t * 1.5));
    R.lightPool(ctx, mon.x, mon.y, R.roomRect().w * 0.16, "#9fe0ff", 0.13 + 0.03 * Math.sin(t * 3.1));

    // walk cycle + breathing idle
    var hop = pl.moving ? Math.abs(Math.sin(pl.animT * 9)) : 0;
    var breathe = pl.moving ? 0 : Math.sin((pl.idleT || 0) * 2.2) * 1.4;
    var frame = pl.moving ? (Math.floor(pl.animT / 0.16) % 2 ? "walkB" : "walkA") : "back";
    R.contactShadow(ctx, pl.x, pl.feetY, 18, hop * 5);
    // rim light so the character reads clearly against the dark room
    ctx.save(); ctx.globalAlpha = 0.30; R.lightPool(ctx, pl.x, pl.feetY - hgt * 0.45, hgt * 0.75, "#ffd9a0", 0.30); ctx.restore();
    // feet nudged down onto the shadow; never mirrored (the flip looked bad)
    R.playerSprite(ctx, frame, pl.x, pl.feetY + hgt * 0.06 - hop * 4 + breathe, hgt * (1 + hop * 0.02), false, t, "");
    // prompt
    if (hover || Math.abs(pl.x - R.roomMap(ROOM.standX, 0).x) < 40) {
      ctx.save(); ctx.textAlign = "center";
      R.fillRR(ctx, cz.x + cz.w / 2 - 48, cz.y - 18, 96, 15, 4, "rgba(24,16,10,.9)");
      ctx.font = "bold 9px 'Courier New',monospace"; ctx.fillStyle = "#ffca55";
      ctx.fillText("▸ CLICK TO WORK", cz.x + cz.w / 2, cz.y - 7); ctx.restore();
    }
    // hint bar
    ctx.textAlign = "center"; ctx.font = "8px 'Courier New',monospace"; ctx.fillStyle = "#b8a48e";
    ctx.fillText("click to walk · click the computer to start working", W / 2, H - 8);
    ctx.textAlign = "left";
    hud();
  }

  // =========================================================
  //  DESKTOP (GearOS apps)
  // =========================================================
  function openDesktop() {
    G.state = "desktop";
    var apps = [
      { id: "engine", name: "GearEngine" },
      { id: "shop", name: "DrinkMart" },
      { id: "net", name: "GameJamNet" },
      { id: "trash", name: "Recycle" }
    ];
    var icons = apps.map(function (a) {
      return '<button class="dk-icon" data-app="' + a.id + '"><canvas class="dk-ico" width="48" height="48" data-icon="' + a.id + '"></canvas><span class="dk-label">' + a.name + '</span></button>';
    }).join("");
    overlay('<div class="desktop"><div class="dk-wall"><div class="dk-logo">GearOS<span>95</span></div><div class="dk-icons">' + icons + '</div></div>' +
      '<div class="dk-taskbar"><button class="dk-start">Start</button><span class="dk-hint">Open <b>GearEngine</b> to make a game · <b>DrinkMart</b> to order a drink</span><span class="dk-clock" id="dk-players"></span></div></div>');
    var wrap = els.overlay.querySelector(".desktop");
    // draw the hand-made pixel icons
    wrap.querySelectorAll(".dk-ico").forEach(function (cv) {
      var c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
      R.desktopIcon(c, cv.getAttribute("data-icon"), 24, 24, 40);
    });
    playersChip(document.getElementById("dk-players"));
    wrap.querySelectorAll(".dk-icon").forEach(function (btn) { btn.onclick = function () { A.sfx.ui(); onDesktopApp(btn.getAttribute("data-app")); }; });
    wrap.querySelector(".dk-start").onclick = function () { A.sfx.ui(); onDesktopApp("engine"); };
  }

  // small "players" chip with the pixel icon (reused across screens)
  function playersChip(host) {
    if (!host) return;
    host.innerHTML = '<canvas width="20" height="20"></canvas><b>' + fmt(G.players) + '</b>';
    var cv = host.querySelector("canvas"); R.peopleIcon(cv.getContext("2d"), 10, 11, 15);
  }

  function onDesktopApp(id) {
    if (id === "engine") { A.sfx.select(); startCode(); return; }
    if (id === "shop") { A.sfx.ui(); openShop(); return; }
    var win = { net: "<b>GameJamNet</b><br><i>“day one and someone already has a vertical slice??”</i><br>(do NOT read the comments.)", trash: "<b>Recycle Bin</b><br>0 items. You never delete anything." }[id] || "…";
    var w = document.createElement("div"); w.className = "dk-window";
    w.innerHTML = '<div class="dk-titlebar"><span>' + id + '.exe</span><button class="dk-x">×</button></div><div class="dk-body">' + win + '</div>';
    els.overlay.querySelector(".desktop").appendChild(w);
    w.querySelector(".dk-x").onclick = function () { w.remove(); };
  }

  // =========================================================
  //  DRINKMART — order online, then chug it
  // =========================================================
  function drinkById(id) { var L2 = global.JamData.DRINKS; for (var i = 0; i < L2.length; i++) if (L2[i].id === id) return L2[i]; return L2[0]; }

  function openShop() {
    G.state = "shop";
    var rows = global.JamData.SHOP.map(function (it, i) {
      var d = drinkById(it.id), afford = G.players >= it.price;
      return '<div class="sh-row' + (afford ? "" : " broke") + '" data-i="' + i + '">' +
        '<canvas class="sh-img" width="44" height="60"></canvas>' +
        '<div class="sh-meta"><div class="sh-name">' + d.name + '</div><div class="sh-tag">' + it.tag + '</div></div>' +
        '<div class="sh-buy"><span class="sh-price">' + it.price + '</span><span class="sh-cta">BUY</span></div></div>';
    }).join("");
    overlay('<div class="shop">' +
      '<div class="sh-bar"><span class="sh-logo">DrinkMart</span><span class="sh-cart" id="sh-players"></span></div>' +
      '<div class="sh-list">' + rows + '</div>' +
      '<button class="big-btn alt" id="sh-back">Back to desktop</button></div>');
    playersChip(document.getElementById("sh-players"));
    var wrap = els.overlay.querySelector(".shop");
    wrap.querySelectorAll(".sh-row").forEach(function (row, i) {
      var it = global.JamData.SHOP[i], d = drinkById(it.id);
      var cv = row.querySelector(".sh-img"); var c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
      R.drinkSprite(c, d, 22, 30, 56);
      row.onclick = function () { buyDrink(it); };
    });
    document.getElementById("sh-back").onclick = function () { A.sfx.ui(); openDesktop(); };
  }

  function buyDrink(item) {
    if (G.players < item.price) { A.sfx.error(); return; }
    G.players -= item.price; A.sfx.cash();
    startChug(item);
  }

  // rapid-click chugging minigame
  function startChug(item) {
    G.state = "chug";
    G.chug = { item: item, drink: drinkById(item.id), amount: 0, tilt: 0, gulp: 0, done: false, t: 0 };
    hideOverlay();
  }
  function chugClick() {
    var c = G.chug; if (!c || c.done) return;
    c.amount = Math.min(1, c.amount + 0.075);
    c.gulp = 0.16; c.tilt = Math.min(0.9, c.tilt + 0.08);
    A.sfx.sip(); G.shake = Math.max(G.shake, 2);
    pop(W / 2 + (Math.random() - 0.5) * 40, H * 0.45, "gulp!", "#ffd24d", 12);
    if (c.amount >= 1) finishChug();
  }
  function finishChug() {
    var c = G.chug; if (!c || c.done) return; c.done = true;
    var fx = c.item.fx;
    if (fx === "shipMult") G.buff.shipMult = 1.3;
    else if (fx === "clockSlow") G.buff.clockSlow = 0.7;
    else if (fx === "preType") G.buff.preType = 4;
    else if (fx === "instant80") G.players += 80;
    else if (fx === "instant35") G.players += 35;
    G.buffName = c.drink.name + " — " + c.item.tag;
    A.sfx.win(); G.shake = 7;
    pop(W / 2, H * 0.35, "AHHH!", "#7bd88a", 22);
    setTimeout(function () { G.chug = null; openShop(); }, 900);
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
    var mult = (1 + G.upg.viral * 0.5) * (G.buff.shipMult || 1);
    G.buff.shipMult = 1;                                 // cola buff is one-shot
    G.buff.clockSlow = 1;                                // monster buff lasted this game
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
      (G.buffName ? '<p class="itch-rate" style="text-align:center">🥤 active: ' + G.buffName + '</p>' : '') +
      '<div class="itch-btns"><button class="big-btn alt" id="ov-break">🚪 Take a break</button><button class="big-btn" id="ov-btn">⌨ Make next game →</button></div></div>';
    overlay(html);
    var brk = document.getElementById("ov-break"); if (brk) brk.onclick = function () { A.sfx.ui(); enterRoom(); };
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
      '<p>Walk to your computer and open <b>GearEngine</b>. Follow the glowing keys and <b>type fast</b> — the clock is ticking. <b>Mash the red button</b> to ship, grab a <b>drink</b> from the fridge for a boost, and spend players on <b>upgrades</b>.</p>' +
      '<button class="big-btn" id="ov-btn">▶ ENTER THE ROOM</button></div>');
    els.overlay.classList.add("title-mode");
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); G.players = 0; G.shipped = 0; G.upg = { autocomplete: 0, marketing: 0, viral: 0, coffee: 0 }; enterRoom(); };
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
    if (G.state !== "title" && G.state !== "boot") {
      G.players += perSecNow() * dt;
      if (G.state === "itch") { var el = document.getElementById("itch-count"); if (el) el.textContent = fmt(G.players); renderAfford(); }
    }
    // room walking
    if (G.state === "room") updateRoom(dt);
    // typing clock (slowed by the Monster buff)
    if (G.state === "code" && G.typing) {
      var before = Math.floor(G.typeTime); G.typeTime += dt * (G.buff.clockSlow || 1);
      if (Math.floor(G.typeTime) !== before) A.sfx.timerLow();
    }
    // decays
    if (G.mistakeFlash > 0) G.mistakeFlash -= dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
    if (G.handTap > 0) G.handTap = Math.max(0, G.handTap - dt);
    if (G.btn > 0) G.btn = Math.max(0, G.btn - dt);
    for (var k in G.pressed) { G.pressed[k] -= dt; if (G.pressed[k] <= 0) delete G.pressed[k]; }
    if (G.state === "ship") G.build = Math.max(0, G.build - GAME.mashDecay * dt);
    // chugging: tilt eases back, gulp squash decays
    if (G.chug) {
      G.chug.t += dt;
      if (!G.chug.done) G.chug.tilt = Math.max(0, G.chug.tilt - dt * 0.55);
      if (G.chug.gulp > 0) G.chug.gulp = Math.max(0, G.chug.gulp - dt);
    }
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

    if (G.state === "room") {
      renderRoom(t);
    } else if (G.state === "chug") {
      renderChug(t);
    } else if (G.state === "desktop" || G.state === "shop") {
      R.roomCanvas(ctx);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#0d0803"; ctx.fillRect(0, 0, W, H); ctx.restore();
      R.lightPool(ctx, W / 2, H * 0.45, W * 0.55, "#ffd9a0", 0.10);
    } else if (G.state === "code") {
      R.deskScene(ctx);
      R.monitorCode(ctx, G.target, G.typedLen, t, { mistake: Math.max(0, G.mistakeFlash) });
      R.keyboard(ctx, { next: G.target[G.typedLen], pressed: G.pressed, t: t });
      R.handsSprite(ctx, 2, W / 2, t, { scale: 0.55, tap: G.handTap * 90, bobAmt: 2.5 });
      R.keyGlow(ctx, G.target[G.typedLen], t);   // shown over the hands so you always see the next key
      bigClock(t);
      hud();
    } else if (G.state === "ship") {
      R.deskScene(ctx);
      // monitor keeps showing the finished code (aligned to the CRT)
      R.monitorCode(ctx, G.target, G.target.length, t, {});
      // red button sits on the DESK, fully clear of the monitor/tower
      var bx = W * 0.80, by = H * 0.845, squash = G.btn > 0 ? 1 : 0;
      // build bar above the button
      var barW = 120, barX = bx - barW / 2, barY = by - H * 0.20;
      ctx.fillStyle = "#ffca55"; ctx.font = "bold 11px 'Courier New',monospace"; ctx.textAlign = "center";
      var pulse = 1 + 0.06 * Math.sin(t * 14);
      ctx.save(); ctx.translate(bx, barY - 14); ctx.scale(pulse, pulse); ctx.fillText("MASH SPACE!", 0, 0); ctx.restore();
      R.fillRR(ctx, barX - 2, barY - 2, barW + 4, 12, 3, "#000");
      R.fillRR(ctx, barX, barY, barW, 8, 2, "#241812");
      R.fillRR(ctx, barX, barY, barW * (G.build / GAME.shipTarget), 8, 2, "#5fe0a0");
      // the button (squashes when pressed)
      // hand reaches in from the bottom-right FIRST so the button stays readable
      R.handsSprite(ctx, 1, bx + 34, t, { scale: 0.42, tap: (G.btn > 0 ? 10 : -14), bobAmt: 2, fast: G.build > 0 });
      R.contactShadow(ctx, bx, by + H * 0.07, 32, squash * 3);
      R.runButton(ctx, bx, by, H * (0.24 - squash * 0.015), G.btn > 0, t);
      hud();
    } else {
      // title: bouncy walking dev in the room; itch: idle hands at the desk
      if (G.state === "title") { R.roomCanvas(ctx); walker(t); }
      else { R.deskScene(ctx); R.handsSprite(ctx, 0, W / 2, t, { scale: 0.5, bobAmt: 3 }); }
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

  // ---- chugging minigame scene ----
  function renderChug(t) {
    var c = G.chug; if (!c) { return; }
    R.deskScene(ctx);
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = "#120a04"; ctx.fillRect(0, 0, W, H); ctx.restore();
    R.lightPool(ctx, W / 2, H * 0.42, W * 0.42, "#ffe0b0", 0.22);

    // first-person: the drink is held up close, rising toward the camera as you chug
    var gulp = c.gulp > 0 ? 1 : 0;
    var cy = H * 0.60 - c.amount * 40 - gulp * 5;
    var h = H * (0.52 + c.amount * 0.10) * (1 + gulp * 0.04);
    R.handsSprite(ctx, 0, W / 2 + 46, t, { scale: 0.46, tap: 6 + c.amount * 30, bobAmt: 2, fast: true });
    R.drinkBig(ctx, c.drink, W / 2, cy, h, -c.tilt, c.amount);
    // foam/steam wisps on each gulp
    if (gulp) for (var i = 0; i < 3; i++) { ctx.save(); ctx.globalAlpha = 0.5; R.circle(ctx, W / 2 + (Math.random() - 0.5) * 40, cy - h * 0.4 - Math.random() * 12, 2 + Math.random() * 2, "#fff"); ctx.restore(); }

    // progress ring / bar
    var bw = 150, bx = (W - bw) / 2, by = H * 0.14;
    R.fillRR(ctx, bx - 3, by - 3, bw + 6, 16, 4, "rgba(20,12,6,.85)");
    R.fillRR(ctx, bx, by, bw, 10, 3, "#2a1d12");
    R.fillRR(ctx, bx, by, bw * c.amount, 10, 3, c.amount >= 1 ? "#7bd88a" : "#ffca55");
    ctx.textAlign = "center"; ctx.font = "bold 11px 'Courier New',monospace";
    ctx.fillStyle = "#f3e9da";
    ctx.fillText(c.done ? "AHHHH!" : "CLICK / TAP FAST TO DRINK!", W / 2, by - 8);
    ctx.textAlign = "left";
    R.vignette(ctx);
  }

  // bouncy little dev walking across the room floor (title screen)
  function walker(t) {
    var rr = R.roomRect(), speed = rr.w * 0.1, period = rr.w + 120;
    var x = rr.x - 50 + ((t * speed) % period), feetY = R.roomMap(0, ROOM.floorY).y;
    var hop = Math.abs(Math.sin(t * 6)), bob = -hop * 8;
    ctx.save(); ctx.globalAlpha = 0.28 - hop * 0.14; ctx.beginPath(); ctx.ellipse(x, feetY, 15 - hop * 4, 4.5, 0, 0, 6.28); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();
    var frame = (Math.floor(t * 6) % 2) ? "walkB" : "walkA";
    R.playerSprite(ctx, frame, x, feetY + rr.h * ROOM.scale * 0.06 + bob, rr.h * ROOM.scale, false, t, "");
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
