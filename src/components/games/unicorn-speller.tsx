"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Heart, RotateCcw, Sparkles, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

const CANVAS_W = 960;
const CANVAS_H = 540;
const PIXEL = 4; // logical pixel size (chunky NES feel)

const GROUND_Y = 420;

// NES-ish limited palette
const PAL = {
  sky1: "#5c94fc",
  sky2: "#a4e0fc",
  night: "#0c0c54",
  grass: "#00a800",
  grassDark: "#007800",
  dirt: "#9c5c00",
  dirtDark: "#5c3000",
  stone: "#7c7c7c",
  stoneDark: "#404040",
  snow: "#fcfcfc",
  white: "#fcfcfc",
  black: "#0c0c0c",
  cream: "#fcd8a8",
  yellow: "#fce03c",
  orange: "#fc7c00",
  red: "#dc0000",
  pink: "#fcb4d4",
  hotPink: "#fc3c8c",
  magenta: "#b400a4",
  purple: "#7800fc",
  cyan: "#3cbcfc",
  blue: "#0040b8",
  green: "#00b800",
  greenDark: "#007800",
  brown: "#a86c00",
  brick: "#a83c14",
  textShadow: "#202060",
} as const;

type Phase = "title" | "playing" | "boss" | "won" | "lost" | "level-clear";

type WordObject = {
  id: number;
  word: string;
  typed: string;
  x: number;
  y: number;
  baseY: number;
  bob: number;
  spriteKey: SpriteKey;
  /** how far it has drifted from the right edge */
  done: boolean;
};

