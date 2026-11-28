import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const readmePath = resolve(process.argv[2] ?? resolve(import.meta.dirname, "..", "README.md"));
// Relative to the README: it is both where the SVG is written and the image src.
const SVG_PATH = "card/stats.svg";

const PX = 3;
const COLS = 280;
const SECTION_GAP = 4;

const PALETTE = {
  panel: "#1a1c2c",
  deep: "#0e0f1a",
  border: "#566c86",
  dim: "#94b0c2",
  text: "#f4f4f4",
  gold: "#ffcd75",
};

// Keyed by language name exactly as the stats-card block spells it; wins over the colour given there.
const COLOR_OVERRIDES = {
  Python: "#73eff7",
  Other: PALETTE.dim,
};

// Every row of a glyph must have the same length; that length is its width in cells.
const FONT = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["111", "010", "010", "010", "010", "010", "111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "10001", "01010", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "%": ["11000", "11001", "00010", "00100", "01000", "10011", "00011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00000", "00001", "00010", "00100", "01000", "10000", "00000"],
  ".": ["0", "0", "0", "0", "0", "0", "1"],
  ":": ["0", "0", "1", "0", "0", "1", "0"],
  "'": ["1", "1", "0", "0", "0", "0", "0"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};
const GLYPH_H = 7;

function glyph(ch) {
  const g = FONT[ch.toUpperCase()];
  if (!g) throw new Error(`No glyph for ${JSON.stringify(ch)}; add it to FONT in generate.mjs`);
  return g;
}

const advance = (ch) => glyph(ch)[0].length + 1;
const textWidth = (str) => [...str].reduce((w, ch) => w + advance(ch), -1);

// grid[y][x] is the cell's colour; rows and cells are sparse.
const grid = [];
function setCell(x, y, color) {
  if (x < 0 || x >= COLS || y < 0) throw new Error(`Cell out of bounds: ${x},${y}`);
  (grid[y] ??= [])[x] = color;
}
function fillCells(x, y, w, h, color) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setCell(x + i, y + j, color);
}
function drawText(str, x, y, color) {
  let cx = x;
  for (const ch of str) {
    glyph(ch).forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit === "1") setCell(cx + rx, y + ry, color);
      });
    });
    cx += advance(ch);
  }
}

function mix(hex, target, amount) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(target.slice(1), 16);
  const ch = (v, s) => (v >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * amount));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function allocateBlocks(langs, total) {
  if (langs.length > total) throw new Error("More languages than bar blocks");
  const sum = langs.reduce((s, l) => s + l.percent, 0);
  const ideal = langs.map((l) => (l.percent / sum) * total);
  const blocks = ideal.map((v) => Math.max(1, Math.floor(v)));
  let used = blocks.reduce((a, b) => a + b, 0);
  while (used < total) {
    let best = 0;
    ideal.forEach((v, i) => {
      if (v - blocks[i] > ideal[best] - blocks[best]) best = i;
    });
    blocks[best]++;
    used++;
  }
  while (used > total) {
    let worst = -1;
    ideal.forEach((v, i) => {
      if (blocks[i] > 1 && (worst < 0 || v - blocks[i] < ideal[worst] - blocks[worst])) worst = i;
    });
    blocks[worst]--;
    used--;
  }
  return blocks;
}

const readme = readFileSync(readmePath, "utf8");
const block = readme.match(/<!--\s*stats-card\s*\n([\s\S]*?)-->/);
if (!block) throw new Error(`No <!-- stats-card --> block in ${readmePath}`);
if (block[1].includes("{{")) throw new Error("Unreplaced placeholder in the stats-card block");
const stats = [];
const langs = [];
for (const line of block[1].split("\n").map((l) => l.trim()).filter(Boolean)) {
  const [kind, ...f] = line.split("|").map((s) => s.trim());
  if (kind === "stat" && f.length === 2 && f[0] && /^\d+$/.test(f[1])) {
    stats.push({ label: f[0], value: f[1] });
  } else if (kind === "lang" && f.length === 3 && f[0] && /^\d+(\.\d+)?$/.test(f[1]) && /^#[0-9a-f]{6}$/i.test(f[2])) {
    langs.push({ name: f[0], percent: Number(f[1]), color: COLOR_OVERRIDES[f[0]] ?? f[2] });
  } else {
    throw new Error(`Bad stats-card line: "${line}"`);
  }
}
if (!stats.length || stats.length > 6) throw new Error("Expected 1 to 6 stats");
if (!langs.length || langs.length > 8) throw new Error("Expected 1 to 8 languages");

