# 🎮 Game Jam Simulator

A silly 2D pixel-art simulator about surviving a 7-day game jam. Open **booster
packs** for game mechanics, wire **gears** to the glowing **CORE**, slap on
**art styles**, and beat a stressful **countdown** to hit your **HYPE** goal —
then pick a questionable **energy drink** each night and do it all again.

A little bit *Balatro*, a little bit *coffee-fuelled crunch*, styled like a
cursed game-dev IDE.

![Game Jam Simulator](assets/screenshot.png)

## ▶ How to play

**No build step, no libraries.** Open `index.html` in a modern browser, or serve
the folder (recommended, so image keying works):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

### The loop, each day
1. **Walk to your computer** (click it) to start the work session.
2. **Open a booster pack** → pick **1 of 3** cards → wait for it to **install**.
   Your collection grows across the jam.
3. In the **IDE**, click a gear in the **Asset Browser**, then an empty slot next
   to the **CORE** to wire it in. Only gears **connected to the CORE** spin and
   score. Paint gears with **art styles** for bonus points.
4. The **countdown** is ticking. Hit **▶ RUN** to compile: your gears spin up and
   rain **HYPE**. Beat the day's goal or you're out.
5. At night, **pick an energy drink** — each refuels you but comes with a debuff.

Reach **SUBMISSION DAY** and you win the jam. 🏆

## 🧮 Scoring — `HYPE = chips × mult`
- **chips** (blue) + **mult** (pink) come from connected gears & art styles.
- Two **touching, connected gears with the same art style** grant a big mult
  bonus — consistent art direction pays off.
- Coding drains **⚡ energy**; hit zero mid-code and you **pass out**.

## 🖼️ Using your own pixel art (`/assets`)

The game ships with procedural fallback art, but it will **automatically use real
pixel-art files** if you drop them in `assets/`. Missing files just fall back —
so you can add them one at a time.

| File | What it is | Notes |
|------|-----------|-------|
| `assets/room.png` | Room background | Any 16:9 image. The computer/desk should sit on the **left** (see `CONFIG.room` in `js/data.js` to re-map the computer zone & walkable floor). |
| `assets/player.png` | Player sprite sheet | **4 columns × 2 rows** grid. Frame order: `walkA, walkB, sit, back, drink, tired, cheer`. Ideally transparent (or a flat solid background that keys cleanly). |
| `assets/drinks.png` | 5 drink sprites in a row | **Green-screen** background (auto-keyed out). Order: `cola, monster, beer, orange-juice, water`. |
| `assets/pack_gears.png` | Mechanics booster pack | Single sprite. Flat/solid background keys out. |
| `assets/pack_graphics.png` | Art booster pack | Single sprite. |

Frame layout and the room's interactive zones are all configurable in
`js/data.js` (`CONFIG.room`, `CONFIG.playerSheet`, `CONFIG.playerFrames`) — tweak
those numbers to match your exact sheets.

> **Tip:** green-screen keying and sheet slicing read pixels back from the
> canvas, which some browsers block for `file://` images. If your drink
> green-screen doesn't key out, **serve over http** (the command above, or the
> hosted link) and it works.

## 🎛 Controls
- **Room:** click to walk; click the computer (or press `E`) to work.
- **IDE:** click a card, click the board to place/apply. Click a placed gear to
  pick it up and move it; `Esc` returns it. `Enter` = RUN. 🔊 toggles sound.

## 🛠 Tech / layout
Pure vanilla HTML5 Canvas + JavaScript. Procedural pixel art + Web Audio SFX,
with an asset pipeline that overlays real uploaded art when present.

```
index.html
css/style.css
js/
  audio.js    # WebAudio sound effects
  data.js     # gears, art, drinks, days, packs, room/player config (all tuning)
  assets.js   # loads /assets art: green-screen keying + sheet slicing + fallback
  render.js   # procedural + asset-aware pixel-art renderer
  game.js     # phase state machine, scoring, packs, countdown, run, drinks, tutorial
```

---

Made for fun. Crunch responsibly. 💜