type Snowball = {
  id: number;
  word: string;
  typed: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  done: boolean;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

type LevelDef = {
  name: string;
  theme: "meadow" | "forest" | "mountain" | "castle" | "jungle";
  words: { word: string; sprite: SpriteKey }[];
  needed: number;
  spawnMs: number;
  driftSpeed: number;
};

// ---------- Sprite system ----------
// Sprites are arrays of strings; each char maps to a colour key.
// `.` = transparent. Each "pixel" is rendered as PIXEL px on the canvas.

type SpriteKey =
  | "cat"
  | "dog"
  | "sun"
  | "hat"
  | "bee"
  | "fish"
  | "tree"
  | "frog"
  | "star"
  | "bird"
  | "apple"
  | "house"
  | "snake"
  | "crown"
  | "sword"
  | "dragon"
  | "castle"
  | "rocket"
  | "flower"
  | "banana"
  | "monkey"
  | "rabbit"
  | "snowball"
  | "heart"
  | "puppyBoss"
  | "pig"
  | "owl"
  | "fox"
  | "cow"
  | "cup"
  | "cake"
  | "drum"
  | "book"
  | "moon"
  | "cloud"
  | "ghost"
  | "gem"
  | "fire"
  | "robot"
  | "mushroom"
  | "key"
  | "ant"
  | "egg"
  | "bone"
  | "leaf"
  | "boat"
  | "ball"
  | "ring"
  | "kite"
  | "duck"
  | "bear";

const C: Record<string, string> = {
  ".": "transparent",
  "0": PAL.black,
  W: PAL.white,
  Y: PAL.yellow,
  O: PAL.orange,
  R: PAL.red,
  P: PAL.pink,
  H: PAL.hotPink,
  M: PAL.magenta,
  U: PAL.purple,
  C: PAL.cyan,
  B: PAL.blue,
  G: PAL.green,
  g: PAL.greenDark,
  N: PAL.brown,
  K: PAL.brick,
  S: PAL.stone,
  s: PAL.stoneDark,
  D: PAL.dirt,
  d: PAL.dirtDark,
  E: PAL.cream,
};

const SPRITES: Record<SpriteKey, string[]> = {
  cat: [
    "................",
    "................",
    ".0..0...0..0....",
    ".00.00.00.00....",
    ".0EEE0E0EEE0....",
    ".0EEEEEEEEE0....",
    ".0E0EEEEE0E0....",
    ".0EEE0E0EEE0....",
    ".0EE000000E0....",
    "..0EEEEEEE0.....",
    "...00000000.....",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  dog: [
    "................",
    "................",
    "..0000....0000..",
    ".0NNN0...0NNN0..",
    ".0NNNN000NNNN0..",
    ".0NNNNNNNNNNN0..",
    ".0NW0NNNNN0WN0..",
    ".0NW0NN0NN0WN0..",
    ".0NNNN000NNNN0..",
    ".0NNN0R0R0NNN0..",
    "..0NNNNNNNNN0...",
    "...000000000....",
    "................",
    "................",
    "................",
    "................",
  ],
  sun: [
    "................",
    ".....Y....Y.....",
    "......Y..Y......",
    "...YYY0YY0YYY...",
    "....YYY0YY0Y....",
    "...YY0YYYY0YY...",
    "..YYYYYY0YYYYY..",
    "Y.YY0YYYYYY0YY.Y",
    "Y.YYYYYY0YYYYY.Y",
    "..YYY0YYYY0YYY..",
    "...YY0YYYY0YY...",
    "....Y0YY0YYY....",
    "...YYY0YY0YYY...",
    "......Y..Y......",
    ".....Y....Y.....",
    "................",
  ],
  hat: [
    "................",
    "................",
    "...000000000....",
    "..0UUUUUUUUU0...",
    "..0UUYYYYYUU0...",
    "..0UYYHHHYYU0...",
    "..0UYYYYYYYU0...",
    ".000UUUUUUU000..",
    "0NNNNNNNNNNNNN0.",
    "0NNNNNNNNNNNNN0.",
    ".0000000000000..",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  bee: [
    "................",
    "................",
    "...00.....00....",
    "..0WW0...0WW0...",
    "..0WW000.0WW0...",
    "...0WWW00WW0....",
    "...0YYY00YY0....",
    "..0YY00YY00YY0..",
    ".0YYYY00YYYYY0..",
    ".0YY00YYYY00Y0..",
    ".0YYYY00YYYYY0..",
    ".0YY00YY00YYY0..",
    "..0YYYYYYYYY0...",
    "...000000000....",
    "................",
    "................",
  ],
  fish: [
    "................",
    "................",
    "................",
    "....00..........",
    "..00CC00........",
    ".0CCCCCC000.....",
    "0CCCC0CCCCC0....",
    "0CCCCCCCCCC00...",
    "0CCCCCCCCCCC0...",
    "0CCCCCCCCCC00...",
    "0CCCC0CCCCC0....",
    ".0CCCCCC000.....",
    "..00CC00........",
    "....00..........",
    "................",
    "................",
  ],
  tree: [
    "................",
    ".....00000......",
    "....0GGGGG0.....",
    "...0GGGgGGG0....",
    "..0GGGGGGGgG0...",
    "..0GgGGGGGGG0...",
    "..0GGGGGgGGG0...",
    "...0GGGGGGG0....",
    "....00NNN00.....",
    ".....0NNN0......",
    ".....0NNN0......",
    "....0NNNNN0.....",
    "...0NNNNNNN0....",
    "..0000000000....",
    "................",
    "................",
  ],
  frog: [
    "................",
    "................",
    "....00....00....",
    "...0WW0..0WW0...",
    "...0W00..0W00...",
    "..00GG0000GG00..",
    ".0GGGGGGGGGGGG0.",
    ".0GGGGGGGGGGGG0.",
    ".0gGGGGGGGGGGg0.",
    "..0GGGGGGGGGG0..",
    "...0GGGGGGGG0...",
    "....00000000....",
    "...0g0....0g0...",
    "..0g0......0g0..",
    "................",
    "................",
  ],
  star: [
    "................",
    "................",
    ".......00.......",
    "......0YY0......",
    "......0YY0......",
    "0000000YY0000000",
    "0YYYYYYYYYYYYYY0",
    ".0YYYYYYYYYYYY0.",
    "..0YYYYYYYYYY0..",
    "..0YYY0YYYY0YY0.",
    ".0YYY00YYYY00YY0",
    ".0Y00YY0YY0YYY0.",
    "00.....00....0..",
    "................",
    "................",
    "................",
  ],
  bird: [
    "................",
    "................",
    "................",
    "......00000.....",
    ".....0CCCCC0....",
    "....0CC0CCC0....",
    "..000CCCCCC0....",
    ".0CCCCCCCCC0....",
    ".0CCCCCCCCC00YY.",
    "..00CCCCCCCC0Y..",
    "....0CCCCCCC0...",
    ".....00YY00.....",
    ".....0YY00......",
    "................",
    "................",
    "................",
  ],
  apple: [
    "................",
    "................",
    "........0NN.....",
    ".......0GgN.....",
    ".......0GG......",
    "...0000000000...",
    "..0RRRR0RRRRR0..",
    ".0RRRRR0RRRRRR0.",
    ".0RRRRR0RRRRRR0.",
    ".0RRRRRRRRRRRR0.",
    ".0RRRRRRRRRRRR0.",
    ".0RRRRRRRRRRR0..",
    "..0RRRRRRRRR0...",
    "...0RRRRRRR0....",
    "....00RRR00.....",
    "......000.......",
  ],
  house: [
    "................",
    "................",
    "........0.......",
    ".......000......",
    "......00000.....",
    ".....0000000....",
    "....000RRR000...",
    "...00RRRRRRR00..",
    "..00RRRRRRRRR00.",
    ".0RRRRRRRRRRR0..",
    ".0KKKKK00KKKK0..",
    ".0KKKK0WW0KKK0..",
    ".0KKKK0WW0KKK0..",
    ".0KKKK0WW0KKK0..",
    ".0000000000000..",
    "................",
  ],
  snake: [
    "................",
    "................",
    "................",
    "..00000000......",
    ".0GGGGGGGG0.....",
    "0GG0gGGgG0G0....",
    "0GGGGGGgGGG0....",
    "0GGGGgGGGGG00...",
    "0GGGGGGGGgGGG0..",
    ".0gGGGGGGGGGG0..",
    "..00GGGGGGGGG0..",
    "....0GGGGGGGG0..",
    "....00GGGGGG0...",
    ".....0gGGGG0....",
    "......00000.....",
    "................",
  ],
  crown: [
    "................",
    "................",
    "................",
    "....0.....0.....",
    "...000...000....",
    "..00Y00.00Y00...",
    ".0YYYY0R0YYYY0..",
    ".0YYYYY0YYYYYY0.",
    ".0YYY0YYY0YYYY0.",
    ".0Y0YYRYYR0YYY0.",
    ".0YYYYYYYYYYYY0.",
    ".00000000000000.",
    "................",
    "................",
    "................",
    "................",
  ],
  sword: [
    "................",
    ".0..............",
    ".S0.............",
    ".SS0............",
    "..SS0...........",
    "...SS0..........",
    "....SS0.........",
    ".....SS0........",
    "......SS0.......",
    ".......SS0......",
    "........SS0.....",
    ".....0000Y00....",
    ".....0YYYYY0....",
    ".....00NN00.....",
    "......0NN0......",
    "......0000......",
  ],
  dragon: [
    "................",
    "...0000.........",
    "..0gGG0.........",
    "..0GGgG0........",
    ".0GG0GG0........",
    ".0G0RR0G00......",
    ".0GGGGGgGGG0....",
    "..0gGGGGGGGG0...",
    "...0GGGGGGGGG0..",
    "....0GGGGGGGG0..",
    "....0gGGGGGG0...",
    "....0RR0RR0R0...",
    "................",
    "................",
    "................",
    "................",
  ],
  castle: [
    "................",
    "0.0.0......0.0.0",
    "0S0S0SSSSSS0S0S0",
    "0SSSSSSSSSSSSSS0",
    "0SS0SSSSSSSS0SS0",
    "0SSSSSSSSSSSSSS0",
    "0SS00SS00SS00SS0",
    "0SS0WW00WW0SS0S0",
    "0SS0WW0KK0WW0SS0",
    "0SSSSSSKKSSSSSS0",
    "0SS0SSSKKSSSS0S0",
    "0SSSSSSKKSSSSSS0",
    "0SS0WWWWWWWW0SS0",
    "0SSSSSSSSSSSSSS0",
    "0SS0SSSSSSSS0SS0",
    "0SSSSSSSSSSSSSS0",
  ],
  rocket: [
    "................",
    "........0.......",
    ".......0W0......",
    "......0WWW0.....",
    "......0WRW0.....",
    "......0WWW0.....",
    ".....0WWCWW0....",
    ".....0WCCCW0....",
    ".....0WCWCW0....",
    ".....0WWWWW0....",
    "....0R0WWW0R0...",
    "....0RR0W0RR0...",
    ".....0R0Y0R0....",
    "......0YYY0.....",
    ".......0Y0......",
    "................",
  ],
  flower: [
    "................",
    "................",
    "....0H0..0H0....",
    "...0HHH00HHH0...",
    "..0HHHHHHHHHH0..",
    "..0HHHHYHHHHH0..",
    ".0HHHYYYYY0HHH0.",
    ".0HHHYYYYY0HHH0.",
    "..0HHHYYYHHHH0..",
    "..0HHHHHHHHHH0..",
    "...0HHH00HHH0...",
    "....00000G0.....",
    "........0G0.....",
    "........0G0.....",
    ".......0gGg0....",
    "................",
  ],
  banana: [
    "................",
    "................",
    ".............00.",
    "............0N0.",
    "...........0YY0.",
    "..........0YYY0.",
    ".........0YYYY0.",
    ".......00YYYY0..",
    ".....00YYYYYY0..",
    "...00YYYYYYYY0..",
    "..0YYYYYYYYY0...",
    "..0YYYYYYYY00...",
    "..0YYYYYY00.....",
    "..0NNN000.......",
    "..0000..........",
    "................",
  ],
  monkey: [
    "................",
    "................",
    "....000..000....",
    "...0NNN00NNN0...",
    "..0NNEEEEEENN0..",
    "..0NEEEEEEEEN0..",
    "..0NE0EEEE0EN0..",
    "..0NEEE00EEEN0..",
    "..0NEE0NN0EEN0..",
    "..0NEEEEEEEEN0..",
    "..00NEEEEEEN00..",
    "....0NNNNNN0....",
    "...0NNNNNNNN0...",
    "..0NN00..00NN0..",
    "..000......000..",
    "................",
  ],
  rabbit: [
    "................",
    "...00....00.....",
    "..0WW0..0WW0....",
    "..0WP0..0WP0....",
    "..0WP0..0WP0....",
    "..0WP0..0WP0....",
    "..0WWW00WWW0....",
    ".0WWWWWWWWWW0...",
    ".0WW0WWWW0WW0...",
    ".0WWWWWWWWWW0...",
    ".0WWPPPPPPWW0...",
    ".0WWWWWWWWWW0...",
    "..0WWWWWWWWW0...",
    "...000000000....",
    "................",
    "................",
  ],
  snowball: [
    "................",
    "................",
    "....00000000....",
    "...0WWWWWWWW0...",
    "..0WWCWWWWWWW0..",
    "..0WWCWWWWCWW0..",
    ".0WWWWWWWWWWWW0.",
    ".0WWWWWCWWWWWW0.",
    ".0WWCWWWWWWWWW0.",
    ".0WWWWWWWWWCWW0.",
    "..0WWWWWWWWWWW0.",
    "..0WWWWCWWWWW0..",
    "...0WWWWWWWW0...",
    "....00000000....",
    "................",
    "................",
  ],
  heart: [
    "................",
    "................",
    "..00....00......",
    ".0HH0..0HH0.....",
    "0HHHH00HHHH0....",
    "0HHHHHHHHHHH0...",
    "0HHHHHHHHHHH0...",
    "0HHHHHHHHHHH0...",
    ".0HHHHHHHHH0....",
    "..0HHHHHHH0.....",
    "...0HHHHH0......",
    "....0HHH0.......",
    ".....0H0........",
    "......0.........",
    "................",
    "................",
  ],
  puppyBoss: [
    "................",
    "..0000....0000..",
    ".0PPPP0..0PPPP0.",
    "0PPPPPP00PPPPPP0",
    "0PPPHPPPPPPPHP0.",
    "0PPHHPPPPPPHHPP0",
    "0PHHHHPPPPHHHHP0",
    "0PPHHHHHHHHHHP00",
    "0PPHWW00WW0HPPP0",
    "0PPHWO00WO0HPPP0",
    "0PPPHHHHHHHHPPP0",
    "0PPPH00HH00HPP0.",
    "0PPPHHRRRRHHPP0.",
    ".0PHHHHHHHHHHP0.",
    "..0PPPPPPPPPPP0.",
    "...00PP00PP00...",
  ],
  pig: [
    "................",
    "................",
    "..00........00..",
    ".0PP0......0PP0.",
    ".0PPP000000PPP0.",
    ".0PPPPPPPPPPPP0.",
    ".0PPP00PP00PPP0.",
    ".0PPHHPPPPHHPPP0",
    ".0PPHHPPPPHHPPP0",
    ".0PPPP0000PPPP0.",
    "..0PPPPPPPPPP0..",
    "...00000000000..",
    "................",
    "................",
    "................",
    "................",
  ],
  owl: [
    "................",
    "................",
    "..0000....0000..",
    ".0NNNN0..0NNNN0.",
    ".0NWNN0000NWNN0.",
    ".0NWWNN00NNWWN0.",
    ".0NWWWWWWWWWWN0.",
    ".0NW0WWWWWW0WN0.",
    ".0NW0NWWWWN0WN0.",
    ".0NWWNNYYNNWWN0.",
    ".0NWWWWWWWWWWN0.",
    ".0NNNNNNNNNNNN0.",
    "..0NN0NNNN0NN0..",
    "...0000000000...",
    "...0N0....0N0...",
    "................",
  ],
  fox: [
    "................",
    "................",
    "..00........00..",
    ".0OO0......0OO0.",
    ".0OW0......0WO0.",
    ".0OOO000000OOO0.",
    ".0OOWWWWWWWWOO0.",
    ".0OWW0WWWW0WWO0.",
    ".0OWWWWNNWWWWO0.",
    ".0OWWWWNNWWWWO0.",
    ".0OOWWWWWWWWOO0.",
    ".0OOOOOOOOOOO0..",
    "..000000000000..",
    "................",
    "................",
    "................",
  ],
  cow: [
    "................",
    "................",
    "..0000....0000..",
    ".0WWWW0..0WWWW0.",
    ".0WW00000000WW0.",
    ".0WWWW0000WWWW0.",
    ".0WW00WWWW00WW0.",
    ".0WW0PPWWPP0WW0.",
    ".0WW0PPWWPP0WW0.",
    ".0WWWW0000WWWW0.",
    "..0WWWWWWWWWW0..",
    "...0000PP0000...",
    "...0PP0PP0PP0...",
    "................",
    "................",
    "................",
  ],
  cup: [
    "................",
    "................",
    "...000000000....",
    "..0WWWWWWWWW0...",
    "..0WCCCCCCCW0...",
    "..0WCCCCCCCW0...",
    "..0WCCCCCCCW0000",
    "..0WCCCCCCCW000W",
    "..0WCCCCCCCW000W",
    "..0WCCCCCCCW0WW.",
    "..0WCCCCCCCW00..",
    "..0WWWWWWWWW0...",
    "...000000000....",
    "................",
    "................",
    "................",
  ],
  cake: [
    "................",
    "................",
    "....Y..Y..Y.....",
    "...0Y00Y00Y0....",
    "...0YY0YY0YY....",
    "..0RRRRRRRRRR0..",
    ".0WWWWWWWWWWWW0.",
    ".0WHHHHHHHHHHW0.",
    ".0WHHHHHHHHHHW0.",
    ".0WWWWWWWWWWWW0.",
    ".0YYYYYYYYYYYY0.",
    ".0YHHHHHHHHHHY0.",
    ".0YYYYYYYYYYYY0.",
    ".000000000000000",
    "................",
    "................",
  ],
  drum: [
    "................",
    "................",
    "................",
    "...0000000000...",
    "..0RRRRRRRRRR0..",
    ".0RR00RR00RR00R0",
    ".0R0RR00RR00RR0.",
    ".0RR00RR00RR00R0",
    ".0R0RR00RR00RR0.",
    ".0RRRRRRRRRRRR0.",
    "..0RRRRRRRRRR0..",
    "...0000000000...",
    "....0......0....",
    "...0W0....0W0...",
    "................",
    "................",
  ],
  book: [
    "................",
    "................",
    "..0000000000....",
    "..0BBBBBBBBB0...",
    "..0BWWWWWWWB0...",
    "..0BWWWWWWWB0...",
    "..0BWW0000WB0...",
    "..0BWWWWWWWB0...",
    "..0BWW0000WB0...",
    "..0BWWWWWWWB0...",
    "..0BWW0000WB0...",
    "..0BWWWWWWWB0...",
    "..0BBBBBBBBB0...",
    "..0000000000....",
    "................",
    "................",
  ],
  moon: [
    "................",
    "................",
    ".....00000......",
    "....0WWWWW00....",
    "...0WWWWWWWW0...",
    "..0WWWWW0WWW0...",
    "..0WWWWWWWWW0...",
    "..0WW00WWWWW0...",
    "..0WW00WWWWW0...",
    "..0WWWWWWWWW0...",
    "..0WWWWW0WW00...",
    "...0WWWWWWW0....",
    "....0WWWWW0.....",
    ".....00000......",
    "................",
    "................",
  ],
  cloud: [
    "................",
    "................",
    ".....0000.......",
    "....0WWWW000....",
    "...0WWWWWWWW00..",
    "..0WWWWWWWWWWW0.",
    ".0WWWWWWWWWWWW0.",
    ".0WWWWWWWWWWWW0.",
    "..0WWWWWWWWWWW0.",
    "...00WWWWWWWW0..",
    ".....000000000..",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  ghost: [
    "................",
    "................",
    "....00000000....",
    "...0WWWWWWWW0...",
    "..0WWWWWWWWWW0..",
    "..0WW00WW00WW0..",
    "..0W0CC0W0CC0W0.",
    "..0W0CC0W0CC0W0.",
    "..0WW00WW00WW0..",
    "..0WWWWWWWWWW0..",
    "..0WW0WWW0WWW0..",
    "..0W0WW0WWW0WW0.",
    "..0WW0W0W0WWW0..",
    "..00.0...0..00..",
    "................",
    "................",
  ],
  gem: [
    "................",
    "................",
    "....00000000....",
    "...0CCCCCCCC0...",
    "...0CWWWCWWC0...",
    "....0CCCCCCC0...",
    ".....0CCCCC0....",
    ".....0BCCCB0....",
    "......0CCC0.....",
    "......0BCB0.....",
    ".......0C0......",
    ".......000......",
    "................",
    "................",
    "................",
    "................",
  ],
  fire: [
    "................",
    "................",
    ".......00.......",
    "......0YY0......",
    "......0YY00.....",
    ".....0YOOY0.....",
    "....0YOOOOY0....",
    "....0YOORRRY0...",
    "...0YOORRRRY0...",
    "...0YORRRRRY0...",
    "...0OORRRRRO0...",
    "...0ORRRRRRO0...",
    "....0RRRRRR0....",
    "....0RRRRRR0....",
    ".....00000000...",
    "................",
  ],
  robot: [
    "................",
    "................",
    "....00000000....",
    "...0SSSSSSSS0...",
    "...0S0SSSS0S0...",
    "...0S0CCCC0S0...",
    "...0SSCCCCSS0...",
    "..0SSSSSSSSSS0..",
    "..0SSRRSSRRSS0..",
    "..0SSWWSSWWSS0..",
    "..0SSSSSSSSSS0..",
    ".0SSSSS00SSSSS0.",
    ".0SS0000000SSS0.",
    "..0000......000.",
    "................",
    "................",
  ],
  mushroom: [
    "................",
    "................",
    "....00000000....",
    "...0RRRRRRRR0...",
    "..0RWWRRRRWWR0..",
    "..0RRRRWWRRRR0..",
    "..0RRWWRRWWRR0..",
    "..0RRRRRRRRRR0..",
    "..0RRWWRRRRWR0..",
    "...0000WW0000...",
    "....0WWWWWW0....",
    "....0WWWWWW0....",
    "....0WWWWWW0....",
    "....00000000....",
    "................",
    "................",
  ],
  key: [
    "................",
    "................",
    "....00000.......",
    "...0YYYYY0......",
    "..0YYWWWYY0.....",
    "..0YYW0WYY0.....",
    "..0YYWWWYY0.....",
    "...0YYYYY0YYY...",
    "....00000.0Y0...",
    "..........0Y0...",
    "..........0Y0YY.",
    "..........0YYY0.",
    "..........0Y0.0.",
    "..........0YY0..",
    "..........00....",
    "................",
  ],
  ant: [
    "................",
    "................",
    "................",
    "...0..00.0..0...",
    "....00000000....",
    "...000000000....",
    "..0NNN0NNNN00...",
    ".0NNNNNNNNNN00..",
    ".0NWN0NNN0NWN0..",
    ".0NNNNNNNNNN0...",
    "..0NN000NN0.....",
    "...00...00......",
    "................",
    "................",
    "................",
    "................",
  ],
  egg: [
    "................",
    "................",
    "................",
    ".....000000.....",
    "....0WWWWWW0....",
    "...0WWWWWWWW0...",
    "..0WWWWYWWWWW0..",
    "..0WWYYYYWWWW0..",
    "..0WWWWWWYWWW0..",
    "..0WWWWWWWWWW0..",
    "..0WWWWWWWWWW0..",
    "...0WWWWWWWW0...",
    "....00000000....",
    "................",
    "................",
    "................",
  ],
  bone: [
    "................",
    "................",
    "..00........00..",
    ".0WW00....00WW0.",
    "0WWWWW0..0WWWWW0",
    "0WWWWWWWWWWWWWW0",
    "0WWWWWWWWWWWWWW0",
    "0WWWWWWWWWWWWWW0",
    "0WWWWWWWWWWWWWW0",
    "0WWWWW0..0WWWWW0",
    ".0WW00....00WW0.",
    "..00........00..",
    "................",
    "................",
    "................",
    "................",
  ],
  leaf: [
    "................",
    "................",
    ".........00.....",
    "........0GG0....",
    ".......0GGGG0...",
    "......0GGGGGG0..",
    ".....0GGGgGGG0..",
    "....0GGGgGgGG0..",
    "...0GGGgGgGGG0..",
    "..0GGgGgGGGGG0..",
    "..0GGGGgGGGG0...",
    "..0GGGgGGGG0....",
    "..0GgGGGG0......",
    "..0GGGG00.......",
    "..0NN00.........",
    "..00............",
  ],
  boat: [
    "................",
    "................",
    ".......00.......",
    "......0W0.......",
    "......0WW0......",
    "......0WWW0.....",
    "......0WWWW0....",
    "......0WWWWW0...",
    "..0000000000000.",
    ".0NNNNNNNNNNNNN0",
    "..0NNNNNNNNNNN0.",
    "...0CCCCCCCCC0..",
    "....0CCCCCCC0...",
    "....00000000....",
    "................",
    "................",
  ],
  ball: [
    "................",
    "................",
    "....00000000....",
    "...0WWWWWWWW0...",
    "..0WRRRWWRRRW0..",
    "..0RRRRWWRRRR0..",
    "..0WWRWWWWRWW0..",
    "..0WWWWWWWWWW0..",
    "..0WWRWWWWRWW0..",
    "..0RRRRWWRRRR0..",
    "..0WRRRWWRRRW0..",
    "...0WWWWWWWW0...",
    "....00000000....",
    "................",
    "................",
    "................",
  ],
  ring: [
    "................",
    "................",
    "........0.......",
    ".......0C0......",
    "......0CCC0.....",
    "......0CCC0.....",
    ".......000......",
    ".....0000000....",
    "....0YYYYYYY0...",
    "...0YY00000YY0..",
    "..0YY0.....0YY0.",
    "..0Y0.......0Y0.",
    "..0YY0.....0YY0.",
    "...0YY00000YY0..",
    "....0YYYYYYY0...",
    ".....0000000....",
  ],
  kite: [
    "................",
    "................",
    "........0.......",
    ".......0R0......",
    "......0RRR0.....",
    ".....0RRYRR0....",
    "....0RRYYYRR0...",
    "...0RRYYYYYRR0..",
    "....0RRYYYRR0...",
    ".....0RRYRR0....",
    "......0RRR0.....",
    "......0Y0Y0.....",
    ".......0C0......",
    "......0M0M0.....",
    ".......0H0......",
    "......0Y0Y0.....",
  ],
  duck: [
    "................",
    "................",
    "...0000.........",
    "..0YYYY00.......",
    "..0YYYY0000.....",
    "..0Y0YYYYY00....",
    "..0YYYYYYYY00...",
    "...000YYYYYY00..",
    ".....0YYYYYYYY0.",
    ".....0YYYYYYY0..",
    ".....0OOOO0OO0..",
    "......0000.00...",
    "................",
    "................",
    "................",
    "................",
  ],
  bear: [
    "................",
    "................",
    "..0000....0000..",
    ".0NNN0....0NNN0.",
    ".0NNN000000NNN0.",
    ".0NNNNNNNNNNNN0.",
    ".0NNN0NN0NNNN0..",
    ".0NN0WW00WW0NN0.",
    ".0NN0WW00WW0NN0.",
    ".0NNNN0NN0NNN0..",
    ".0NNN000000NNN0.",
    ".0NNNN0NN0NNNN0.",
    "..0NNNNNNNNNN0..",
    "...0000000000...",
    "................",
    "................",
  ],
};

// ---------- Pixel font (3x5) for word labels and HUD ----------
// Each glyph is 5 rows of 3 chars; '1' = pixel, '0' = empty.
const GLYPH_H = 5;
const GLYPH_W = 3;
const FONT: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["111", "001", "001", "101", "010"],
  K: ["101", "110", "100", "110", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "111", "011"],
  R: ["110", "101", "110", "110", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "011"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  "0": ["010", "101", "101", "101", "010"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"],
  "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "110", "001", "110"],
  "6": ["011", "100", "110", "101", "010"],
  "7": ["111", "001", "010", "100", "100"],
  "8": ["010", "101", "010", "101", "010"],
  "9": ["010", "101", "011", "001", "110"],
  "!": ["010", "010", "010", "000", "010"],
  "?": ["110", "001", "010", "000", "010"],
  ".": ["000", "000", "000", "000", "010"],
  ",": ["000", "000", "000", "010", "100"],
  ":": ["000", "010", "000", "010", "000"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["000", "000", "000", "000", "000"],
};

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  shadow?: string,
) {
  const upper = text.toUpperCase();
  if (shadow) {
    ctx.fillStyle = shadow;
    drawTextInner(ctx, upper, x + size, y + size, size);
  }
  ctx.fillStyle = color;
  drawTextInner(ctx, upper, x, y, size);
}

function drawTextInner(
  ctx: CanvasRenderingContext2D,
  upper: string,
  x: number,
  y: number,
  size: number,
) {
  let cx = x;
  for (const ch of upper) {
    const g = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < GLYPH_H; r++) {
      const row = g[r];
      for (let c = 0; c < GLYPH_W; c++) {
        if (row[c] === "1") {
          ctx.fillRect(cx + c * size, y + r * size, size, size);
        }
      }
    }
    cx += (GLYPH_W + 1) * size;
  }
}

function textWidth(text: string, size: number) {
  return text.length * (GLYPH_W + 1) * size - size;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: SpriteKey,
  x: number,
  y: number,
  scale: number,
) {
  const grid = SPRITES[key];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      const col = C[ch];
      if (!col || col === "transparent") continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  }
}

// ---------- Levels ----------
const LEVELS: LevelDef[] = [
  {
    name: "Sunny Meadow",
    theme: "meadow",
    words: [
      { word: "CAT", sprite: "cat" },
      { word: "DOG", sprite: "dog" },
      { word: "SUN", sprite: "sun" },
      { word: "BEE", sprite: "bee" },
      { word: "HAT", sprite: "hat" },
      { word: "PIG", sprite: "pig" },
      { word: "OWL", sprite: "owl" },
      { word: "FOX", sprite: "fox" },
      { word: "COW", sprite: "cow" },
      { word: "CUP", sprite: "cup" },
      { word: "EGG", sprite: "egg" },
      { word: "ANT", sprite: "ant" },
      { word: "KEY", sprite: "key" },
      { word: "BUG", sprite: "bee" },
      { word: "RAT", sprite: "cat" },
    ],
    needed: 6,
    spawnMs: 3200,
    driftSpeed: 0.55,
  },
  {
    name: "Sparkle Forest",
    theme: "forest",
    words: [
      { word: "TREE", sprite: "tree" },
      { word: "FISH", sprite: "fish" },
      { word: "BIRD", sprite: "bird" },
      { word: "FROG", sprite: "frog" },
      { word: "STAR", sprite: "star" },
      { word: "CAKE", sprite: "cake" },
      { word: "DRUM", sprite: "drum" },
      { word: "BOOK", sprite: "book" },
      { word: "MOON", sprite: "moon" },
      { word: "DUCK", sprite: "duck" },
      { word: "BEAR", sprite: "bear" },
      { word: "BOAT", sprite: "boat" },
      { word: "BALL", sprite: "ball" },
      { word: "RING", sprite: "ring" },
      { word: "KITE", sprite: "kite" },
      { word: "BONE", sprite: "bone" },
      { word: "LEAF", sprite: "leaf" },
      { word: "FIRE", sprite: "fire" },
    ],
    needed: 7,
    spawnMs: 2900,
    driftSpeed: 0.7,
  },
  {
    name: "Crystal Mountains",
    theme: "mountain",
    words: [
      { word: "APPLE", sprite: "apple" },
      { word: "HOUSE", sprite: "house" },
      { word: "SNAKE", sprite: "snake" },
      { word: "CROWN", sprite: "crown" },
      { word: "SWORD", sprite: "sword" },
      { word: "HEART", sprite: "heart" },
      { word: "CLOUD", sprite: "cloud" },
      { word: "GHOST", sprite: "ghost" },
      { word: "ROBOT", sprite: "robot" },
      { word: "TIGER", sprite: "cat" },
      { word: "BERRY", sprite: "apple" },
      { word: "PIANO", sprite: "drum" },
      { word: "JEWEL", sprite: "gem" },
      { word: "MAGIC", sprite: "star" },
      { word: "HORSE", sprite: "cow" },
      { word: "MOUSE", sprite: "rabbit" },
      { word: "BREAD", sprite: "cake" },
    ],
    needed: 8,
    spawnMs: 2700,
    driftSpeed: 0.85,
  },
  {
    name: "Dragon Castle",
    theme: "castle",
    words: [
      { word: "DRAGON", sprite: "dragon" },
      { word: "CASTLE", sprite: "castle" },
      { word: "ROCKET", sprite: "rocket" },
      { word: "FLOWER", sprite: "flower" },
      { word: "BANANA", sprite: "banana" },
      { word: "RABBIT", sprite: "rabbit" },
      { word: "MONKEY", sprite: "monkey" },
      { word: "PURPLE", sprite: "gem" },
      { word: "JUNGLE", sprite: "leaf" },
      { word: "WIZARD", sprite: "ghost" },
      { word: "GUITAR", sprite: "drum" },
      { word: "BRIDGE", sprite: "castle" },
      { word: "PLANET", sprite: "moon" },
      { word: "KNIGHT", sprite: "sword" },
      { word: "GARDEN", sprite: "flower" },
      { word: "FOREST", sprite: "tree" },
      { word: "DONKEY", sprite: "cow" },
    ],
    needed: 9,
    spawnMs: 2500,
    driftSpeed: 1.0,
  },
];

const BOSS_WORDS = [
  "FREEZE",
  "PUPPY",
  "JUNGLE",
  "MONKEY",
  "SNOW",
  "BANANA",
  "CHOMP",
  "MAGIC",
  "BERRY",
  "SHINE",
  "SPARK",
  "TIGER",
  "VINE",
  "CLOUD",
];

const BOSS_HITS_TO_WIN = 6;
const BOSS_SNOWBALL_SPAWN_MS = 2400;

// ---------- Game State ----------
type GameState = {
  phase: Phase;
  level: number; // 0..3 normal, then boss
  hearts: number;
  score: number;
  words: WordObject[];
  snowballs: Snowball[];
  particles: Particle[];
  cleared: number; // words cleared this level
  spawnTimer: number;
  unicornBob: number;
  scroll: number;
  shake: number;
  flash: number;
  bossHits: number;
  bossHurt: number;
  bossMouthGlow: number;
  bossSpawnTimer: number;
  message: { text: string; t: number } | null;
  /** ring buffer of recently used words to avoid repeats */
  recentWords: string[];
};

function newGameState(): GameState {
  return {
    phase: "title",
    level: 0,
    hearts: 3,
    score: 0,
    words: [],
    snowballs: [],
    particles: [],
    cleared: 0,
    spawnTimer: 800,
    unicornBob: 0,
    scroll: 0,
    shake: 0,
    flash: 0,
    bossHits: 0,
    bossHurt: 0,
    bossMouthGlow: 0,
    bossSpawnTimer: 1600,
    message: null,
    recentWords: [],
  };
}

// ---------- Sound (chiptune) ----------
class Chiptune {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;

  ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  blip(freq: number, dur = 0.07, type: OscillatorType = "square", vol = 0.6) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  arp(notes: number[], gap = 0.06, type: OscillatorType = "square") {
    notes.forEach((f, i) => setTimeout(() => this.blip(f, gap, type), i * gap * 1000));
  }

  noise(dur = 0.18, vol = 0.5) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.master);
    src.start();
  }

  letterOk(idx: number) {
    this.blip(440 + idx * 40, 0.05, "square", 0.4);
  }
  letterBad() {
    this.blip(140, 0.12, "sawtooth", 0.5);
  }
  wordOk() {
    this.arp([523, 659, 784, 1046], 0.06, "square");
  }
  levelUp() {
    this.arp([523, 659, 784, 1046, 1318, 1568], 0.08, "triangle");
  }
  hit() {
    this.noise(0.2, 0.5);
    this.blip(180, 0.18, "sawtooth", 0.5);
  }
  bossHit() {
    this.arp([880, 660, 440], 0.07, "square");
    this.noise(0.18, 0.4);
  }
  explode() {
    if (this.muted) return;
    this.noise(0.32, 0.65);
    this.blip(110, 0.22, "sawtooth", 0.55);
    this.blip(220, 0.12, "square", 0.4);
  }
  win() {
    this.arp([523, 659, 784, 1046, 1318, 1568, 2093], 0.1, "square");
  }
  lose() {
    this.arp([440, 330, 220, 165], 0.18, "triangle");
  }
}

const sound = new Chiptune();

// ---------- Helpers ----------
function pickLevelWord(state: GameState): { word: string; sprite: SpriteKey } {
  const lvl = LEVELS[state.level];
  const onScreen = new Set(state.words.map((w) => w.word));
  const recent = new Set(state.recentWords);
  // Prefer words not on screen AND not recently used; fall back step-by-step.
  let pool = lvl.words.filter((w) => !onScreen.has(w.word) && !recent.has(w.word));
  if (!pool.length) pool = lvl.words.filter((w) => !onScreen.has(w.word));
  if (!pool.length) pool = lvl.words;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  state.recentWords.push(pick.word);
  // Keep history shorter than pool so we always have non-recent options
  const maxHistory = Math.max(0, lvl.words.length - 3);
  while (state.recentWords.length > maxHistory) state.recentWords.shift();
  return pick;
}

function pickBossWord(state: GameState): string {
  const onScreen = new Set(state.snowballs.map((s) => s.word));
  const recent = new Set(state.recentWords);
  let pool = BOSS_WORDS.filter((w) => !onScreen.has(w) && !recent.has(w));
  if (!pool.length) pool = BOSS_WORDS.filter((w) => !onScreen.has(w));
  if (!pool.length) pool = [...BOSS_WORDS];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  state.recentWords.push(pick);
  const maxHistory = Math.max(0, BOSS_WORDS.length - 3);
  while (state.recentWords.length > maxHistory) state.recentWords.shift();
  return pick;
}

function spawnConfetti(s: GameState, x: number, y: number, color: string) {
  for (let i = 0; i < 14; i++) {
    s.particles.push({
      x,
      y,
      vx: -2 + Math.random() * 4,
      vy: -3 - Math.random() * 3,
      life: 0.9,
      maxLife: 0.9,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

function explode(s: GameState, cx: number, cy: number, palette: string[]) {
  // Ring burst — particles fly outward in all directions
  const ringCount = 28;
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2 + Math.random() * 0.2;
    const speed = 4 + Math.random() * 4;
    s.particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 1,
      life: 0.9 + Math.random() * 0.4,
      maxLife: 1.3,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 4 + Math.random() * 4,
    });
  }
  // Inner scatter — slower, larger chunks
  for (let i = 0; i < 18; i++) {
    s.particles.push({
      x: cx + (Math.random() - 0.5) * 24,
      y: cy + (Math.random() - 0.5) * 24,
      vx: (Math.random() - 0.5) * 5,
      vy: -3 - Math.random() * 4,
      life: 0.9,
      maxLife: 0.9,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 5 + Math.random() * 5,
    });
  }
  // White sparkle core
  for (let i = 0; i < 12; i++) {
    s.particles.push({
      x: cx,
      y: cy,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 0.4,
      maxLife: 0.4,
      color: PAL.white,
      size: 4 + Math.random() * 3,
    });
  }
  // Brief screen flash + tiny shake
  s.flash = Math.max(s.flash, 0.18);
  s.shake = Math.max(s.shake, 3);
}

// Per-sprite particle palettes for themed explosions
const SPRITE_PALETTES: Record<SpriteKey, string[]> = {
  cat: [PAL.cream, PAL.black, PAL.pink, PAL.yellow],
  dog: [PAL.brown, PAL.white, PAL.red, PAL.cream],
  sun: [PAL.yellow, PAL.orange, PAL.white, PAL.red],
  hat: [PAL.purple, PAL.yellow, PAL.hotPink, PAL.brown],
  bee: [PAL.yellow, PAL.black, PAL.white, PAL.orange],
  fish: [PAL.cyan, PAL.blue, PAL.white, PAL.yellow],
  tree: [PAL.green, PAL.greenDark, PAL.brown, PAL.yellow],
  frog: [PAL.green, PAL.greenDark, PAL.white, PAL.yellow],
  star: [PAL.yellow, PAL.white, PAL.orange, PAL.cyan],
  bird: [PAL.cyan, PAL.yellow, PAL.white, PAL.blue],
  apple: [PAL.red, PAL.green, PAL.brown, PAL.white],
  house: [PAL.red, PAL.brick, PAL.white, PAL.yellow],
  snake: [PAL.green, PAL.greenDark, PAL.yellow, PAL.black],
  crown: [PAL.yellow, PAL.red, PAL.orange, PAL.white],
  sword: [PAL.stone, PAL.white, PAL.yellow, PAL.brown],
  dragon: [PAL.green, PAL.red, PAL.greenDark, PAL.yellow],
  castle: [PAL.stone, PAL.brick, PAL.white, PAL.yellow],
  rocket: [PAL.white, PAL.red, PAL.cyan, PAL.yellow],
  flower: [PAL.hotPink, PAL.yellow, PAL.green, PAL.white],
  banana: [PAL.yellow, PAL.brown, PAL.white, PAL.green],
  monkey: [PAL.brown, PAL.cream, PAL.black, PAL.yellow],
  rabbit: [PAL.white, PAL.pink, PAL.black, PAL.hotPink],
  snowball: [PAL.white, PAL.cyan, PAL.blue, PAL.white],
  heart: [PAL.hotPink, PAL.pink, PAL.red, PAL.white],
  puppyBoss: [PAL.hotPink, PAL.pink, PAL.white, PAL.magenta],
  pig: [PAL.pink, PAL.hotPink, PAL.white, PAL.black],
  owl: [PAL.brown, PAL.white, PAL.yellow, PAL.black],
  fox: [PAL.orange, PAL.white, PAL.brown, PAL.black],
  cow: [PAL.white, PAL.black, PAL.pink, PAL.cream],
  cup: [PAL.white, PAL.cyan, PAL.blue, PAL.yellow],
  cake: [PAL.pink, PAL.white, PAL.yellow, PAL.red],
  drum: [PAL.red, PAL.brown, PAL.yellow, PAL.white],
  book: [PAL.blue, PAL.white, PAL.yellow, PAL.brown],
  moon: [PAL.white, PAL.yellow, PAL.cyan, PAL.purple],
  cloud: [PAL.white, PAL.cyan, PAL.blue, PAL.white],
  ghost: [PAL.white, PAL.cyan, PAL.purple, PAL.black],
  gem: [PAL.cyan, PAL.blue, PAL.white, PAL.magenta],
  fire: [PAL.red, PAL.orange, PAL.yellow, PAL.white],
  robot: [PAL.stone, PAL.cyan, PAL.red, PAL.yellow],
  mushroom: [PAL.red, PAL.white, PAL.cream, PAL.brown],
  key: [PAL.yellow, PAL.orange, PAL.brown, PAL.white],
  ant: [PAL.brown, PAL.black, PAL.red, PAL.white],
  egg: [PAL.white, PAL.yellow, PAL.cream, PAL.brown],
  bone: [PAL.white, PAL.cream, PAL.brown, PAL.black],
  leaf: [PAL.green, PAL.greenDark, PAL.yellow, PAL.brown],
  boat: [PAL.brown, PAL.white, PAL.cyan, PAL.red],
  ball: [PAL.white, PAL.red, PAL.blue, PAL.yellow],
  ring: [PAL.yellow, PAL.cyan, PAL.white, PAL.magenta],
  kite: [PAL.red, PAL.yellow, PAL.cyan, PAL.hotPink],
  duck: [PAL.yellow, PAL.orange, PAL.white, PAL.green],
  bear: [PAL.brown, PAL.white, PAL.cream, PAL.pink],
};

// ---------- Main component ----------
export function UnicornSpeller() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stateRef = useRef<GameState>(newGameState());
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const mutedRef = useRef(false);
  const [, forceUi] = useReducer((x: number) => x + 1, 0);

  const startGame = useCallback(() => {
    stateRef.current = { ...newGameState(), phase: "playing" };
    sound.ensure();
    forceUi();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const toggleMute = useCallback(() => {
    sound.muted = !sound.muted;
    mutedRef.current = sound.muted;
    forceUi();
  }, []);

  const handleLetter = useCallback((rawCh: string) => {
    const ch = rawCh.toUpperCase();
    if (!/^[A-Z]$/.test(ch)) return;
    const s = stateRef.current;
    if (s.phase === "playing") {
      // Prefer a word already in progress whose next letter matches.
      // Otherwise pick any unstarted word whose first letter matches.
      // If still nothing matches, treat as a soft miss (sfx only).
      const inProgressMatch = s.words.find(
        (w) => !w.done && w.typed.length > 0 && w.word[w.typed.length] === ch,
      );
      const freshMatch = s.words.find(
        (w) => !w.done && w.typed.length === 0 && w.word[0] === ch,
      );
      const target = inProgressMatch ?? freshMatch;
      if (target) {
        target.typed += ch;
        sound.letterOk(target.typed.length);
        if (target.typed === target.word) {
          target.done = true;
          s.score += target.word.length * 10;
          s.cleared += 1;
          const cx = target.x + 16 * PIXEL / 2;
          const cy = target.y + 16 * PIXEL / 2;
          explode(s, cx, cy, SPRITE_PALETTES[target.spriteKey]);
          sound.explode();
          sound.wordOk();
          if (s.cleared >= LEVELS[s.level].needed) {
            // Bonus: explode any leftover words on screen so they don't
            // just vanish when the level clears.
            for (const w of s.words) {
              if (w.done) continue;
              w.done = true;
              const lx = w.x + 16 * PIXEL / 2;
              const ly = w.y + 16 * PIXEL / 2;
              explode(s, lx, ly, SPRITE_PALETTES[w.spriteKey]);
              s.score += w.word.length * 5; // half-score bonus
            }
            s.phase = "level-clear";
            s.message = {
              text: s.level + 1 >= LEVELS.length ? "TO THE JUNGLE!" : "LEVEL CLEAR!",
              t: 2500,
            };
            sound.levelUp();
          }
        }
      } else {
        // Wrong letter: just a beep, no heart penalty
        sound.letterBad();
      }
    } else if (s.phase === "boss") {
      const inProgress = s.snowballs.find(
        (sb) => !sb.done && sb.typed.length > 0 && sb.word[sb.typed.length] === ch,
      );
      const fresh = s.snowballs
        .filter((sb) => !sb.done && sb.typed.length === 0 && sb.word[0] === ch)
        .sort((a, b) => a.x - b.x)[0]; // closest to player (lowest x)
      const target = inProgress ?? fresh;
      if (target) {
        target.typed += ch;
        sound.letterOk(target.typed.length);
        if (target.typed === target.word) {
          target.done = true;
          s.bossHits += 1;
          s.bossHurt = 0.5;
          const cx = target.x + 16 * PIXEL / 2;
          const cy = target.y + 16 * PIXEL / 2;
          explode(s, cx, cy, SPRITE_PALETTES.snowball);
          sound.explode();
          sound.bossHit();
          if (s.bossHits >= BOSS_HITS_TO_WIN) {
            s.phase = "won";
            sound.win();
          }
        }
      } else {
        sound.letterBad();
      }
    }
  }, []);

  // Desktop keydown — also used as global fallback when the hidden
  // input isn't focused. We process the key here and preventDefault on
  // letter keys so the input value doesn't update (which would otherwise
  // fire onInput and double-process the letter).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const s = stateRef.current;
      if (e.key === "Enter") {
        e.preventDefault();
        if (s.phase === "title" || s.phase === "won" || s.phase === "lost") {
          startGame();
        }
        return;
      }
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        if (s.phase === "playing" || s.phase === "boss") {
          handleLetter(e.key);
        }
      }
    },
    [handleLetter, startGame],
  );

  // Mobile soft keyboards (notably Android) fire keydown with
  // e.key="Unidentified", so the keydown handler can't catch the letter.
  // For those, we read it from the input value via onInput. To avoid
  // double-processing on desktop, the keydown handler preventDefaults
  // letters before they can reach the input.
  const onMobileInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      const val = el.value;
      if (val.length === 0) return;
      const ch = val[val.length - 1];
      el.value = "";
      const s = stateRef.current;
      if (s.phase === "playing" || s.phase === "boss") {
        handleLetter(ch);
      }
    },
    [handleLetter],
  );

  // Global keydown as a safety net when focus is elsewhere on the page.
  // Same dedupe story: if the hidden input was focused, our onKeyDown
  // there already handled it and called preventDefault; this window
  // listener checks document.activeElement and bails in that case.
  useEffect(() => {
    const onWindowKey = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      const s = stateRef.current;
      if (e.key === "Enter") {
        if (s.phase === "title" || s.phase === "won" || s.phase === "lost") {
          e.preventDefault();
          startGame();
          return;
        }
      }
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        if (s.phase === "playing" || s.phase === "boss") {
          e.preventDefault();
          handleLetter(e.key);
        }
      }
    };
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  }, [handleLetter, startGame]);

  // Game loop
  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    ctx.imageSmoothingEnabled = false;

    const loop = (t: number) => {
      const last = lastRef.current ?? t;
      const dt = Math.min(60, t - last);
      lastRef.current = t;
      update(stateRef.current, dt);
      draw(ctx, stateRef.current, t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Re-render UI a few times per second so hearts/score chips update
  useEffect(() => {
    const i = setInterval(forceUi, 200);
    return () => clearInterval(i);
  }, []);

  const s = stateRef.current;
  const lvl = LEVELS[Math.min(s.level, LEVELS.length - 1)];
  const inBoss = s.phase === "boss";
  const levelName = inBoss ? "Monkey Jungle Boss" : lvl.name;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 ring-4 ring-white/70 shadow-pop-sm">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              className={cn(
                "size-7 transition-all",
                i < s.hearts
                  ? "fill-fun-red text-fun-red"
                  : "fill-muted text-muted-foreground/40",
              )}
              strokeWidth={2.5}
            />
          ))}
        </div>

        <div className="inline-flex items-baseline gap-3 rounded-full bg-card px-5 py-2.5 ring-4 ring-white/70 shadow-pop-sm">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {inBoss ? "Boss" : "Level"}
          </span>
          <span className="font-heading text-2xl font-bold text-fun-magenta">
            {inBoss
              ? `${s.bossHits}/${BOSS_HITS_TO_WIN}`
              : `${s.level + 1} · ${s.cleared}/${lvl.needed}`}
          </span>
        </div>

        <div className="inline-flex items-baseline gap-3 rounded-full bg-card px-5 py-2.5 ring-4 ring-white/70 shadow-pop-sm">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Score
          </span>
          <span className="font-heading text-2xl font-bold text-fun-purple">{s.score}</span>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2.5 ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
          aria-label={mutedRef.current ? "Unmute" : "Mute"}
        >
          {mutedRef.current ? (
            <VolumeX className="size-5 text-fun-magenta" strokeWidth={2.5} />
          ) : (
            <Volume2 className="size-5 text-fun-magenta" strokeWidth={2.5} />
          )}
        </button>

        <button
          type="button"
          onClick={startGame}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-bold text-primary-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
        >
          {s.phase === "title" ? (
            <>
              <Sparkles className="size-5" strokeWidth={3} /> Start
            </>
          ) : s.phase === "won" || s.phase === "lost" ? (
            <>
              <RotateCcw className="size-5" strokeWidth={3} /> Play Again
            </>
          ) : (
            <>
              <RotateCcw className="size-5" strokeWidth={3} /> Restart
            </>
          )}
        </button>
      </div>

      <div className="mt-2 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {levelName} — type the words to defeat them!
      </div>

      <div
        className="relative mt-4 overflow-hidden rounded-3xl ring-4 ring-white/70 shadow-pop"
        onPointerDown={(e) => {
          // Focus hidden input so mobile keyboard appears
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block h-auto w-full cursor-pointer touch-none select-none"
          style={{ imageRendering: "pixelated" }}
        />
        {/* Hidden input — captures key events and surfaces the mobile soft keyboard */}
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Type letters"
          onKeyDown={onKeyDown}
          onInput={onMobileInput}
          className="absolute opacity-0 pointer-events-none"
          style={{ left: -9999, width: 1, height: 1 }}
        />
      </div>
    </div>
  );
}