const INSET = 2;
const PAD_X = 6;
const PAD_TOP = 4;
const PAD_BOTTOM = 4;

const BLOCK_W = 3;
const BLOCK_GAP = 1;
const BLOCK_H = 5;
const BAR_CHROME = 2;
const avail = COLS - 2 * (INSET + PAD_X);
const blockCount = Math.floor((avail - 2 * BAR_CHROME + BLOCK_GAP) / (BLOCK_W + BLOCK_GAP));
const blockRun = blockCount * (BLOCK_W + BLOCK_GAP) - BLOCK_GAP;
const contentW = blockRun + 2 * BAR_CHROME;
const x0 = Math.floor((COLS - contentW) / 2);

let y = INSET + PAD_TOP;

const STAT_ROW_GAP = 4;
const LEADER_PAD = 3;
const LEADER_STEP = 3;
stats.forEach(({ label, value }, i) => {
  const ry = y + i * (GLYPH_H + STAT_ROW_GAP);
  const labelEnd = x0 + textWidth(label);
  const valueX = x0 + contentW - textWidth(value);
  if (labelEnd + 2 * LEADER_PAD + LEADER_STEP > valueX) throw new Error(`Stat row too wide: "${label}"`);
  drawText(label, x0, ry, PALETTE.dim);
  drawText(value, valueX, ry, PALETTE.gold);
  for (let dx = Math.ceil((labelEnd + LEADER_PAD) / LEADER_STEP) * LEADER_STEP; dx < valueX - LEADER_PAD; dx += LEADER_STEP) {
    setCell(dx, ry + GLYPH_H - 1, PALETTE.border);
  }
});
y += stats.length * (GLYPH_H + STAT_ROW_GAP) - STAT_ROW_GAP + SECTION_GAP + 1;

const barH = BLOCK_H + 2 * BAR_CHROME;
fillCells(x0, y, contentW, barH, PALETTE.border);
fillCells(x0 + 1, y + 1, contentW - 2, barH - 2, PALETTE.deep);
const blocks = allocateBlocks(langs, blockCount);
let bx = x0 + BAR_CHROME;
const by = y + BAR_CHROME;
langs.forEach((lang, i) => {
  const light = mix(lang.color, "#ffffff", 0.35);
  const dark = mix(lang.color, "#000000", 0.35);
  for (let b = 0; b < blocks[i]; b++) {
    fillCells(bx, by, BLOCK_W, BLOCK_H, lang.color);
    fillCells(bx, by, BLOCK_W, 1, light);
    fillCells(bx, by + BLOCK_H - 1, BLOCK_W, 1, dark);
    bx += BLOCK_W + BLOCK_GAP;
  }
});
y += barH + SECTION_GAP;

const SWATCH = 5;
const SWATCH_GAP = 3;
const NAME_PCT_GAP = 4;
const LEGEND_MIN_GAP = 8;
const LEGEND_ROW_GAP = 4;
const entries = langs.map(({ name, percent, color }) => {
  const pct = `${percent}%`;
  const nameX = SWATCH + SWATCH_GAP;
  const pctX = nameX + textWidth(name) + NAME_PCT_GAP;
  return { color, name, pct, nameX, pctX, w: pctX + textWidth(pct) };
});
const legendWidths = (c) =>
  Array.from({ length: c }, (_, j) => Math.max(...entries.filter((_, i) => i % c === j).map((e) => e.w)));
