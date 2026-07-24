/* =========================================================
   GAME JAM SIMULATOR — game.js
   Phases: title → room(walk) → pack → install → build → run
           → result → drinks → (next day) … → win / gameover
   ========================================================= */
(function (global) {
  "use strict";

  var D = global.JamData, R = global.JamRender, A = global.JamAudio, AS = global.JamAssets;
  var GEARS = D.GEARS, GRAPHICS = D.GRAPHICS, DRINKS = D.DRINKS, DAYS = D.DAYS,
      CONFIG = D.CONFIG, DEBUFFS = D.DEBUFFS, L = D.LAYOUT;
  var W = R.W, H = R.H;

  // board geometry
  var CELL = L.cell, BX = L.bx, BY = L.by, COLS = L.cols, ROWS = L.rows, CORE = L.coreCell;

  var canvas, ctx, els = {}, drawPool;
  var tutorialEnabled = true, tutSeen = {};

  var G = {
    state: "title",
    day: 0, goal: 0,
    clock: 0, clockRunning: false, maxClock: 80,
    energy: 0, maxEnergy: 40,
    inventory: { gears: {}, graphics: {} },
    dayGears: {}, dayGraphics: {}, jammedType: null,
    board: [],
    palette: [],           // built each build phase from inventory
    cursor: null,          // {mode:'place'|'graphic'|'move', id?/c,r}
    hoverCell: null, hoverComputer: false,
    score: { chips: 0, mult: 1, hype: 0, connected: new Set(), wires: [] },
    compiledHype: 0,
    debuff: null, debuffInfo: null, pendingDebuff: null, pendingDrink: null,
    nextEnergy: CONFIG.startEnergy, crashPending: false, wired: false, glitch: false,
    packsLeft: 0, packCards: null, chosenCard: null,
    player: { x: 0, feetY: 0, facing: -1, moving: false, target: null, intendWork: false, animT: 0, sitting: false },
    pops: [], run: null, log: [], toastTimer: 0, blinkT: 0
  };

  // =========================================================
  //  INIT
  // =========================================================
  function init() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    grab();
    drawPool = D.buildDrawPool();

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerleave", function () { G.hoverCell = null; G.hoverComputer = false; hideTooltip(); });
    els.runBtn.addEventListener("click", doRun);
    els.muteBtn.addEventListener("click", function () { els.muteBtn.textContent = A.toggleMute() ? "🔇" : "🔊"; });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", function () { A.unlock(); }, { once: true });

    // animated room background (GIF/PNG) as a DOM layer behind the canvas
    G.roomOk = false;
    els.roombg.onload = function () { G.roomOk = true; };
    els.roombg.onerror = function () { G.roomOk = false; };
    els.roombg.src = "assets/room.gif";

    // load assets with a progress bar, then show title
    var msg = els.loadMsg;
    AS.load(function () {
      els.loadBar.style.width = "100%";
      var found = ["room", "player", "drinks", "pack_gears", "pack_graphics"].filter(function (n) { return AS.has(n); });
      msg.textContent = found.length ? ("Loaded art: " + found.join(", ")) : "Using built-in art (drop files in /assets to use yours).";
      setTimeout(function () { els.loading.classList.remove("show"); showTitle(); }, 500);
    });
    els.loadBar.style.width = "60%";
    requestAnimationFrame(loop);
  }

  function grab() {
    var id = function (s) { return document.getElementById(s); };
    els.hud = id("hud"); els.tray = id("tray"); els.hand = id("hand"); els.overlay = id("overlay");
    els.tooltip = id("tooltip"); els.status = id("statusbar"); els.stage = id("stage"); els.tut = id("tutorial"); els.roombg = id("roombg");
    els.day = id("hud-day"); els.goal = id("hud-goal"); els.clock = id("hud-clock"); els.clockWrap = id("hud-clock-wrap");
    els.energy = id("hud-energy"); els.hype = id("hud-hype"); els.barEnergy = id("bar-energy");
    els.chipsOut = id("chips-out"); els.multOut = id("mult-out"); els.runBtn = id("btn-run"); els.muteBtn = id("btn-mute");
    els.loading = id("loading"); els.loadBar = id("load-bar"); els.loadMsg = id("load-msg");
  }

  // =========================================================
  //  COORD MAP
  // =========================================================
  function toXY(e) {
    var r = canvas.getBoundingClientRect();
    var sc = Math.min(r.width / W, r.height / H);
    var ox = (r.width - W * sc) / 2, oy = (r.height - H * sc) / 2;
    return { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc };
  }
  function cellAt(x, y) {
    var c = Math.floor((x - BX) / CELL), r = Math.floor((y - BY) / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return { c: c, r: r };
  }
  function cellCenter(c, r) { return { x: BX + c * CELL + CELL / 2, y: BY + r * CELL + CELL / 2 }; }
  function inRect(x, y, rc) { return x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h; }

  // =========================================================
  //  INPUT
  // =========================================================
  function onMove(e) {
    var p = toXY(e);
    if (G.state === "room") {
      var z = CONFIG.room.computerZone;
      G.hoverComputer = (p.x >= z.x * W && p.x <= (z.x + z.w) * W && p.y >= z.y * H && p.y <= (z.y + z.h) * H);
      hideTooltip();
    } else if (G.state === "build") {
      var cell = cellAt(p.x, p.y);
      G.hoverCell = cell;
      if (cell && G.board[cell.r][cell.c].gid) showGearTip(G.board[cell.r][cell.c], e.clientX, e.clientY);
      else hideTooltip();
    }
  }

  function onDown(e) {
    var p = toXY(e);
    if (G.state === "room") {
      var z = CONFIG.room.computerZone;
      if (p.x >= z.x * W && p.x <= (z.x + z.w) * W && p.y >= z.y * H && p.y <= (z.y + z.h) * H) {
        G.player.target = CONFIG.room.computerStand.x * W; G.player.intendWork = true;
      } else {
        G.player.target = Math.max(20, Math.min(W - 20, p.x)); G.player.intendWork = false;
      }
    } else if (G.state === "build") {
      var cell = cellAt(p.x, p.y);
      if (cell) onBoard(cell.c, cell.r);
    }
  }

  function onKey(e) {
    if (G.state === "room") {
      if (e.key === "ArrowLeft" || e.key === "a") { G.player.target = G.player.x - 60; G.player.intendWork = false; }
      else if (e.key === "ArrowRight" || e.key === "d") { G.player.target = G.player.x + 60; G.player.intendWork = false; }
      else if (e.key === "e" || e.key === "Enter") { G.player.target = CONFIG.room.computerStand.x * W; G.player.intendWork = true; }
    } else if (G.state === "build") {
      if (e.key === "Escape") cancelCursor();
      else if (e.key === "Enter") doRun();
    }
  }

  // =========================================================
  //  DAY LIFECYCLE
  // =========================================================
  function newGame() {
    G.day = 0;
    G.inventory = { gears: clone(CONFIG.startInventory.gears), graphics: clone(CONFIG.startInventory.graphics) };
    G.nextEnergy = CONFIG.startEnergy; G.pendingDebuff = null; G.pendingDrink = null;
    startDay();
  }

  function startDay() {
    var dd = DAYS[G.day];
    G.goal = dd.goal;
    G.debuff = G.pendingDebuff; G.debuffInfo = G.debuff ? DEBUFFS[G.debuff] : null;
    G.pendingDebuff = null;

    var e = (G.day === 0) ? CONFIG.startEnergy : G.nextEnergy;
    if (G.debuff === "foggy") e = Math.round(e * 0.8);
    G.energy = e;
    G.maxClock = dd.seconds;
    G.clock = dd.seconds - (G.debuff === "jittery" ? 15 : 0);
    G.glitch = (G.debuff === "glitch");
    G.wired = (G.debuff === "wired");
    G.crashPending = (G.debuff === "crash");
    G.packsLeft = CONFIG.packsForDay(G.day);
    G.compiledHype = 0;
    resetBoard();
    computeScore();
    G.log = ["> booting GearEngine v0.7…", "> project: MyGame.gjam"];
    showBrief(dd);
  }

  function resetBoard() {
    G.board = [];
    for (var r = 0; r < ROWS; r++) { var row = []; for (var c = 0; c < COLS; c++) row.push({ gid: null, graphic: null, angle: Math.random() * 6.28, blink: false }); G.board.push(row); }
    G.board[CORE.r][CORE.c] = { gid: "core", graphic: null, angle: 0, blink: false };
    G.cursor = null;
  }

  // ---- walk into the room ----
  function enterRoom() {
    G.state = "room";
    var room = CONFIG.room;
    G.player.feetY = ((room.floorY[0] + room.floorY[1]) / 2) * H;
    G.player.x = room.spawnX * W; G.player.target = null; G.player.intendWork = false; G.player.sitting = false; G.player.moving = false;
    applyChrome(); updateHUD(); updateHint();
  }

  function beginWork() {
    G.player.sitting = true;
    openDesktop();
  }

  function launchEngine() {
    hideOverlay();
    if (G.packsLeft > 0) startPack();
    else enterBuild();
  }

  // A little retro OS you boot into when you sit at the computer.
  function openDesktop() {
    G.state = "desktop"; applyChrome();
    var apps = [
      { id: "engine", icon: "🛠️", name: "GearEngine", accent: "#ffca55" },
      { id: "assets", icon: "📦", name: "Assets", accent: "#6ee0ff" },
      { id: "net", icon: "🌐", name: "GameJamNet", accent: "#7bd88a" },
      { id: "trash", icon: "🗑️", name: "Recycle", accent: "#b8a48e" }
    ];
    var icons = apps.map(function (a) {
      return '<button class="dk-icon" data-app="' + a.id + '"><span class="dk-emoji">' + a.icon + '</span><span class="dk-label">' + a.name + '</span></button>';
    }).join("");
    overlay('<div class="desktop">' +
      '<div class="dk-wall"><div class="dk-logo">GearOS<span>95</span></div>' +
      '<div class="dk-icons">' + icons + '</div></div>' +
      '<div class="dk-taskbar"><button class="dk-start">▚ Start</button>' +
      '<span class="dk-hint">Open <b>GearEngine</b> to build your game →</span>' +
      '<span class="dk-clock">Day ' + (G.day + 1) + '  ◷ late</span></div>' +
      '<div id="dk-window" class="dk-window hidden"></div></div>');
    var wrap = els.overlay.querySelector(".desktop");
    wrap.querySelectorAll(".dk-icon").forEach(function (btn) {
      btn.onclick = function () { A.sfx.ui(); onDesktopApp(btn.getAttribute("data-app")); };
    });
    wrap.querySelector(".dk-start").onclick = function () { A.sfx.ui(); onDesktopApp("engine"); };
  }

  function onDesktopApp(id) {
    if (id === "engine") { A.sfx.select(); launchEngine(); return; }
    var win = document.getElementById("dk-window");
    var owned = Object.keys(G.inventory.gears).length + Object.keys(G.inventory.graphics).length;
    var body = {
      assets: "📦 Installed assets: <b>" + owned + "</b> types.<br>Your gears &amp; art live inside GearEngine — open it to build.",
      net: "🌐 <b>GameJamNet</b><br>“day 1 and someone already has a vertical slice???”<br>“my game is just a cube. send help.”<br><i>(do NOT read the comments.)</i>",
      trash: "🗑️ <b>Recycle Bin</b><br>0 items. You never delete anything. That's the problem."
    }[id] || "…";
    win.innerHTML = '<div class="dk-titlebar"><span>' + id + '.exe</span><button class="dk-x">✕</button></div><div class="dk-body">' + body + '</div>';
    win.classList.remove("hidden");
    win.querySelector(".dk-x").onclick = function () { win.classList.add("hidden"); };
  }

  // =========================================================
  //  PACKS
  // =========================================================
  function drawCard() {
    var pick = drawPool[(Math.random() * drawPool.length) | 0];
    return { kind: pick.kind, id: pick.id, rarity: pick.rarity };
  }
  function startPack() {
    G.state = "pack";
    var roll = Math.random();
    var packType = roll < 0.55 ? "gears" : (roll < 0.85 ? "graphics" : "pets");
    G.packCards = drawThemedCards(packType, 3);
    G.chosenCard = null;
    applyChrome();
    renderPackOverlay(false, packType);
  }

  // Themed packs bias what they contain (still rarity-weighted).
  function drawThemedCards(type, n) {
    var pool = drawPool;
    if (type === "gears") pool = drawPool.filter(function (c) { return c.kind === "gear"; });
    else if (type === "graphics") pool = drawPool.filter(function (c) { return c.kind === "graphic"; });
    var cards = [], guard = 0;
    function have(pk) { return cards.some(function (x) { return x.kind === pk.kind && x.id === pk.id; }); }
    while (cards.length < n && guard++ < 300) {
      var pk = pool[(Math.random() * pool.length) | 0];
      if (type === "pets" && pk.rarity === "common" && Math.random() < 0.6) continue; // pets skew rare
      if (!have(pk)) cards.push({ kind: pk.kind, id: pk.id, rarity: pk.rarity });
    }
    // guarantee n cards even if the reroll loop starved
    guard = 0;
    while (cards.length < n && guard++ < 300) {
      var pk2 = pool[(Math.random() * pool.length) | 0];
      if (!have(pk2)) cards.push({ kind: pk2.kind, id: pk2.id, rarity: pk2.rarity });
    }
    return cards;
  }

  function renderPackOverlay(opened, packType) {
    var html = '<div class="modal pack-modal">';
    if (!opened) {
      html += '<h1>📦 BOOSTER PACK</h1><p class="lead">A fresh pack of assets just finished downloading. Rip it open!</p>' +
        '<canvas id="pack-cv" width="130" height="180" class="pack-cv"></canvas>' +
        '<p class="small">(click the pack)</p></div>';
      overlay(html);
      var pc = document.getElementById("pack-cv");
      var pctx = pc.getContext("2d"); pctx.imageSmoothingEnabled = false;
      G._packAnim = { cv: pc, ctx: pctx, type: packType, ripping: false, ripStart: null, done: false };
      pc.style.cursor = "pointer";
      pc.onclick = function () { if (G._packAnim.ripping) return; G._packAnim.ripping = true; A.sfx.packOpen(); shake(6); tut("pack"); };
    } else {
      html += '<h1>✨ PICK ONE</h1><p class="lead">Choose a card to install. Rarer cards are stronger.</p><div class="pack-cards" id="pack-cards"></div></div>';
      overlay(html);
      var wrap = document.getElementById("pack-cards");
      G.packCards.forEach(function (card, i) {
        var def = card.kind === "gear" ? GEARS[card.id] : GRAPHICS[card.id];
        var div = document.createElement("div");
        div.className = "pcard rar-" + card.rarity + " flip";
        div.style.animationDelay = (i * 0.12) + "s";
        var cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
        if (card.kind === "gear") R.gearThumb(cv, def); else R.graphicThumb(cv, def);
        div.appendChild(cv);
        var nm = document.createElement("div"); nm.className = "pc-name"; nm.textContent = def.name; div.appendChild(nm);
        var st = document.createElement("div"); st.className = "pc-stat"; st.textContent = card.kind === "gear" ? statLine(card.id, "gear") : statLine(card.id, "graphic"); div.appendChild(st);
        var rr = document.createElement("div"); rr.className = "pc-rar"; rr.textContent = card.rarity.toUpperCase(); div.appendChild(rr);
        div.onclick = function () { pickCard(card); };
        wrap.appendChild(div);
      });
    }
  }

  function pickCard(card) {
    G.chosenCard = card; A.sfx.select(); tut("pick"); installCard(card);
  }

  function installCard(card) {
    G.state = "install";
    var def = card.kind === "gear" ? GEARS[card.id] : GRAPHICS[card.id];
    overlay('<div class="modal"><h1>⏳ INSTALLING</h1>' +
      '<p class="lead">' + def.name + '</p>' +
      '<div class="bar big"><div id="inst-bar" class="bar-fill" style="width:0%"></div></div>' +
      '<pre id="inst-log" class="inst-log"></pre></div>');
    tut("install");
    var bar = document.getElementById("inst-bar"), log = document.getElementById("inst-log");
    var lines = ["fetching " + def.name.toLowerCase() + "…", "extracting assets…", "resolving dependencies…", "compiling shaders…", "linking to CORE…", "done ✓"];
    var start = performance.now(), dur = CONFIG.installMs, li = 0;
    A.sfx.install();
    var iv = setInterval(function () {
      var p = Math.min(1, (performance.now() - start) / dur);
      bar.style.width = (p * 100).toFixed(0) + "%";
      var want = Math.floor(p * lines.length);
      while (li < want && li < lines.length) { log.textContent += "> " + lines[li] + "\n"; li++; A.sfx.tick(); }
      if (p >= 1) {
        clearInterval(iv);
        while (li < lines.length) { log.textContent += "> " + lines[li] + "\n"; li++; }
        // add to inventory
        var inv = card.kind === "gear" ? G.inventory.gears : G.inventory.graphics;
        inv[card.id] = (inv[card.id] || 0) + 1;
        G.log.push("> installed " + def.name);
        A.sfx.cash(); tut("installed");
        G.packsLeft--;
        setTimeout(function () { hideOverlay(); if (G.packsLeft > 0) startPack(); else enterBuild(); }, 450);
      }
    }, 60);
  }

  // =========================================================
  //  BUILD
  // =========================================================
  function enterBuild() {
    G.state = "build";
    buildPalette();
    G.cursor = null; G.compiledHype = 0; G.clockRunning = true;
    computeScore(); applyChrome(); renderTray(); updateHUD(); updateHint();
    G.log.push("> ready. wire gears to CORE, then RUN.");
    tut("build");
  }

  function buildPalette() {
    G.dayGears = clone(G.inventory.gears);
    G.dayGraphics = clone(G.inventory.graphics);
    G.jammedType = null;
    if (G.debuff === "meltdown") {
      var keys = Object.keys(G.dayGears).filter(function (k) { return G.dayGears[k] > 0; });
      if (keys.length) { var j = keys[(Math.random() * keys.length) | 0]; G.jammedType = j; G.dayGears[j] = 0; }
    }
  }

  function cancelCursor() {
    if (G.cursor && G.cursor.mode === "move") {
      // return held gear to palette
      G.dayGears[G.cursor.gid] = (G.dayGears[G.cursor.gid] || 0) + 1;
      if (G.cursor.graphic) G.dayGraphics[G.cursor.graphic] = (G.dayGraphics[G.cursor.graphic] || 0) + 1;
    }
    G.cursor = null; renderTray(); updateHint();
  }

  function onPaletteClick(item) {
    if (G.run || G.state !== "build") return;
    if (item.kind === "gear") {
      if (G.jammedType === item.id) { toast("⚠ " + GEARS[item.id].name + " is JAMMED today."); A.sfx.error(); return; }
      if ((G.dayGears[item.id] || 0) <= 0) { toast("None left — install more from packs."); A.sfx.error(); return; }
      if (G.energy <= 0) { toast("⚡ Out of energy — hit ▶ RUN!"); A.sfx.error(); return; }
      G.cursor = (G.cursor && G.cursor.mode === "place" && G.cursor.id === item.id) ? null : { mode: "place", id: item.id };
    } else {
      if ((G.dayGraphics[item.id] || 0) <= 0) { toast("None left."); A.sfx.error(); return; }
      if (G.energy <= 0) { toast("⚡ Out of energy — hit ▶ RUN!"); A.sfx.error(); return; }
      G.cursor = (G.cursor && G.cursor.mode === "graphic" && G.cursor.id === item.id) ? null : { mode: "graphic", id: item.id };
    }
    A.sfx.select(); renderTray(); updateHint();
  }

  function onBoard(c, r) {
    if (G.run || G.state !== "build") return;
    var cell = G.board[r][c], cur = G.cursor;
    if (cur && cur.mode === "place") {
      if (cell.gid) { toast("Slot taken."); A.sfx.error(); return; }
      placeGear(cur.id, c, r);
    } else if (cur && cur.mode === "graphic") {
      if (!cell.gid) { toast("Apply art to a gear."); A.sfx.error(); return; }
      applyGraphic(cur.id, c, r);
    } else if (cur && cur.mode === "move") {
      if (cell.gid === "core") { toast("The CORE is bolted down."); }
      else if (cell.gid) { toast("Slot taken."); A.sfx.error(); }
      else { G.board[r][c] = { gid: cur.gid, graphic: cur.graphic, angle: Math.random() * 6.28, blink: false }; G.cursor = null; A.sfx.place(); computeScore(); updateHUD(); }
    } else {
      if (cell.gid && cell.gid !== "core") { G.cursor = { mode: "move", gid: cell.gid, graphic: cell.graphic }; G.board[r][c] = { gid: null, graphic: null, angle: 0, blink: false }; A.sfx.select(); computeScore(); updateHUD(); }
      else if (cell.gid === "core") toast("Everything wires back to the CORE.");
    }
    renderTray(); updateHint();
  }

  function placeGear(id, c, r) {
    var gd = GEARS[id];
    var cost = gd.energy + (G.wired ? 1 : 0);
    if (G.crashPending) { cost *= 2; G.crashPending = false; G.log.push("! sugar crash: double energy"); }
    var over = cost > G.energy;
    G.board[r][c] = { gid: id, graphic: null, angle: Math.random() * 6.28, blink: false };
    G.energy = Math.max(0, G.energy - cost);
    G.dayGears[id]--; G.cursor = null;
    G.board[r][c].pop = 1;
    G.log.push("> wired " + gd.name + " → CORE  (-" + cost + "⚡)");
    A.sfx.place(); computeScore(); updateHUD(); tut("placed");
    if (over) passout();
  }

  function applyGraphic(id, c, r) {
    var gr = GRAPHICS[id];
    var over = gr.energy > G.energy;
    G.board[r][c].graphic = id;
    G.energy = Math.max(0, G.energy - gr.energy);
    G.dayGraphics[id]--; G.cursor = null;
    G.board[r][c].pop = 1;
    G.log.push("> painted " + gr.name + "  (-" + gr.energy + "⚡)");
    A.sfx.apply(); computeScore(); updateHUD();
    if (over) passout();
  }

  function passout() {
    G.clockRunning = false; G.cursor = null; renderTray(); updateHUD();
    A.sfx.passout(); G.log.push("! ENERGY DEPLETED — passing out");
    overlay('<div class="modal"><h1>😵 YOU PASSED OUT</h1><p class="lead">You burned your last drop of energy and faceplanted the keyboard.</p><p>The build ships with whatever compiled.</p><button class="big-btn" id="ov-btn">Ugh… see the damage →</button></div>');
    document.getElementById("ov-btn").onclick = function () { hideOverlay(); doRun(true); };
  }

  // =========================================================
  //  SCORING
  // =========================================================
  function computeScore() {
    var connected = new Set(); var stack = [[CORE.c, CORE.r]]; connected.add(CORE.c + "," + CORE.r);
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (stack.length) {
      var cur = stack.pop();
      for (var d = 0; d < 4; d++) {
        var nc = cur[0] + dirs[d][0], nr = cur[1] + dirs[d][1];
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        var k = nc + "," + nr; if (connected.has(k)) continue;
        if (G.board[nr][nc].gid) { connected.add(k); stack.push([nc, nr]); }
      }
    }
    // ---- build trait context (families, art counts) ----
    var x = { n: 0, fam: {}, artCount: 0, maxArt: 0 };
    var artStyles = {};
    connected.forEach(function (k) {
      var p = k.split(","), c = +p[0], r = +p[1], cell = G.board[r][c], gd = GEARS[cell.gid];
      if (gd.fam && gd.fam !== "core") { x.fam[gd.fam] = (x.fam[gd.fam] || 0) + 1; x.n++; }
      if (cell.graphic) { x.artCount++; artStyles[cell.graphic] = (artStyles[cell.graphic] || 0) + 1; }
    });
    for (var sName in artStyles) if (artStyles[sName] > x.maxArt) x.maxArt = artStyles[sName];

    // ---- base + trait scoring ----
    var chips = 0, mult = 1, xmults = [];
    connected.forEach(function (k) {
      var p = k.split(","), c = +p[0], r = +p[1], cell = G.board[r][c], gd = GEARS[cell.gid];
      chips += gd.chips; mult += gd.mult;
      if (gd.type === "xmult") xmults.push(gd.xmult);
      if (cell.graphic) { chips += GRAPHICS[cell.graphic].chips; mult += GRAPHICS[cell.graphic].mult; }
      if (gd.trait) {
        if (gd.trait.chips) chips += gd.trait.chips(x);
        if (gd.trait.mult) mult += gd.trait.mult(x);
      }
    });
    // ---- adjacency: same art style (+3 mult) & same family (+1 mult) ----
    var wires = [];
    connected.forEach(function (k) {
      var p = k.split(","), c = +p[0], r = +p[1];
      [[1, 0], [0, 1]].forEach(function (dir) {
        var nc = c + dir[0], nr = r + dir[1]; if (!connected.has(nc + "," + nr)) return;
        wires.push([c, r, nc, nr]);
        var a = G.board[r][c], b = G.board[nr][nc], ga = GEARS[a.gid], gb = GEARS[b.gid];
        if (a.graphic && b.graphic && a.graphic === b.graphic) mult += D.ART_SYNERGY_MULT;
        if (ga.fam === gb.fam && ga.fam !== "core") mult += 1;
      });
    });
    // ---- combos (Balatro-style hands) ----
    var combos = [];
    D.COMBOS.forEach(function (cm) {
      if (cm.test(x)) { combos.push(cm); if (cm.chips) chips += cm.chips; if (cm.mult) mult += cm.mult; if (cm.xmult) xmults.push(cm.xmult); }
    });
    for (var i = 0; i < xmults.length; i++) mult *= xmults[i];
    mult = Math.round(mult * 100) / 100;
    G.score = { chips: chips, mult: mult, hype: Math.round(chips * Math.max(mult, 0)), connected: connected, wires: wires, connCount: connected.size, combos: combos, ctx: x };
    return G.score;
  }

  // =========================================================
  //  RUN (compile) — gears spin + point popups
  // =========================================================
  function doRun(forced) {
    if (G.run || G.state !== "build") return;
    G.clockRunning = false; G.cursor = null; renderTray(); els.runBtn.disabled = true;
    G.state = "run"; A.sfx.run(); G.log.push("> compiling build…");
    tut("ran");

    var sc = computeScore(), xc = sc.ctx;
    var order = bfsOrder();
    var list = [];
    order.forEach(function (k) {
      var p = k.split(","), c = +p[0], r = +p[1], cell = G.board[r][c], gd = GEARS[cell.gid];
      var ctr = cellCenter(c, r);
      var chip = gd.chips + (cell.graphic ? GRAPHICS[cell.graphic].chips : 0) + (gd.trait && gd.trait.chips ? gd.trait.chips(xc) : 0);
      var mlt = gd.mult + (cell.graphic ? GRAPHICS[cell.graphic].mult : 0) + (gd.trait && gd.trait.mult ? gd.trait.mult(xc) : 0);
      if (chip > 0) list.push({ x: ctr.x, y: ctr.y, txt: "+" + chip, color: "#5df0ff", addChips: chip, bump: [c, r] });
      if (mlt > 0) list.push({ x: ctr.x, y: ctr.y - 8, txt: "+" + mlt + "×", color: "#ff5df0", addMult: mlt, bump: [c, r] });
      if (gd.type === "xmult") list.push({ x: ctr.x, y: ctr.y - 8, txt: "×" + gd.xmult, color: "#ffcf4d", mulMult: gd.xmult, bump: [c, r] });
    });
    // adjacency synergies (art + family) tallied at the core
    var synArt = 0, synFam = 0;
    sc.wires.forEach(function (w) {
      var a = G.board[w[1]][w[0]], b = G.board[w[3]][w[2]], ga = GEARS[a.gid], gb = GEARS[b.gid];
      if (a.graphic && b.graphic && a.graphic === b.graphic) synArt += D.ART_SYNERGY_MULT;
      if (ga.fam === gb.fam && ga.fam !== "core") synFam += 1;
    });
    var cc = cellCenter(CORE.c, CORE.r);
    if (synArt > 0) list.push({ x: cc.x, y: cc.y - 20, txt: "ART SYNC +" + synArt + "×", color: "#ffcf4d", addMult: synArt });
    if (synFam > 0) list.push({ x: cc.x, y: cc.y - 12, txt: "TYPE SYNC +" + synFam + "×", color: "#8ee65a", addMult: synFam });

    G.run = { list: list, i: 0, timer: 0, chips: 0, mult: 1, phase: "cascade", final: 0, forced: !!forced, target: sc.hype, combos: (sc.combos || []).slice(), comboI: 0 };
  }

  function bfsOrder() {
    var seen = new Set(), q = [[CORE.c, CORE.r]], out = []; seen.add(CORE.c + "," + CORE.r);
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      var cur = q.shift(), k = cur[0] + "," + cur[1]; out.push(k);
      for (var d = 0; d < 4; d++) { var nc = cur[0] + dirs[d][0], nr = cur[1] + dirs[d][1]; if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue; var kk = nc + "," + nr; if (seen.has(kk)) continue; if (G.board[nr][nc].gid) { seen.add(kk); q.push([nc, nr]); } }
    }
    return out;
  }

  function updateRun(dt) {
    var run = G.run; if (!run) return;
    if (!run.xmults) run.xmults = [];
    run.timer -= dt;
    if (run.phase === "cascade") {
      if (run.timer <= 0 && run.i < run.list.length) {
        var s = run.list[run.i++];
        if (s.addChips) run.chips += s.addChips;
        if (s.addMult) run.mult += s.addMult;
        if (s.mulMult) run.xmults.push(s.mulMult);   // apply multipliers LAST (matches computeScore)
        pop(s.x, s.y, s.txt, s.color, 15);
        if (s.bump) bumpCell(s.bump[0], s.bump[1]);
        A.sfx.point();
        run.timer = 0.14;
      } else if (run.i >= run.list.length) { run.phase = "combos"; run.timer = 0.35; }
    } else if (run.phase === "combos") {
      if (run.timer <= 0) {
        if (run.combos && run.comboI < run.combos.length) {
          var cm = run.combos[run.comboI++];
          if (cm.chips) run.chips += cm.chips;
          if (cm.mult) run.mult += cm.mult;
          if (cm.xmult) run.xmults.push(cm.xmult);
          var cc0 = cellCenter(CORE.c, CORE.r);
          pop(cc0.x, BY + ROWS * CELL / 2 - 24, cm.name, "#ffd24d", 20);
          shake(5); A.sfx.cash();
          run.timer = 0.5;
        } else { run.phase = "xmult"; run.timer = 0.3; }
      }
    } else if (run.phase === "xmult") {
      if (run.timer <= 0) {
        if (run.xmults.length) {
          var xm = run.xmults.shift();
          run.mult = Math.round(run.mult * xm * 100) / 100;
          var cc1 = cellCenter(CORE.c, CORE.r);
          pop(cc1.x, BY + ROWS * CELL / 2, "×" + xm, "#ff5df0", 22);
          shake(4); A.sfx.point();
          run.timer = 0.3;
        } else { run.phase = "total"; run.timer = 0.4; }
      }
    } else if (run.phase === "total") {
      if (run.timer <= 0) {
        run.final = Math.round(run.chips * Math.max(run.mult, 0));
        var cc = cellCenter(CORE.c, CORE.r);
        pop(cc.x, BY + ROWS * CELL / 2, run.final + " HYPE!", run.final >= G.goal ? "#8ee65a" : "#ff5d7a", 28);
        shake(run.final >= G.goal ? 9 : 4); A.sfx.cash();
        G.compiledHype = run.final;
        G.log.push("> build " + (run.final >= G.goal ? "OK" : "FAILED") + ": " + run.final + " HYPE");
        run.phase = "done"; run.timer = 1.2;
      }
    } else if (run.phase === "done") {
      if (run.timer <= 0) { G.run = null; els.runBtn.disabled = false; finalizeDay(); }
    }
  }

  function bumpCell(c, r) { if (G.board[r] && G.board[r][c]) G.board[r][c].pop = 1; }
  function shake(mag) { G.shake = Math.max(G.shake || 0, mag); }

  function finalizeDay() {
    var hype = G.compiledHype, passed = hype >= G.goal, isFinal = G.day === DAYS.length - 1;
    if (passed && isFinal) showWin(hype);
    else if (passed) showResult(hype);
    else showLose(hype);
  }

  function pop(x, y, txt, color, size) { G.pops.push({ x: x, y: y, txt: txt, color: color, size: size || 14, life: 1.1, vy: -22 }); }

  // =========================================================
  //  DRINKS
  // =========================================================
  function openDrinks() {
    G.state = "drinks"; applyChrome();
    var html = '<div class="modal drinks-modal"><h1>🧊 FRIDGE — FUEL UP</h1><p class="lead">Pick tonight\'s drink. More energy usually means a nastier catch.</p><div class="drinks-row" id="drinks-row"></div></div>';
    overlay(html);
    var row = document.getElementById("drinks-row");
    DRINKS.forEach(function (d) {
      var div = document.createElement("div"); div.className = "drink";
      var cv = document.createElement("canvas"); cv.width = 60; cv.height = 84;
      var cctx = cv.getContext("2d"); cctx.imageSmoothingEnabled = false;
      R.drinkSprite(cctx, d, 30, 42, 76);
      div.appendChild(cv);
      var nm = document.createElement("div"); nm.className = "d-name"; nm.textContent = d.name; div.appendChild(nm);
      var en = document.createElement("div"); en.className = "d-energy"; en.textContent = "+" + d.energy + " ⚡"; div.appendChild(en);
      var db = document.createElement("div"); db.className = "d-debuff";
      db.textContent = d.debuff ? (DEBUFFS[d.debuff].icon + " " + DEBUFFS[d.debuff].name) : "😌 no side effects";
      db.title = d.debuff ? DEBUFFS[d.debuff].text : "Clean. Boring. Safe.";
      div.appendChild(db);
      div.onclick = function () { chooseDrink(d); };
      row.appendChild(div);
    });
  }

  function chooseDrink(d) {
    A.sfx.sip(); G.nextEnergy = d.energy; G.pendingDebuff = d.debuff; G.pendingDrink = d;
    hideOverlay(); G.day++; startDay();
  }

  // =========================================================
  //  MODALS
  // =========================================================
  function showTitle() {
    G.state = "title"; applyChrome();
    var have = ["room", "player", "drinks", "pack_gears", "pack_graphics"].filter(function (n) { return AS.has(n); }).length;
    overlay('<div class="modal"><h1>🎮 GAME JAM<br>SIMULATOR</h1>' +
      '<p class="lead">7 days. One game. Infinite energy drinks.</p>' +
      '<p>Open <b>booster packs</b> for gears (mechanics) &amp; art. Wire gears to the glowing <b>CORE</b>, paint them, and <b>▶ RUN</b> to rain <b>HYPE</b>. Beat the day\'s goal before the <b>countdown</b> dies — coding burns energy, and zero energy means lights out.</p>' +
      '<ul class="tips"><li>HYPE = <span style="color:#5df0ff">chips</span> × <span style="color:#ff5df0">mult</span>.</li>' +
      '<li>Only gears connected to the CORE score.</li>' +
      '<li>Same art style on touching gears = big mult.</li>' +
      '<li>Each night, pick a drink (they all have a catch).</li></ul>' +
      (have ? '' : '<p class="small">Running on built-in art — add your PNGs to /assets to see your own.</p>') +
      '<button class="big-btn" id="ov-btn">▶ START THE JAM</button></div>');
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); hideOverlay(); if (tutorialEnabled) tutSeen = {}; newGame(); };
  }

  function showBrief(dd) {
    G.state = "brief"; applyChrome(); updateHUD();
    var db = (G.debuff && G.debuffInfo) ? '<p style="color:#ff5df0">😖 Hangover — <b>' + G.debuffInfo.name + '</b>: ' + G.debuffInfo.text + '</p>' : '';
    overlay('<div class="modal"><h1>' + dd.title + '</h1><p class="lead">' + dd.note + '</p>' +
      '<h2>Goal: <span class="big-num">' + dd.goal + ' HYPE</span> &nbsp; ⏳ ' + fmtClock(G.clock) + '</h2>' +
      '<p>⚡ Energy <b>' + G.energy + '</b> &nbsp;·&nbsp; 📦 Packs today: <b>' + G.packsLeft + '</b></p>' + db +
      '<button class="big-btn" id="ov-btn">🚪 Head to the desk →</button></div>');
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); hideOverlay(); enterRoom(); };
  }

  function scoreBox(hype) {
    return '<div class="scoreline" style="display:inline-block;margin:10px auto"><span style="color:#5df0ff">' + G.score.chips + '</span> <span style="color:#9a93b8">×</span> <span style="color:#ff5df0">' + fmtMult(G.score.mult) + '</span> <span style="color:#9a93b8">=</span> <span style="color:#ff8a3d">' + hype + '</span></div>';
  }

  function showResult(hype) {
    G.state = "result"; applyChrome(); A.sfx.cash();
    overlay('<div class="modal"><h1 class="win">✅ DAY CLEARED!</h1><p class="lead">' + hype + ' hype (needed ' + G.goal + '). Ship it.</p>' + scoreBox(hype) +
      '<p>' + flavor() + '</p><button class="big-btn" id="ov-btn">🛏️ Crash for the night →</button></div>');
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); hideOverlay(); openDrinks(); };
  }

  function showWin(hype) {
    G.state = "win"; applyChrome(); A.sfx.win();
    overlay('<div class="modal"><h1 class="win">🏆 YOU SHIPPED IT!</h1><p class="lead">Final hype: <b>' + hype + '</b> / ' + G.goal + '. Your game is <b>submitted</b>!</p>' + scoreBox(hype) +
      '<p>Seven nights of energy drinks and spite. Somewhere a stranger is about to rate your game 5 stars.</p><p class="small">Thanks for playing 💜</p>' +
      '<button class="big-btn" id="ov-btn">🔁 Jam again</button></div>');
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); tutorialEnabled = false; hideOverlay(); showTitle(); };
  }

  function showLose(hype) {
    G.state = "gameover"; applyChrome(); A.sfx.lose();
    var reason = G.energy <= 0 ? "You ran out of energy" : "The clock beat you";
    overlay('<div class="modal"><h1 class="lose">💀 JAM OVER</h1><p class="lead">Day ' + (G.day + 1) + ': only <b>' + hype + '</b> hype (needed ' + G.goal + ').</p>' + scoreBox(hype) +
      '<p>' + reason + '. Your game page reads "coming soon" forever.</p><button class="big-btn" id="ov-btn">🔁 Try again</button></div>');
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); tutorialEnabled = false; hideOverlay(); showTitle(); };
  }

  function flavor() {
    var s = G.score;
    if (s.mult >= 10) return "That multiplier is illegal in three states. Chef's kiss.";
    if (s.connCount >= 8) return "A glorious mega-machine of interlocking ideas.";
    if (s.chips >= 50) return "Chunky, content-rich, undeniably shippable.";
    return "Scrappy, but it works. Ship it and (maybe) sleep.";
  }

  // =========================================================
  //  LOOP + RENDER
  // =========================================================
  var last = 0;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    update(dt, now / 1000); render(now / 1000);
    requestAnimationFrame(loop);
  }

  function update(dt, t) {
    G.blinkT += dt;
    if (G.shake) G.shake = Math.max(0, G.shake - dt * 28);
    // spin board gears + decay place/pop bounce
    if (G.board.length) for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var cell = G.board[r][c]; if (!cell.gid) continue;
      var conn = G.score.connected.has(c + "," + r);
      var sp = conn ? (G.run ? 10 : 2.2) : 0.5; if (cell.gid === "core") sp = G.run ? 10 : 2.6;
      cell.angle += sp * (((c + r) % 2) ? -1 : 1) * dt;
      if (cell.pop) cell.pop = Math.max(0, cell.pop - dt * 3.2);
    }
    // countdown
    if (G.state === "build" && G.clockRunning && !G.tutActive) {
      G.clock -= dt * (G.glitch ? 1.2 : 1);
      if (G.clock <= 10 && Math.floor(G.clock) !== Math.floor(G.clock + dt)) A.sfx.timerLow();
      if (G.clock <= 0) { G.clock = 0; G.clockRunning = false; G.log.push("! TIME UP — auto-shipping"); doRun(true); }
      updateHUD();
    }
    // room walking
    if (G.state === "room") updateWalk(dt);
    // run cascade
    if (G.run) updateRun(dt);
    // pops
    for (var i = G.pops.length - 1; i >= 0; i--) { var p = G.pops[i]; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) G.pops.splice(i, 1); }
  }

  function updateWalk(dt) {
    var pl = G.player, room = CONFIG.room;
    if (pl.target != null) {
      var dx = pl.target - pl.x, spd = room.walkSpeed * W * dt;
      if (Math.abs(dx) <= spd) { pl.x = pl.target; pl.target = null; pl.moving = false; if (pl.intendWork) { pl.intendWork = false; beginWork(); } }
      else { pl.x += Math.sign(dx) * spd; pl.facing = dx < 0 ? -1 : 1; pl.moving = true; pl.animT += dt; }
    } else pl.moving = false;
  }

  function render(t) {
    ctx.imageSmoothingEnabled = false;
    var idePhase = (G.state === "build" || G.state === "run");
    // show the animated GIF room layer behind the canvas except in the IDE
    els.roombg.classList.toggle("hidden", !(G.roomOk && !idePhase));

    if (idePhase) renderBuild(t);
    else if (G.state === "room") renderRoom(t);
    else {
      // ambient behind modals: gif shows through a cleared canvas, else fallback
      if (G.roomOk) R.clear(ctx); else R.roomScene(ctx, t, {});
    }
    // pack idle-bob + tearing-open animation on the overlay canvas
    if (G.state === "pack" && G._packAnim && G._packAnim.cv && document.body.contains(G._packAnim.cv)) {
      var pa = G._packAnim; pa.ctx.clearRect(0, 0, pa.cv.width, pa.cv.height);
      var rip = 0;
      if (pa.ripping) { if (pa.ripStart == null) pa.ripStart = t; rip = Math.min(1, (t - pa.ripStart) / 0.55); }
      R.packRip(pa.ctx, pa.type, pa.cv.width / 2, pa.cv.height / 2, pa.cv.height * 0.9, rip, t);
      if (pa.ripping && rip >= 1 && !pa.done) { pa.done = true; A.sfx.cash(); renderPackOverlay(true, pa.type); }
    }
  }

  function renderRoom(t) {
    if (G.roomOk) R.clear(ctx); else R.roomScene(ctx, t, { hoverComputer: G.hoverComputer });
    var pl = G.player, room = CONFIG.room, hgt = room.playerScale * H;
    var z = room.computerZone;
    // computer hover highlight (drawn over the gif)
    if (G.hoverComputer) {
      ctx.save(); ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + 0.35 * Math.sin(t * 6);
      R.rr(ctx, z.x * W + 2, z.y * H, z.w * W - 4, z.h * H, 6); ctx.stroke(); ctx.restore();
    }
    var frame = pl.moving ? (Math.floor(pl.animT / 0.18) % 2 ? "walkB" : "walkA") : "back";
    R.playerSprite(ctx, frame, pl.x, pl.feetY, hgt, pl.facing === 1, t, "");
    // "WORK" prompt near computer
    if (G.hoverComputer || Math.abs(pl.x - room.computerStand.x * W) < 44) {
      ctx.save(); ctx.textAlign = "center";
      R.fillRR(ctx, z.x * W + z.w * W / 2 - 48, z.y * H - 18, 96, 15, 4, "rgba(24,16,10,.9)");
      ctx.font = "bold 10px 'Courier New',monospace"; ctx.fillStyle = "#ffcf4d";
      ctx.fillText("▸ CLICK TO WORK", z.x * W + z.w * W / 2, z.y * H - 7); ctx.restore();
    }
  }

  function renderBuild(t) {
    R.clear(ctx);
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#201811"); g.addColorStop(1, "#160f0a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (G.shake) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);

    // toolbar
    R.px(ctx, 0, 0, W, 30, "#2a1f16");
    ctx.fillStyle = "#e4d6c2"; ctx.font = "9px 'Courier New',monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("GearEngine ▸ MyGame.gjam", 10, 15);
    ["File", "Edit", "Build", "Help"].forEach(function (m, i) { ctx.fillStyle = "#9c8a70"; ctx.fillText(m, 170 + i * 40, 15); });
    // REC dot
    var recOn = G.clockRunning && !G.tutActive;
    ctx.fillStyle = recOn ? (Math.floor(t * 2) % 2 ? "#ff5544" : "#7a2f22") : "#5a4636";
    R.circle(ctx, W - 88, 15, 4, ctx.fillStyle);
    ctx.fillStyle = "#e4d6c2"; ctx.fillText(G.run ? "compiling…" : (recOn ? "REC" : "paused"), W - 78, 15);
    ctx.textBaseline = "alphabetic";

    // panels
    R.panel(ctx, L.nodePanel, "◆ Node Graph — connect to CORE", "#5df0ff");
    R.panel(ctx, L.inspector, "⚙ Inspector", "#ffd24d");
    R.panel(ctx, L.console, "> Console", "#8ee65a");

    // board grid — inset blueprint sockets
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var x = BX + c * CELL, y = BY + r * CELL, cell = G.board[r][c];
      R.fillRR(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 4, "#0d0a08");         // socket well
      ctx.strokeStyle = "#0a0806"; ctx.lineWidth = 1; ctx.strokeRect(x + 3.5, y + 3.5, CELL - 7, CELL - 7); // inset top-left dark
      ctx.strokeStyle = "#3a2c1e"; ctx.beginPath(); ctx.moveTo(x + 3.5, y + CELL - 3.5); ctx.lineTo(x + CELL - 3.5, y + CELL - 3.5); ctx.lineTo(x + CELL - 3.5, y + 3.5); ctx.stroke(); // bottom-right light
      if (!cell.gid) { ctx.save(); ctx.globalAlpha = 0.5; R.circle(ctx, x + CELL / 2, y + CELL / 2, 1.4, "#4a3728"); ctx.restore(); } // port dot
      var hov = G.hoverCell && G.hoverCell.c === c && G.hoverCell.r === r, cur = G.cursor;
      if (hov && cur) {
        var ok = (cur.mode === "place" && !cell.gid) || (cur.mode === "move" && !cell.gid) || (cur.mode === "graphic" && cell.gid);
        var col = cur.mode === "graphic" ? "#6ee0ff" : "#ffca55";
        if (ok) { ctx.save(); ctx.globalAlpha = 0.16; R.fillRR(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 4, col); ctx.restore(); ctx.strokeStyle = col; ctx.lineWidth = 2; R.rr(ctx, x + 3.5, y + 3.5, CELL - 7, CELL - 7, 4); ctx.stroke(); }
      }
    }
    // wires — insulated cables with a lit core + flowing energy
    G.score.wires.forEach(function (w) {
      var a = cellCenter(w[0], w[1]), b = cellCenter(w[2], w[3]);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1c140d"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = "#5c4636"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = "rgba(126,240,255,.25)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    var flowSpd = G.run ? 2.4 : 0.9;
    G.score.wires.forEach(function (w, wi) {
      var a = cellCenter(w[0], w[1]), b = cellCenter(w[2], w[3]);
      for (var pu = 0; pu < 2; pu++) {
        var frac = (t * flowSpd + wi * 0.31 + pu * 0.5) % 1;
        var px2 = a.x + (b.x - a.x) * frac, py = a.y + (b.y - a.y) * frac;
        ctx.save(); ctx.globalAlpha = 0.5; R.circle(ctx, px2, py, 3, "#7ef0ff"); ctx.globalAlpha = 1; R.circle(ctx, px2, py, 1.4, "#eafcff"); ctx.restore();
      }
    });
    // gears (with place/score bounce)
    var blink = (G.blinkT % 3.2) < 0.12;
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
      var cl = G.board[r2][c2]; if (!cl.gid) continue;
      var ctr = cellCenter(c2, r2), gd = GEARS[cl.gid], conn = G.score.connected.has(c2 + "," + r2);
      var rad = CELL * 0.35 * (1 + 0.4 * (cl.pop || 0));
      R.gear(ctx, ctr.x, ctr.y, rad, gd, cl.angle, { glow: conn, glowColor: cl.gid === "core" ? "#ffcf4d" : (gd.fam && D.TYPES[gd.fam] ? D.TYPES[gd.fam].color : "#5df0ff"), graphicTint: cl.graphic ? GRAPHICS[cl.graphic].tint : null, t: G.blinkT, blink: blink && conn });
      if (!conn) { ctx.save(); ctx.globalAlpha = 0.42; R.circle(ctx, ctr.x, ctr.y, CELL * 0.37, "#100d1c"); ctx.restore(); }
    }
    // inspector content
    renderInspector(t);
    // console lines
    renderConsole();
    // pops
    ctx.save(); ctx.textAlign = "center";
    G.pops.forEach(function (p) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life)); ctx.font = "bold " + p.size + "px 'Courier New',monospace"; ctx.fillStyle = "#000"; ctx.fillText(p.txt, p.x + 1, p.y + 1); ctx.fillStyle = p.color; ctx.fillText(p.txt, p.x, p.y); });
    ctx.restore(); ctx.textAlign = "left";

    ctx.restore(); // end shake
  }

  function renderInspector(t) {
    var p = L.inspector, cx = p.x + p.w / 2;
    ctx.textAlign = "center"; ctx.fillStyle = "#9a93b8"; ctx.font = "8px 'Courier New',monospace";
    ctx.fillText("PROJECTED HYPE", cx, p.y + 30);
    var hype = G.run ? G.run.chips * G.run.mult | 0 : G.score.hype;
    ctx.fillStyle = hype >= G.goal ? "#8ee65a" : "#ff8a3d"; ctx.font = "22px 'Courier New',monospace";
    ctx.fillText(String(hype), cx, p.y + 54); ctx.fillStyle = "#9a93b8"; ctx.font = "8px 'Courier New',monospace";
    ctx.fillText("GOAL " + G.goal, cx, p.y + 68);
    // gauge
    var gx = cx - 9, gy = p.y + 78, gw = 18, gh = p.h - 150;
    R.px(ctx, gx - 2, gy - 2, gw + 4, gh + 4, "#000"); R.px(ctx, gx, gy, gw, gh, "#1c1830");
    var frac = Math.max(0, Math.min(1, G.goal ? hype / G.goal : 0)), fh = gh * frac;
    var col = frac >= 1 ? "#8ee65a" : (frac > 0.6 ? "#ffd24d" : (frac > 0.3 ? "#ff8a3d" : "#ff5d7a"));
    R.px(ctx, gx, gy + gh - fh, gw, fh, col);
    ctx.strokeStyle = "#8ee65a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx - 3, gy); ctx.lineTo(gx + gw + 3, gy); ctx.stroke();
    // active combos (Balatro-style hands) preview
    var combos = G.score.combos || [];
    ctx.textAlign = "left"; ctx.font = "7px 'Courier New',monospace";
    if (combos.length) { ctx.fillStyle = "#9a93b8"; ctx.fillText("COMBOS", p.x + 6, gy + 4); }
    combos.slice(0, 7).forEach(function (cm, i) { ctx.fillStyle = "#ffd24d"; ctx.fillText("★" + cm.name, p.x + 6, gy + 15 + i * 10); });
    ctx.textAlign = "center";
    // sitting dev reacting
    var mood = hype >= G.goal ? "cheer" : "sit";
    R.playerSprite(ctx, mood, cx, p.y + p.h - 8, 52, false, t, mood === "cheer" ? "happy" : "");
    ctx.fillStyle = "#5df0ff"; ctx.font = "8px 'Courier New',monospace"; ctx.fillText("gears " + Math.max(0, G.score.connCount - 1), cx, p.y + p.h - 2);
    ctx.textAlign = "left";
  }

  function renderConsole() {
    var p = L.console; ctx.save(); R.rr(ctx, p.x + 2, p.y + 18, p.w - 4, p.h - 20, 2); ctx.clip();
    ctx.font = "8px 'Courier New',monospace"; ctx.textBaseline = "alphabetic";
    var lines = G.log.slice(-4);
    lines.forEach(function (ln, i) { ctx.fillStyle = ln[0] === "!" ? "#ff8a3d" : "#8ee6a0"; ctx.fillText(ln, p.x + 8, p.y + 30 + i * 9); });
    ctx.restore();
  }

  // =========================================================
  //  HUD / TRAY
  // =========================================================
  function updateHUD() {
    els.day.textContent = (G.day + 1) + "/" + DAYS.length;
    els.goal.textContent = G.goal;
    els.clock.textContent = fmtClock(G.clock);
    els.clockWrap.classList.toggle("danger", G.state === "build" && G.clock <= 15);
    els.energy.textContent = G.energy;
    els.hype.textContent = G.run ? (G.run.chips * G.run.mult | 0) : G.score.hype;
    els.hype.style.color = els.hype.textContent >= G.goal ? "#8ee65a" : "#ff8a3d";
    els.barEnergy.style.width = clampPct(G.energy / G.maxEnergy) + "%";
    els.chipsOut.textContent = G.run ? G.run.chips : G.score.chips;
    els.multOut.textContent = fmtMult(G.run ? G.run.mult : G.score.mult);
  }
  function clampPct(f) { return Math.max(0, Math.min(1, f)) * 100; }

  function renderTray() {
    els.hand.innerHTML = "";
    var invG = G.inventory.gears, invA = G.inventory.graphics;
    Object.keys(invG).forEach(function (id) { card(id, "gear", G.dayGears[id] || 0); });
    Object.keys(invA).forEach(function (id) { card(id, "graphic", G.dayGraphics[id] || 0); });

    function card(id, kind, remaining) {
      var def = kind === "gear" ? GEARS[id] : GRAPHICS[id];
      var div = document.createElement("div");
      div.className = "card" + (kind === "graphic" ? " graphic" : "");
      if (remaining <= 0) div.className += " unaffordable";
      if (G.jammedType === id) div.className += " jammed";
      var sel = G.cursor && ((G.cursor.mode === "place" && kind === "gear" && G.cursor.id === id) || (G.cursor.mode === "graphic" && kind === "graphic" && G.cursor.id === id));
      if (sel) div.className += " selected";
      var cv = document.createElement("canvas"); cv.width = 40; cv.height = 40;
      if (kind === "gear") R.gearThumb(cv, def); else R.graphicThumb(cv, def);
      div.appendChild(cv);
      if (kind === "gear" && def.fam && D.TYPES[def.fam]) div.style.borderTopColor = D.TYPES[def.fam].color;
      var nm = document.createElement("div"); nm.className = "c-name"; nm.textContent = def.name; div.appendChild(nm);
      var st = document.createElement("div"); st.className = "c-stat"; st.textContent = statLine(id, kind); div.appendChild(st);
      var cost = document.createElement("div"); cost.className = "c-cost"; cost.textContent = "⚡" + def.energy + "  ×" + remaining; div.appendChild(cost);
      div.addEventListener("click", function () { onPaletteClick({ kind: kind, id: id }); });
      div.addEventListener("pointerenter", function (e) { showCardTip(id, kind, e.clientX, e.clientY); });
      div.addEventListener("pointerleave", hideTooltip);
      els.hand.appendChild(div);
    }
  }

  function statLine(id, kind) {
    var d = kind === "gear" ? GEARS[id] : GRAPHICS[id], s = [];
    if (kind === "gear" && d.type === "xmult") s.push("×" + d.xmult);
    if (d.chips) s.push("+" + d.chips + "c"); if (d.mult) s.push("+" + d.mult + "m");
    if (!s.length) return "★ trait";
    return s.join(" ");
  }

  // =========================================================
  //  HINTS / TOASTS / TOOLTIPS / TUTORIAL
  // =========================================================
  function updateHint() {
    var s = G.state, msg = null;
    if (s === "room") msg = "🚶 Walk to the computer (click it) to start working.";
    else if (s === "build") {
      var cur = G.cursor;
      if (!cur) msg = "Click a card below, then a slot by the CORE. ▶ RUN to compile.";
      else if (cur.mode === "place") msg = "Placing " + GEARS[cur.id].name + " — click an empty slot touching the machine.";
      else if (cur.mode === "graphic") msg = "Painting " + GRAPHICS[cur.id].name + " — click a gear.";
      else if (cur.mode === "move") msg = "Moving a gear — click an empty slot (Esc returns it).";
    }
    if (msg) { els.status.textContent = msg; els.status.classList.remove("hidden"); els.status.style.color = "#9a93b8"; }
    else els.status.classList.add("hidden");
  }
  function toast(m) { clearTimeout(G.toastTimer); els.status.textContent = m; els.status.classList.remove("hidden"); els.status.style.color = "#ff5d8f"; G.toastTimer = setTimeout(updateHint, 1700); }

  function famTag(gd) {
    if (!gd.fam || !D.TYPES[gd.fam]) return "";
    var ty = D.TYPES[gd.fam];
    return '<div class="tt-fam" style="color:' + ty.color + '">◆ ' + ty.name + '</div>';
  }
  function traitTag(gd) { return (gd.trait && gd.trait.text) ? '<div class="tt-trait">★ ' + gd.trait.text + '</div>' : ""; }

  function showCardTip(id, kind, cx, cy) {
    var d = kind === "gear" ? GEARS[id] : GRAPHICS[id];
    var head, body;
    if (kind === "gear") {
      head = famTag(d);
      body = '<div class="tt-tag">' + statLine(id, kind) + '</div>' + traitTag(d);
    } else {
      head = "";
      body = '<div class="tt-tag">' + statLine(id, kind) + ' · same-style +' + D.ART_SYNERGY_MULT + ' mult</div>';
    }
    showTip('<div class="tt-name">' + d.name + '</div>' + head + body + '<div>' + d.blurb + '</div><div class="tt-cost">⚡' + d.energy + ' energy</div>', cx, cy);
  }
  function showGearTip(cell, cx, cy) {
    var gd = GEARS[cell.gid];
    var extra = cell.graphic ? '<div class="tt-tag">art: ' + GRAPHICS[cell.graphic].name + '</div>' : "";
    showTip('<div class="tt-name">' + gd.name + '</div>' + famTag(gd) + traitTag(gd) + extra + '<div>' + gd.blurb + '</div>' + (cell.gid === "core" ? "" : '<div class="tt-cost">click to move · Esc to return</div>'), cx, cy);
  }
  function showTip(html, cx, cy) {
    els.tooltip.innerHTML = html; els.tooltip.classList.remove("hidden");
    var sr = els.stage.getBoundingClientRect(), x = cx - sr.left + 14, y = cy - sr.top + 14;
    var tw = els.tooltip.offsetWidth, th = els.tooltip.offsetHeight;
    if (x + tw > sr.width) x = cx - sr.left - tw - 14; if (y + th > sr.height) y = cy - sr.top - th - 14;
    els.tooltip.style.left = Math.max(4, x) + "px"; els.tooltip.style.top = Math.max(4, y) + "px";
  }
  function hideTooltip() { els.tooltip.classList.add("hidden"); }

  // contextual tutorial (first run only)
  function tut(key) {
    if (!tutorialEnabled) return;
    var texts = {
      pack: "Rip open the pack, then pick ONE of the three cards. Rarer = stronger.",
      install: "Assets install in real time — that's the dev life. Hang tight…",
      build: "Click a gear below, then an empty slot next to the glowing CORE to wire it in. Only connected gears score! Watch the ⏳ clock, then hit ▶ RUN to compile."
    };
    if (key === "pick" || key === "installed" || key === "placed" || key === "ran") { dismissTut(); return; }
    if (!texts[key] || tutSeen[key]) return;
    tutSeen[key] = true;
    G.tutActive = (key === "build"); // freeze clock only for the build tip
    els.tut.innerHTML = '<div class="tut-box"><span>' + texts[key] + '</span><button id="tut-ok">Got it</button></div>';
    els.tut.classList.remove("hidden");
    document.getElementById("tut-ok").onclick = dismissTut;
  }
  function dismissTut() { els.tut.classList.add("hidden"); els.tut.innerHTML = ""; G.tutActive = false; }

  // =========================================================
  //  CHROME / OVERLAY / UTILS
  // =========================================================
  function applyChrome() {
    var s = G.state;
    els.hud.classList.toggle("hidden", s === "title" || s === "desktop");
    els.tray.classList.toggle("hidden", !(s === "build" || s === "run"));
    if (!(s === "room" || s === "build")) { els.status.classList.add("hidden"); }
    if (s !== "build") dismissTut();
  }
  function overlay(html) { els.overlay.innerHTML = html; els.overlay.classList.add("show"); }
  function hideOverlay() { els.overlay.classList.remove("show"); els.overlay.innerHTML = ""; }

  function fmtClock(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ":" + ("0" + (sec % 60)).slice(-2); }
  function fmtMult(m) { return Number.isInteger(m) ? String(m) : m.toFixed(1); }
  function clone(o) { var n = {}; for (var k in o) n[k] = o[k]; return n; }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  global.Game = G;
})(window);