// ---------- Update ----------
function update(s: GameState, dtMs: number) {
  const dt = dtMs / 1000;
  s.unicornBob += dt * 6;
  s.scroll += dt * 60;
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 20);
  if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 2);
  if (s.bossHurt > 0) s.bossHurt = Math.max(0, s.bossHurt - dt * 2);
  if (s.bossMouthGlow > 0) s.bossMouthGlow = Math.max(0, s.bossMouthGlow - dt * 2);

  // Particles
  for (const p of s.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18;
    p.life -= dt;
  }
  s.particles = s.particles.filter((p) => p.life > 0);

  if (s.message) {
    s.message.t -= dtMs;
    if (s.message.t <= 0) {
      const msg = s.message;
      s.message = null;
      if (msg.text === "TO THE JUNGLE!" || msg.text === "LEVEL CLEAR!") {
        s.recentWords = [];
        if (s.level + 1 >= LEVELS.length) {
          // Enter boss
          s.phase = "boss";
          s.level += 1;
          s.cleared = 0;
          s.words = [];
          s.snowballs = [];
          s.bossSpawnTimer = 1200;
        } else {
          s.level += 1;
          s.cleared = 0;
          s.words = [];
          s.phase = "playing";
        }
      }
    }
  }

  if (s.phase === "playing") {
    const lvl = LEVELS[s.level];
    s.spawnTimer -= dtMs;
    const onScreen = s.words.filter((w) => !w.done).length;
    // Don't spawn more than the level still needs — otherwise an extra
    // word can pop in moments before the level-clear letter is typed.
    const remainingNeeded = Math.max(0, lvl.needed - s.cleared);
    const canSpawn = onScreen < 3 && onScreen < remainingNeeded;
    if (s.spawnTimer <= 0 && canSpawn) {
      const pick = pickLevelWord(s);
      const baseY = 120 + Math.random() * 180;
      const newWord: WordObject = {
        id: Date.now() + Math.random(),
        word: pick.word,
        typed: "",
        x: CANVAS_W + 40,
        baseY,
        y: baseY,
        bob: Math.random() * Math.PI * 2,
        spriteKey: pick.sprite,
        done: false,
      };
      s.words.push(newWord);
      s.spawnTimer = lvl.spawnMs;
    }

    for (const w of s.words) {
      if (w.done) continue;
      w.x -= lvl.driftSpeed * (dtMs / 16);
      w.bob += dt * 3;
      w.y = w.baseY + Math.sin(w.bob) * 8;
      if (w.x < -120) {
        // missed — lose a heart
        w.done = true;
        s.hearts -= 1;
        s.flash = 0.4;
        s.shake = 8;
        sound.hit();
        if (s.hearts <= 0) {
          s.phase = "lost";
          sound.lose();
        }
      }
    }
    // Drop done (exploded) words immediately; drop missed words once
    // they're well off-screen left.
    s.words = s.words.filter((w) => !w.done && w.x > -200);
  }

  if (s.phase === "boss") {
    s.bossSpawnTimer -= dtMs;
    if (s.bossSpawnTimer <= 0 && s.snowballs.filter((b) => !b.done).length < 2) {
      const word = pickBossWord(s);
      s.snowballs.push({
        id: Date.now() + Math.random(),
        word,
        typed: "",
        x: CANVAS_W - 180,
        y: 160 + Math.random() * 100,
        vx: -2.6 - s.bossHits * 0.25,
        vy: 0,
        done: false,
      });
      s.bossMouthGlow = 0.5;
      s.bossSpawnTimer = BOSS_SNOWBALL_SPAWN_MS - s.bossHits * 120;
    }

    for (const b of s.snowballs) {
      if (b.done) continue;
      b.x += b.vx * (dtMs / 16);
      // Subtle wave
      b.y += Math.sin((b.x + s.scroll) / 30) * 0.3;
      if (b.x < 140) {
        // Hits the unicorn
        b.done = true;
        s.hearts -= 1;
        s.flash = 0.5;
        s.shake = 10;
        sound.hit();
        if (s.hearts <= 0) {
          s.phase = "lost";
          sound.lose();
        }
      }
    }
    s.snowballs = s.snowballs.filter((b) => !b.done);
  }
}

