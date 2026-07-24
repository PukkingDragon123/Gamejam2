# ⌨️ Game Jam Simulator

A cozy, first-person pixel-art game about being a game dev: **type the code,
mash the red button to ship, and watch the players roll in.** Then spend them on
cookie-clicker-style upgrades and do it all faster.

![Game Jam Simulator](assets/screenshot.png)

## ▶ How to play

**No build step, no libraries.** Open `index.html` in a modern browser, or serve
the folder (recommended):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

### The loop
1. **Type the code** shown on the CRT. Follow the **glowing key** on the
   on-screen keyboard and type fast — the **clock is ticking**. Wrong keys flash
   red, so *don't fat-finger it*.
2. When the line's done, **MASH the big red button** (Space or click) to compile
   and **ship** your game.
3. Your game hits **itch.io** and its **player count ticks up over time**. Players
   are your currency.
4. Spend players in the **cookie-clicker upgrade panel** — Auto-Complete,
   Marketing, Viral Hit, Cold Brew — then make the next game even faster.

The whole thing is visual-first and cozy: first-person hands, a warm desk scene,
a ticking clock, screen glow, and a vignette. Minimal UI on purpose.

## 🎛 Controls
- **Type** the letters/symbols shown (or click keys on the on-screen keyboard).
- **Space** / click the red button to mash-ship.
- 🔊 toggles sound.

## 🖼️ Art / assets

All sprites live in `assets/` with baked-in transparent backgrounds:

| File | What it is |
|------|-----------|
| `desk.png` | First-person computer-desk scene (background). |
| `hands.png` | First-person hands sheet — **idle · press · typing** (3 frames). |
| `runbtn.png` | The red RUN button — **up · pressed** (2 frames). |
| `player.png`, `drinks.png`, `pack_*.png`, `room.gif` | Art from earlier builds, kept in the repo. |

Backgrounds are pre-removed in the files themselves (per-cell flood-fill /
green-screen keying), so they're clean even when opened from `file://`.

## 🛠 Tech / layout
Pure vanilla HTML5 Canvas + JavaScript, procedural where it counts (the
interactive keyboard, clock, code display, and upgrade icons are all drawn in
code) with Web Audio SFX.

```
index.html
css/style.css
js/
  audio.js    # WebAudio sound effects
  data.js     # snippets, upgrades, keyboard layout, config
  assets.js   # loads sprites (already transparent) + slices sheets
  render.js   # desk scene, monitor code, keyboard, hands, button, icons
  game.js     # typing → mash → ship → itch idle + upgrades
```

Tuning (snippets, upgrade costs/effects, mash difficulty, clock feel) lives in
`js/data.js`.

---

Made for fun. Type fast, ship faster. 💜