const legendFits = (c) => legendWidths(c).reduce((a, b) => a + b, 0) + (c - 1) * LEGEND_MIN_GAP <= contentW;
let maxFit = entries.length;
while (maxFit > 1 && !legendFits(maxFit)) maxFit--;
const evenCols = Math.ceil(entries.length / Math.ceil(entries.length / maxFit));
const legendCols = legendFits(evenCols) ? evenCols : maxFit;
const legendColW = legendWidths(legendCols);
if (legendColW[0] > contentW) throw new Error("A legend entry is wider than the card");
const legendSpare = contentW - legendColW.reduce((a, b) => a + b, 0);
const legendGap = legendCols > 1 ? Math.floor(legendSpare / (legendCols - 1)) : 0;
const legendColX = [];
for (let j = 0, cx = x0; j < legendCols; j++) {
  legendColX.push(j === legendCols - 1 && legendCols > 1 ? x0 + contentW - legendColW[j] : cx);
  cx += legendColW[j] + legendGap;
}
const legendRows = Math.ceil(entries.length / legendCols);
entries.forEach((e, i) => {
  const ex = legendColX[i % legendCols];
  const ey = y + Math.floor(i / legendCols) * (GLYPH_H + LEGEND_ROW_GAP);
  fillCells(ex, ey + 1, SWATCH, SWATCH, e.color);
  drawText(e.name, ex + e.nameX, ey, PALETTE.dim);
  drawText(e.pct, ex + e.pctX, ey, PALETTE.text);
});
y += legendRows * (GLYPH_H + LEGEND_ROW_GAP) - LEGEND_ROW_GAP;

const ROWS = y + PAD_BOTTOM + INSET;

// Merges horizontal runs of one colour, then stacks identical runs on consecutive rows.
function runsToRects() {
  const byColor = new Map();
  let open = new Map();
  for (let ry = 0; ry < grid.length; ry++) {
    const row = grid[ry] ?? [];
    const nextOpen = new Map();
    for (let x = 0; x < COLS; ) {
      const color = row[x];
      if (!color) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === color) w++;
      const key = `${color}|${x}|${w}`;
      let r = open.get(key);
      if (r) {
        r.h++;
      } else {
        r = { x, y: ry, w, h: 1 };
        if (!byColor.has(color)) byColor.set(color, []);
        byColor.get(color).push(r);
      }
      nextOpen.set(key, r);
      x += w;
    }
    open = nextOpen;
  }
  return byColor;
}

const rect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;

// Each move is relative to the previous rect's origin, which is where "z" leaves the pen.
function rectsPath(rects) {
  let px = 0;
  let py = 0;
  return rects
    .map(({ x, y, w, h }) => {
      const d = `m${x - px} ${y - py}h${w}v${h}h${-w}z`;
      px = x;
      py = y;
      return d;
    })
    .join("");
}

const W = COLS * PX;
const H = ROWS * PX;
const spoken = stats.map((s) => `${s.value} ${s.label}`).join(", ");
const langSpoken = langs.map((l) => `${l.name} ${l.percent}%`).join(", ");
const aria = `GitHub stats: ${spoken}. Top languages: ${langSpoken}.`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const svg =
  [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${COLS} ${ROWS}" shape-rendering="crispEdges" role="img" aria-label="${esc(aria)}">`,
    `<title>${esc(aria)}</title>`,
    `<g fill="${PALETTE.panel}">${rect(1, 0, COLS - 2, ROWS)}${rect(0, 1, COLS, ROWS - 2)}</g>`,
    `<g fill="${PALETTE.border}">` +
      rect(2, 1, COLS - 4, 1) +
      rect(2, ROWS - 2, COLS - 4, 1) +
      rect(1, 2, 1, ROWS - 4) +
      rect(COLS - 2, 2, 1, ROWS - 4) +
      `</g>`,
    ...[...runsToRects()].map(([color, rects]) => `<path fill="${color}" d="${rectsPath(rects)}"/>`),
    `</svg>`,
  ].join("\n") + "\n";
const svgPath = resolve(dirname(readmePath), SVG_PATH);
const img = `<img src="${SVG_PATH}" alt="${esc(aria)}">`;
mkdirSync(dirname(svgPath), { recursive: true });
writeFileSync(svgPath, svg);
writeFileSync(readmePath, readme.replace(block[0], () => img));
console.log(`${svgPath}: ${W}x${H}, ${Buffer.byteLength(svg)} bytes, blocks ${blocks.join("+")}=${blockCount}, legend ${legendCols} cols`);