// ---------- Draw ----------
function draw(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  ctx.save();
  // Camera shake
  if (s.shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * s.shake,
      (Math.random() - 0.5) * s.shake,
    );
  }

  // Background
  if (s.phase === "boss") {
    drawJungleBg(ctx, t);
  } else if (s.phase === "title") {
    drawMeadowBg(ctx, t);
  } else {
    const lvl = LEVELS[Math.min(s.level, LEVELS.length - 1)];
    if (lvl.theme === "meadow") drawMeadowBg(ctx, t);
    else if (lvl.theme === "forest") drawForestBg(ctx, t);
    else if (lvl.theme === "mountain") drawMountainBg(ctx, t);
    else if (lvl.theme === "castle") drawCastleBg(ctx, t);
  }

  // Word objects with labels
  if (s.phase === "playing") {
    for (const w of s.words) {
      drawWordObject(ctx, w);
    }
  }

  // Boss
  if (s.phase === "boss") {
    drawBoss(ctx, s);
    for (const b of s.snowballs) {
      drawSnowball(ctx, b);
    }
  }

  // Unicorn (player) — visible during play & boss & title
  drawUnicorn(ctx, s);

  // Particles
  for (const p of s.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Damage flash
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255,40,40,${s.flash * 0.5})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  ctx.restore();

  // Overlays drawn outside shake transform
  if (s.phase === "title") {
    drawTitle(ctx, t);
  } else if (s.phase === "won") {
    drawWinOverlay(ctx, s);
  } else if (s.phase === "lost") {
    drawLoseOverlay(ctx, s);
  } else if (s.phase === "level-clear" && s.message) {
    drawLevelClear(ctx, s.message.text);
  }

  // Tip text bottom — show in any play phase
  if (s.phase === "playing" || s.phase === "boss") {
    drawText(
      ctx,
      "TYPE THE WORD",
      CANVAS_W / 2 - textWidth("TYPE THE WORD", 3) / 2,
      CANVAS_H - 28,
      3,
      PAL.white,
      PAL.textShadow,
    );
  }
}

