# /assets — drop your pixel art here

The game auto-loads these files if present, and falls back to built-in
procedural art for any that are missing. **Filenames must match exactly**
(all lowercase).

| Filename | What it is | Requirements |
|----------|-----------|--------------|
| `room.png` | The room background | Any 16:9 image (e.g. 1920×1080). The desk/computer should be on the **left** side. |
| `player.png` | Player sprite sheet | A **4-column × 2-row** grid (8 cells). Frame order, left→right, top row then bottom row: **walkA, walkB, sit, back, drink, tired, cheer**, (8th cell unused). Even margins around each cell. Transparent background is best; a flat solid background also works (it gets keyed out). |
| `drinks.png` | 5 drinks in one row | On a **bright green screen** background (auto-removed). Order left→right: **cola, monster, beer, orange-juice, water**. |
| `pack_gears.png` | Mechanics booster pack | Single sprite, flat/solid background (keyed out). |
| `pack_graphics.png` | Art/graphics booster pack | Single sprite, flat/solid background (keyed out). |

## Notes
- Grid layout, the room's computer zone, and the walkable floor are all
  configurable in `js/data.js` (`CONFIG.room`, `CONFIG.playerSheet`,
  `CONFIG.playerFrames`) — I'll fine-tune these to match your exact sheets
  once the files are here.
- Green-screen keying and sheet slicing read pixels back from the canvas,
  which browsers block for `file://` images. **Serve over http** (or use the
  hosted link) so keying works — see the top-level README.