// ---------- Backgrounds ----------
function drawSky(ctx: CanvasRenderingContext2D, top: string, bottom: string) {
  const grd = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grd.addColorStop(0, top);
  grd.addColorStop(1, bottom);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);
}

function drawClouds(ctx: CanvasRenderingContext2D, t: number, color: string = PAL.white) {
  const offset = (t / 80) % 220;
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 220 - offset) % (CANVAS_W + 220)) - 100;
    const cy = 40 + (i % 3) * 30;
    ctx.fillStyle = color;
    ctx.fillRect(cx, cy, 80, 16);
    ctx.fillRect(cx + 12, cy - 10, 56, 16);
    ctx.fillRect(cx + 24, cy - 22, 32, 16);
  }
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  topColor: string,
  bodyColor: string,
  decor?: (ctx: CanvasRenderingContext2D, scroll: number) => void,
  scroll = 0,
) {
  ctx.fillStyle = topColor;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, 14);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(0, GROUND_Y + 14, CANVAS_W, CANVAS_H - GROUND_Y - 14);
  // little pixel tufts
  const step = 28;
  const dark = bodyColor === PAL.grass ? PAL.grassDark : PAL.dirtDark;
  for (let x = -((scroll * 2) % step); x < CANVAS_W; x += step) {
    ctx.fillStyle = dark;
    ctx.fillRect(x, GROUND_Y + 14, 4, 4);
    ctx.fillRect(x + 8, GROUND_Y + 22, 4, 4);
  }
  if (decor) decor(ctx, scroll);
}

function drawMeadowBg(ctx: CanvasRenderingContext2D, t: number) {
  drawSky(ctx, PAL.sky1, PAL.sky2);
  drawClouds(ctx, t);
  // Distant hills
  ctx.fillStyle = PAL.greenDark;
  for (let i = 0; i < 4; i++) {
    const x = ((i * 280 - (t / 200) * 30) % (CANVAS_W + 280)) - 140;
    drawHill(ctx, x, GROUND_Y - 4, 220, 60, PAL.greenDark);
  }
  drawGround(ctx, PAL.grass, PAL.grassDark, (g, scroll) => {
    // Flowers
    const step = 56;
    for (let x = -((scroll * 3) % step); x < CANVAS_W; x += step) {
      g.fillStyle = PAL.hotPink;
      g.fillRect(x + 2, GROUND_Y - 2, 4, 4);
      g.fillStyle = PAL.yellow;
      g.fillRect(x + 2, GROUND_Y - 6, 4, 4);
    }
  }, t / 16);
}

function drawForestBg(ctx: CanvasRenderingContext2D, t: number) {
  drawSky(ctx, "#74acfc", "#bce0fc");
  drawClouds(ctx, t);
  // Background trees
  for (let i = 0; i < 8; i++) {
    const x = ((i * 160 - (t / 200) * 40) % (CANVAS_W + 160)) - 80;
    drawBgTree(ctx, x, GROUND_Y - 90, "#005c00", "#5c3000");
  }
  drawGround(ctx, PAL.grass, PAL.grassDark, undefined, t / 16);
  // Foreground bushes
  for (let i = 0; i < 6; i++) {
    const x = ((i * 220 - (t / 200) * 80) % (CANVAS_W + 220)) - 110;
    drawBush(ctx, x, GROUND_Y - 16);
  }
}

function drawMountainBg(ctx: CanvasRenderingContext2D, t: number) {
  drawSky(ctx, "#fcb46c", "#fcd8a8");
  drawClouds(ctx, t, "#fce0bc");
  // Distant peaks with snow caps
  for (let i = 0; i < 6; i++) {
    const x = ((i * 200 - (t / 200) * 25) % (CANVAS_W + 200)) - 100;
    drawMountain(ctx, x, GROUND_Y - 8);
  }
  drawGround(ctx, PAL.dirt, PAL.dirtDark, (g, scroll) => {
    const step = 80;
    for (let x = -((scroll * 2) % step); x < CANVAS_W; x += step) {
      g.fillStyle = PAL.stoneDark;
      g.fillRect(x + 4, GROUND_Y - 4, 12, 4);
      g.fillRect(x + 6, GROUND_Y - 8, 8, 4);
    }
  }, t / 16);
}

function drawCastleBg(ctx: CanvasRenderingContext2D, t: number) {
  drawSky(ctx, "#3818a8", "#a83cfc");
  // Stars
  ctx.fillStyle = PAL.white;
  for (let i = 0; i < 40; i++) {
    const sx = (i * 47) % CANVAS_W;
    const sy = (i * 37) % (GROUND_Y - 40);
    const flick = Math.sin(t / 200 + i) > 0;
    if (flick) ctx.fillRect(sx, sy, 3, 3);
  }
  // Big moon
  ctx.fillStyle = PAL.yellow;
  ctx.fillRect(CANVAS_W - 140, 60, 60, 60);
  ctx.fillStyle = "#fce0bc";
  ctx.fillRect(CANVAS_W - 132, 68, 44, 44);

  // Distant castle silhouette
  ctx.fillStyle = "#1c0040";
  ctx.fillRect(120, GROUND_Y - 140, 720, 140);
  for (let x = 120; x < 840; x += 40) {
    ctx.fillRect(x, GROUND_Y - 150, 12, 16);
  }
  // Towers
  ctx.fillRect(120, GROUND_Y - 200, 60, 200);
  ctx.fillRect(780, GROUND_Y - 200, 60, 200);
  ctx.fillStyle = PAL.red;
  // Flags
  ctx.fillRect(146, GROUND_Y - 220, 16, 12);
  ctx.fillRect(806, GROUND_Y - 220, 16, 12);
  ctx.fillStyle = "#1c0040";
  ctx.fillRect(150, GROUND_Y - 230, 4, 30);
  ctx.fillRect(810, GROUND_Y - 230, 4, 30);
  drawGround(ctx, "#5c2860", "#3818a8", undefined, t / 16);
}

function drawJungleBg(ctx: CanvasRenderingContext2D, t: number) {
  drawSky(ctx, "#00643c", "#00a85c");
  // Hanging vines
  for (let i = 0; i < 14; i++) {
    const x = (i * 80 + ((t / 30) % 80)) % (CANVAS_W + 80);
    const len = 40 + ((i * 31) % 80);
    ctx.fillStyle = PAL.greenDark;
    ctx.fillRect(x, 0, 4, len);
    ctx.fillStyle = PAL.green;
    ctx.fillRect(x - 4, len, 12, 8);
  }
  // Big leaves
  for (let i = 0; i < 6; i++) {
    const x = ((i * 200 - (t / 100) * 20) % (CANVAS_W + 200)) - 100;
    drawLeaf(ctx, x, GROUND_Y - 80);
  }
  drawGround(ctx, "#1c8c00", "#00501c", (g, scroll) => {
    const step = 60;
    for (let x = -((scroll * 2) % step); x < CANVAS_W; x += step) {
      g.fillStyle = "#ffb46c";
      g.fillRect(x, GROUND_Y - 1, 8, 4);
      g.fillRect(x + 4, GROUND_Y - 4, 4, 4);
    }
  }, t / 12);
}

function drawHill(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < h; i++) {
    const yy = baseY - i;
    const cur = w - i * 2;
    ctx.fillRect(x + i, yy, cur, 1);
  }
}

function drawBgTree(ctx: CanvasRenderingContext2D, x: number, y: number, leaf: string, trunk: string) {
  ctx.fillStyle = trunk;
  ctx.fillRect(x + 20, y + 50, 12, 50);
  ctx.fillStyle = leaf;
  ctx.fillRect(x, y + 20, 52, 36);
  ctx.fillRect(x + 8, y + 4, 36, 28);
  ctx.fillRect(x + 16, y - 8, 20, 20);
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = PAL.greenDark;
  ctx.fillRect(x, y, 80, 16);
  ctx.fillStyle = PAL.green;
  ctx.fillRect(x + 4, y - 8, 72, 12);
  ctx.fillRect(x + 12, y - 16, 56, 12);
}

function drawMountain(ctx: CanvasRenderingContext2D, x: number, baseY: number) {
  const h = 120;
  for (let i = 0; i < h; i++) {
    const yy = baseY - i;
    const w = 180 - i;
    ctx.fillStyle = i < 14 ? PAL.snow : i < 30 ? "#bcb4d4" : "#7c5cb4";
    ctx.fillRect(x + i / 2, yy, w, 1);
  }
}

function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#005c00";
  ctx.fillRect(x, y, 96, 14);
  ctx.fillRect(x + 8, y - 6, 80, 8);
  ctx.fillRect(x + 16, y - 12, 64, 8);
  ctx.fillStyle = "#00a800";
  ctx.fillRect(x + 4, y + 2, 88, 8);
  ctx.fillRect(x + 12, y - 4, 72, 6);
}

// ---------- Unicorn ----------
function drawUnicorn(ctx: CanvasRenderingContext2D, s: GameState) {
  const bob = Math.sin(s.unicornBob) * 4;
  const x = 110;
  const y = GROUND_Y - 96 + bob;
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x + 6, GROUND_Y - 6, 96, 6);

  // Body (white)
  ctx.fillStyle = PAL.white;
  ctx.fillRect(x + 16, y + 36, 80, 36);
  ctx.fillRect(x + 24, y + 28, 68, 12);
  // Legs
  const legPhase = Math.sin(s.unicornBob * 2);
  const legY = y + 68;
  ctx.fillRect(x + 24, legY, 10, 24 + legPhase * 2);
  ctx.fillRect(x + 44, legY, 10, 24 - legPhase * 2);
  ctx.fillRect(x + 64, legY, 10, 24 + legPhase * 2);
  ctx.fillRect(x + 84, legY, 10, 24 - legPhase * 2);
  // Hooves
  ctx.fillStyle = PAL.black;
  ctx.fillRect(x + 24, legY + 22, 10, 4);
  ctx.fillRect(x + 44, legY + 22, 10, 4);
  ctx.fillRect(x + 64, legY + 22, 10, 4);
  ctx.fillRect(x + 84, legY + 22, 10, 4);

  // Tail rainbow
  const tailX = x + 6;
  const tailY = y + 32;
  drawRainbowBar(ctx, tailX - 14, tailY, 28, 36);

  // Neck + head
  ctx.fillStyle = PAL.white;
  ctx.fillRect(x + 78, y + 16, 22, 28);
  ctx.fillRect(x + 88, y + 8, 22, 24);
  // Snout
  ctx.fillRect(x + 104, y + 18, 14, 14);
  ctx.fillStyle = PAL.pink;
  ctx.fillRect(x + 110, y + 26, 8, 4);
  // Eye
  ctx.fillStyle = PAL.black;
  ctx.fillRect(x + 100, y + 14, 4, 4);
  // Ear
  ctx.fillStyle = PAL.white;
  ctx.fillRect(x + 90, y, 8, 12);
  ctx.fillStyle = PAL.pink;
  ctx.fillRect(x + 92, y + 4, 4, 6);

  // Horn (golden, spiral)
  ctx.fillStyle = PAL.yellow;
  ctx.fillRect(x + 98, y - 14, 6, 22);
  ctx.fillStyle = PAL.orange;
  ctx.fillRect(x + 98, y - 10, 6, 2);
  ctx.fillRect(x + 98, y - 4, 6, 2);
  ctx.fillRect(x + 98, y + 2, 6, 2);

  // Mane rainbow
  for (let i = 0; i < 6; i++) {
    const colors = [PAL.red, PAL.orange, PAL.yellow, PAL.green, PAL.cyan, PAL.purple];
    ctx.fillStyle = colors[i];
    ctx.fillRect(x + 70 + i * 2, y + 8 + i * 2, 18 - i, 6);
  }

  // Rider (Morgan) on the back
  drawRider(ctx, x + 40, y - 14);
}

function drawRainbowBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const colors = [PAL.red, PAL.orange, PAL.yellow, PAL.green, PAL.cyan, PAL.purple];
  const stripeH = Math.floor(h / colors.length);
  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(x, y + i * stripeH, w, stripeH);
  }
}

function drawRider(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Body
  ctx.fillStyle = PAL.purple;
  ctx.fillRect(x, y + 18, 18, 20);
  // Head
  ctx.fillStyle = PAL.cream;
  ctx.fillRect(x + 2, y + 4, 14, 16);
  // Hair
  ctx.fillStyle = PAL.brown;
  ctx.fillRect(x, y, 18, 8);
  ctx.fillRect(x - 2, y + 4, 4, 8);
  ctx.fillRect(x + 16, y + 4, 4, 8);
  // Eyes
  ctx.fillStyle = PAL.black;
  ctx.fillRect(x + 4, y + 10, 2, 2);
  ctx.fillRect(x + 12, y + 10, 2, 2);
  // Smile
  ctx.fillRect(x + 6, y + 16, 6, 2);
  // Arms
  ctx.fillStyle = PAL.cream;
  ctx.fillRect(x - 4, y + 20, 6, 8);
  ctx.fillRect(x + 16, y + 20, 6, 8);
}

// ---------- Word objects ----------
function drawWordObject(ctx: CanvasRenderingContext2D, w: WordObject) {
  drawSprite(ctx, w.spriteKey, Math.round(w.x), Math.round(w.y), PIXEL);
  // Word card below
  const size = 4;
  const padding = 10;
  const text = w.word;
  const txtW = textWidth(text, size);
  const cardW = txtW + padding * 2;
  const cardH = GLYPH_H * size + padding * 2;
  const cardX = Math.round(w.x + (16 * PIXEL) / 2 - cardW / 2);
  const cardY = Math.round(w.y + 16 * PIXEL + 8);
  // Card
  ctx.fillStyle = PAL.black;
  ctx.fillRect(cardX - 2, cardY - 2, cardW + 4, cardH + 4);
  ctx.fillStyle = PAL.white;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Letters: typed (green) vs not typed (dark)
  const startX = cardX + padding;
  const startY = cardY + padding;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const lx = startX + i * (GLYPH_W + 1) * size;
    const typed = i < w.typed.length;
    ctx.fillStyle = typed ? PAL.green : PAL.stoneDark;
    drawCharGlyph(ctx, ch, lx, startY, size);
    if (typed) {
      // Underline
      ctx.fillStyle = PAL.green;
      ctx.fillRect(lx, startY + GLYPH_H * size + 1, GLYPH_W * size, 2);
    }
  }
}

function drawCharGlyph(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  size: number,
) {
  const g = FONT[ch.toUpperCase()] ?? FONT["?"];
  for (let r = 0; r < GLYPH_H; r++) {
    const row = g[r];
    for (let c = 0; c < GLYPH_W; c++) {
      if (row[c] === "1") {
        ctx.fillRect(x + c * size, y + r * size, size, size);
      }
    }
  }
}

// ---------- Boss ----------
function drawBoss(ctx: CanvasRenderingContext2D, s: GameState) {
  // Big monkey throne behind
  const baseX = CANVAS_W - 220;
  const baseY = GROUND_Y - 220;
  // Throne base (brown bricks)
  ctx.fillStyle = PAL.brown;
  ctx.fillRect(baseX - 10, GROUND_Y - 40, 180, 40);
  ctx.fillStyle = "#5c3000";
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(baseX - 10 + i * 36, GROUND_Y - 40, 2, 40);
  }

  // Big pink puppy boss
  const bob = Math.sin(s.unicornBob * 0.5) * 4;
  const flicker = s.bossHurt > 0 && Math.floor(s.bossHurt * 20) % 2 === 0;
  ctx.save();
  if (flicker) ctx.filter = "brightness(2)";
  drawSprite(ctx, "puppyBoss", baseX, baseY + bob, 10);
  ctx.restore();

  // Tongue/mouth glow
  if (s.bossMouthGlow > 0) {
    ctx.fillStyle = "#bdf0fc";
    ctx.globalAlpha = s.bossMouthGlow;
    ctx.fillRect(baseX + 50, baseY + 110 + bob, 60, 30);
    ctx.globalAlpha = 1;
  }

  // Boss HP bar above
  const barX = baseX - 10;
  const barY = baseY - 20;
  const barW = 180;
  ctx.fillStyle = PAL.black;
  ctx.fillRect(barX - 2, barY - 2, barW + 4, 14);
  ctx.fillStyle = PAL.stoneDark;
  ctx.fillRect(barX, barY, barW, 10);
  const fill = Math.max(0, 1 - s.bossHits / BOSS_HITS_TO_WIN);
  ctx.fillStyle = PAL.hotPink;
  ctx.fillRect(barX, barY, Math.round(barW * fill), 10);

  drawText(ctx, "PINK PUPPY", barX, barY - 18, 2, PAL.white, PAL.textShadow);
}

function drawSnowball(ctx: CanvasRenderingContext2D, b: Snowball) {
  drawSprite(ctx, "snowball", Math.round(b.x), Math.round(b.y), PIXEL);
  // Word label centred above ball
  const size = 4;
  const txt = b.word;
  const txtW = textWidth(txt, size);
  const padding = 8;
  const cardW = txtW + padding * 2;
  const cardH = GLYPH_H * size + padding * 2;
  const cardX = Math.round(b.x + (16 * PIXEL) / 2 - cardW / 2);
  const cardY = Math.round(b.y - cardH - 6);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(cardX - 2, cardY - 2, cardW + 4, cardH + 4);
  ctx.fillStyle = "#bdf0fc";
  ctx.fillRect(cardX, cardY, cardW, cardH);
  const sx = cardX + padding;
  const sy = cardY + padding;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    const lx = sx + i * (GLYPH_W + 1) * size;
    const typed = i < b.typed.length;
    ctx.fillStyle = typed ? PAL.red : PAL.blue;
    drawCharGlyph(ctx, ch, lx, sy, size);
  }
}

// ---------- Overlays ----------
function drawTitle(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const pulse = 1 + Math.sin(t / 200) * 0.05;
  ctx.save();
  ctx.translate(CANVAS_W / 2, 120);
  ctx.scale(pulse, pulse);
  const titleSize = 8;
  const title = "UNICORN SPELLER";
  drawText(
    ctx,
    title,
    -textWidth(title, titleSize) / 2,
    -GLYPH_H * titleSize - 10,
    titleSize,
    PAL.yellow,
    PAL.textShadow,
  );
  ctx.restore();

  const sub = "RIDE. TYPE. DEFEAT THE PINK PUPPY!";
  drawText(ctx, sub, CANVAS_W / 2 - textWidth(sub, 4) / 2, 240, 4, PAL.white, PAL.textShadow);

  const hint = "PRESS ENTER OR TAP START";
  const hintBlink = Math.floor(t / 400) % 2 === 0;
  if (hintBlink) {
    drawText(
      ctx,
      hint,
      CANVAS_W / 2 - textWidth(hint, 3) / 2,
      300,
      3,
      PAL.cyan,
      PAL.textShadow,
    );
  }

  const inst1 = "TYPE THE WORD UNDER EACH OBJECT";
  const inst2 = "WRONG LETTER COSTS A HEART!";
  const inst3 = "FOUR LEVELS, THEN THE BOSS";
  drawText(ctx, inst1, CANVAS_W / 2 - textWidth(inst1, 2) / 2, 360, 2, PAL.white);
  drawText(ctx, inst2, CANVAS_W / 2 - textWidth(inst2, 2) / 2, 388, 2, PAL.pink);
  drawText(ctx, inst3, CANVAS_W / 2 - textWidth(inst3, 2) / 2, 416, 2, PAL.white);
}

function drawWinOverlay(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const t = "YOU WON!";
  drawText(ctx, t, CANVAS_W / 2 - textWidth(t, 10) / 2, 140, 10, PAL.yellow, PAL.textShadow);
  const sub = "PINK PUPPY DEFEATED!";
  drawText(ctx, sub, CANVAS_W / 2 - textWidth(sub, 4) / 2, 280, 4, PAL.white, PAL.textShadow);
  const sc = `SCORE: ${s.score}`;
  drawText(ctx, sc, CANVAS_W / 2 - textWidth(sc, 4) / 2, 340, 4, PAL.cyan, PAL.textShadow);
  const hint = "PRESS ENTER TO PLAY AGAIN";
  drawText(ctx, hint, CANVAS_W / 2 - textWidth(hint, 3) / 2, 420, 3, PAL.pink, PAL.textShadow);
}

function drawLoseOverlay(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = "rgba(40,0,0,0.6)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const t = "GAME OVER";
  drawText(ctx, t, CANVAS_W / 2 - textWidth(t, 9) / 2, 160, 9, PAL.red, PAL.textShadow);
  const sub = "TRY AGAIN, BRAVE RIDER!";
  drawText(ctx, sub, CANVAS_W / 2 - textWidth(sub, 4) / 2, 280, 4, PAL.white, PAL.textShadow);
  const sc = `SCORE: ${s.score}`;
  drawText(ctx, sc, CANVAS_W / 2 - textWidth(sc, 4) / 2, 340, 4, PAL.cyan, PAL.textShadow);
  const hint = "PRESS ENTER TO RESTART";
  drawText(ctx, hint, CANVAS_W / 2 - textWidth(hint, 3) / 2, 420, 3, PAL.pink, PAL.textShadow);
}

function drawLevelClear(ctx: CanvasRenderingContext2D, text: string) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 160, CANVAS_W, 200);
  drawText(
    ctx,
    text,
    CANVAS_W / 2 - textWidth(text, 8) / 2,
    220,
    8,
    PAL.yellow,
    PAL.textShadow,
  );
}
