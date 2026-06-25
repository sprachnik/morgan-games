"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import {
  ArrowDown,
  ArrowUp,
  Bird,
  Bug,
  Expand,
  Hammer,
  MousePointerClick,
  Pickaxe,
  RotateCcw,
  Sparkles,
  Wind,
} from "lucide-react";

import { cn } from "@/lib/utils";

const WORLD_W = 64;
const WORLD_D = 64;
const WORLD_H = 32;
const HALF_W = WORLD_W / 2;
const HALF_D = WORLD_D / 2;

const PLAYER_HALF = 0.3;
const PLAYER_HEIGHT = 1.75;
const EYE_HEIGHT = 1.6;
const WALK_SPEED = 5.5;
const JUMP_V = 8.4;
const GRAVITY = 22;
const FLY_V = 7;
const REACH = 5.2;
const MAX_PER_COLOR = 12000;

// Held mouse buttons re-fire on this cadence so a sweep paints/digs a few
// blocks per second rather than the full frame rate (which would tunnel
// through a wall in 1/3 of a second).
const DIG_INTERVAL = 0.12;
const BUILD_INTERVAL = 0.1;

const SAVE_KEY = "morgancraft-save-v1";
const SAVE_VERSION = 1;

const COLORS = [
  { name: "Red", hex: 0xff4d6d, css: "#ff4d6d" },
  { name: "Orange", hex: 0xff8c42, css: "#ff8c42" },
  { name: "Yellow", hex: 0xffd166, css: "#ffd166" },
  { name: "Green", hex: 0x5eea7e, css: "#5eea7e" },
  { name: "Blue", hex: 0x4cc9f0, css: "#4cc9f0" },
  { name: "Indigo", hex: 0x8b5cf6, css: "#8b5cf6" },
  { name: "Pink", hex: 0xff85e0, css: "#ff85e0" },
];

type CreatureKind = "butterfly" | "bird" | "unicorn";

type Key = `${number},${number},${number}`;
const k = (x: number, y: number, z: number): Key => `${x},${y},${z}`;

type SaveData = {
  v: number;
  voxels: [number, number, number, number][];
  selected: number;
};

function loadSaveFromStorage(): SaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveData | null;
    if (!parsed || parsed.v !== SAVE_VERSION || !Array.isArray(parsed.voxels)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistSaveToStorage(voxels: Map<Key, number>, selected: number) {
  if (typeof window === "undefined") return;
  try {
    const arr: [number, number, number, number][] = [];
    voxels.forEach((c, key) => {
      const [x, y, z] = key.split(",").map(Number);
      arr.push([x, y, z, c]);
    });
    const payload: SaveData = { v: SAVE_VERSION, voxels: arr, selected };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // Storage might be unavailable (private mode, quota) — silently skip.
  }
}

function clearSaveFromStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

type PerColor = {
  mesh: THREE.InstancedMesh;
  positions: { x: number; y: number; z: number; key: Key }[];
};

type SceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  raycaster: THREE.Raycaster;
  perColor: PerColor[];
  voxels: Map<Key, number>;
  player: {
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    yaw: number;
    pitch: number;
    onGround: boolean;
    flying: boolean;
  };
  keys: Set<string>;
  autoAction: () => boolean;
  buildAction: () => boolean;
  spawnCreature: (kind: CreatureKind) => void;
  toggleFly: () => void;
  resetScene: () => void;
  dispose: () => void;
};

type TouchInput = {
  joyActive: boolean;
  joyDX: number;
  joyDZ: number;
  jumpHeld: boolean;
  flyDownHeld: boolean;
};

type BuildSceneOpts = {
  save: SaveData | null;
  notifyChange: () => void;
  notifyFly: (flying: boolean) => void;
};

// Detect coarse-pointer / touch input. useSyncExternalStore keeps SSR safe
// (returns false on the server) and avoids a setState-in-effect to flip it on
// the client, which would trip the project's lint rule.
const subscribeTouch = () => () => {};
const getTouchSnapshot = () =>
  "ontouchstart" in window || navigator.maxTouchPoints > 0;
const getTouchServerSnapshot = () => false;

// Read the persisted selected colour once during render via useState's lazy
// initialiser — doing this in an effect would trip the project's
// react-hooks/set-state-in-effect rule. SSR returns 0 (loadSaveFromStorage
// guards against `window` being undefined), client returns the saved index
// so hydration produces the correct UI on first paint.
function initialSelectedFromStorage(): number {
  const save = loadSaveFromStorage();
  if (
    save &&
    Number.isInteger(save.selected) &&
    save.selected >= 0 &&
    save.selected < COLORS.length
  ) {
    return save.selected;
  }
  return 0;
}

export function Morgancraft() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const initialSelected = useState(initialSelectedFromStorage)[0];
  const selectedRef = useRef(initialSelected);
  const touchInputRef = useRef<TouchInput>({
    joyActive: false,
    joyDX: 0,
    joyDZ: 0,
    jumpHeld: false,
    flyDownHeld: false,
  });
  const [selected, setSelected] = useState(initialSelected);
  const [locked, setLocked] = useState(false);
  const [blockCount, setBlockCount] = useState(0);
  const [flying, setFlying] = useState(false);
  const isTouch = useSyncExternalStore(
    subscribeTouch,
    getTouchSnapshot,
    getTouchServerSnapshot,
  );
  const [joyKnob, setJoyKnob] = useState({ dx: 0, dy: 0, active: false });

  const joyZoneRef = useRef<HTMLDivElement>(null);
  const joyTouchIdRef = useRef<number | null>(null);
  const joyCenterRef = useRef({ cx: 0, cy: 0, r: 60 });

  const pickColor = useCallback((idx: number) => {
    selectedRef.current = idx;
    setSelected(idx);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const save = loadSaveFromStorage();
    const state = buildScene(container, selectedRef, touchInputRef, {
      save,
      notifyChange: () => setBlockCount(state.voxels.size),
      notifyFly: (f) => setFlying(f),
    });
    stateRef.current = state;

    const onLockChange = () => {
      setLocked(document.pointerLockElement === container);
    };
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      state.dispose();
      stateRef.current = null;
    };
  }, []);

  // Keyboard colour shortcuts work even when not pointer-locked so the kid can preview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isNaN(n) && n >= 1 && n <= COLORS.length) {
        pickColor(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickColor]);

  const requestLock = () => {
    if (isTouch) return;
    containerRef.current?.requestPointerLock();
  };

  const goFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const handleReset = () => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Wipe the rainbow world and start fresh? You'll lose every block you've placed.",
    );
    if (!ok) return;
    stateRef.current?.resetScene();
  };

  const handleToggleFly = () => stateRef.current?.toggleFly();
  const handleSpawn = (kind: CreatureKind) =>
    stateRef.current?.spawnCreature(kind);

  const updateJoy = useCallback((clientX: number, clientY: number) => {
    const { cx, cy, r } = joyCenterRef.current;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const mag = Math.hypot(dx, dy);
    if (mag > r) {
      dx = (dx / mag) * r;
      dy = (dy / mag) * r;
    }
    const nx = dx / r;
    const ny = dy / r;
    const dead = 0.18;
    const shape = (v: number) => {
      const a = Math.abs(v);
      if (a < dead) return 0;
      return Math.sign(v) * Math.min(1, (a - dead) / (1 - dead));
    };
    touchInputRef.current.joyDX = shape(nx);
    touchInputRef.current.joyDZ = shape(ny);
    touchInputRef.current.joyActive =
      touchInputRef.current.joyDX !== 0 || touchInputRef.current.joyDZ !== 0;
    setJoyKnob({ dx, dy, active: true });
  }, []);

  const releaseJoy = useCallback(() => {
    joyTouchIdRef.current = null;
    touchInputRef.current.joyActive = false;
    touchInputRef.current.joyDX = 0;
    touchInputRef.current.joyDZ = 0;
    setJoyKnob({ dx: 0, dy: 0, active: false });
  }, []);

  const onJoyTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (joyTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const rect = joyZoneRef.current?.getBoundingClientRect();
    if (!rect) return;
    joyCenterRef.current = {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      r: Math.min(rect.width, rect.height) / 2,
    };
    joyTouchIdRef.current = touch.identifier;
    updateJoy(touch.clientX, touch.clientY);
  };

  const onJoyTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches.item(i);
      if (t && t.identifier === joyTouchIdRef.current) {
        updateJoy(t.clientX, t.clientY);
        return;
      }
    }
  };

  const onJoyTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i);
      if (t && t.identifier === joyTouchIdRef.current) {
        releaseJoy();
        return;
      }
    }
  };

  const onJumpStart = (e: React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    touchInputRef.current.jumpHeld = true;
  };
  const onJumpEnd = (e: React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    touchInputRef.current.jumpHeld = false;
  };
  const onFlyDownStart = (e: React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    touchInputRef.current.flyDownHeld = true;
  };
  const onFlyDownEnd = (e: React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    touchInputRef.current.flyDownHeld = false;
  };

  const onDigPress = (e: React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stateRef.current?.autoAction();
  };
  const onBuildPress = (e: React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stateRef.current?.buildAction();
  };

  // In-canvas palette button: stop propagation so the container's
  // requestLock() click handler doesn't fire when picking a colour while
  // not yet locked.
  const onCanvasPaletteClick = (idx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    pickColor(idx);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div
        ref={containerRef}
        className="relative h-[70vh] min-h-[480px] w-full overflow-hidden rounded-3xl bg-black ring-4 ring-white/70 shadow-pop"
        onClick={() => !locked && requestLock()}
      >
        {/* Crosshair */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 select-none">
          <div className="relative">
            <div className="absolute -left-3 top-1/2 h-0.5 w-6 -translate-y-1/2 rounded-full bg-white/90 mix-blend-difference" />
            <div className="absolute left-1/2 -top-3 h-6 w-0.5 -translate-x-1/2 rounded-full bg-white/90 mix-blend-difference" />
          </div>
        </div>

        {/* Selected colour pill (top-left) */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white">
          <span
            className="inline-block size-4 rounded-sm ring-2 ring-white/80"
            style={{ background: COLORS[selected].css }}
          />
          {COLORS[selected].name}
          <span className="ml-2 text-xs text-white/70">{blockCount} blocks</span>
          {flying && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-sky-400/80 px-2 py-0.5 text-[11px] font-bold text-white">
              <Wind className="size-3" /> FLY
            </span>
          )}
        </div>

        {/* Top-right buttons */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFly();
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-white",
              flying ? "bg-sky-500/90 hover:bg-sky-500" : "bg-black/55 hover:bg-black/70",
            )}
            aria-pressed={flying}
          >
            <Wind className="size-4" />
            Fly
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goFullscreen();
            }}
            className="inline-flex items-center gap-1 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/70"
          >
            <Expand className="size-4" />
            Full screen
          </button>
        </div>

        {/* In-canvas colour palette (right-side, vertical). Lives inside the
            game area so it stays reachable in fullscreen and on touch where
            the palette below the canvas is off-screen. Desktop: visual
            reference — press 1-7 to pick. Touch: tappable. */}
        <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-full bg-black/45 p-1.5 ring-1 ring-white/15">
          {COLORS.map((c, i) => (
            <button
              key={c.name}
              type="button"
              onClick={onCanvasPaletteClick(i)}
              onTouchStart={(e) => {
                e.stopPropagation();
                pickColor(i);
              }}
              aria-label={`Pick ${c.name}`}
              aria-pressed={i === selected}
              className={cn(
                "relative size-8 rounded-full ring-2 transition-transform",
                i === selected
                  ? "scale-125 ring-white"
                  : "ring-white/40 hover:scale-110",
              )}
              style={{ background: c.css }}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 mix-blend-difference">
                {i + 1}
              </span>
            </button>
          ))}
        </div>

        {/* Click-to-play overlay (desktop only) */}
        {!locked && !isTouch && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 text-center text-white">
            <MousePointerClick className="size-12" />
            <p className="font-heading mt-3 text-3xl font-bold">Click to play</p>
            <p className="mt-2 max-w-md px-6 text-base font-semibold text-white/90">
              WASD walk · SPACE jump · MOUSE look · LEFT-CLICK dig · RIGHT-CLICK build · hold to keep going · F fly (SPACE up, CTRL down) · 1-7 picks a colour · ESC to pause
            </p>
          </div>
        )}

        {/* Touch controls */}
        {isTouch && (
          <>
            <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-center text-[11px] font-semibold text-white/90">
              Drag screen to look · joystick to walk
            </div>

            {/* Virtual joystick (bottom-left) */}
            <div
              ref={joyZoneRef}
              className="absolute bottom-5 left-5 z-20 size-36 touch-none select-none"
              onTouchStart={onJoyTouchStart}
              onTouchMove={onJoyTouchMove}
              onTouchEnd={onJoyTouchEnd}
              onTouchCancel={onJoyTouchEnd}
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-full bg-black/45 ring-2 transition-colors",
                  joyKnob.active ? "ring-white" : "ring-white/55",
                )}
              />
              <div
                className="absolute size-16 rounded-full bg-white/90 ring-2 ring-white shadow-pop-sm"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: `translate(calc(-50% + ${joyKnob.dx}px), calc(-50% + ${joyKnob.dy}px))`,
                }}
              />
            </div>

            {/* Action buttons (bottom-right) */}
            <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-3 touch-none select-none">
              <div className="flex gap-3">
                <button
                  type="button"
                  onTouchStart={onDigPress}
                  onContextMenu={(e) => e.preventDefault()}
                  className="flex size-16 items-center justify-center rounded-full bg-rose-500/90 text-white ring-2 ring-white/70 shadow-pop-sm active:scale-95"
                  aria-label="Dig"
                >
                  <Pickaxe className="size-7" />
                </button>
                <button
                  type="button"
                  onTouchStart={onBuildPress}
                  onContextMenu={(e) => e.preventDefault()}
                  className="flex size-16 items-center justify-center rounded-full text-white ring-2 ring-white/70 shadow-pop-sm active:scale-95"
                  aria-label="Build"
                  style={{ background: COLORS[selected].css }}
                >
                  <Hammer className="size-7" />
                </button>
              </div>
              <div className="flex gap-3">
                {flying && (
                  <button
                    type="button"
                    onTouchStart={onFlyDownStart}
                    onTouchEnd={onFlyDownEnd}
                    onTouchCancel={onFlyDownEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    className="flex h-14 w-32 items-center justify-center gap-1.5 rounded-full bg-indigo-400/95 text-base font-bold text-foreground ring-2 ring-white/70 shadow-pop-sm active:scale-95"
                    aria-label="Down"
                  >
                    <ArrowDown className="size-5" />
                    Down
                  </button>
                )}
                <button
                  type="button"
                  onTouchStart={onJumpStart}
                  onTouchEnd={onJumpEnd}
                  onTouchCancel={onJumpEnd}
                  onContextMenu={(e) => e.preventDefault()}
                  className="flex h-14 w-32 items-center justify-center gap-1.5 rounded-full bg-amber-400/95 text-base font-bold text-foreground ring-2 ring-white/70 shadow-pop-sm active:scale-95"
                  aria-label={flying ? "Up" : "Jump"}
                >
                  <ArrowUp className="size-5" />
                  {flying ? "Up" : "Jump"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Creature spawn row */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Make a friend
        </span>
        <button
          type="button"
          onClick={() => handleSpawn("butterfly")}
          className="inline-flex items-center gap-1 rounded-full bg-pink-200 px-3 py-1.5 text-sm font-bold text-foreground ring-2 ring-white/60 shadow-pop-sm transition-transform hover:-translate-y-0.5"
        >
          <Bug className="size-4" /> Butterfly
        </button>
        <button
          type="button"
          onClick={() => handleSpawn("bird")}
          className="inline-flex items-center gap-1 rounded-full bg-sky-200 px-3 py-1.5 text-sm font-bold text-foreground ring-2 ring-white/60 shadow-pop-sm transition-transform hover:-translate-y-0.5"
        >
          <Bird className="size-4" /> Bird
        </button>
        <button
          type="button"
          onClick={() => handleSpawn("unicorn")}
          className="inline-flex items-center gap-1 rounded-full bg-purple-200 px-3 py-1.5 text-sm font-bold text-foreground ring-2 ring-white/60 shadow-pop-sm transition-transform hover:-translate-y-0.5"
        >
          <Sparkles className="size-4" /> Unicorn
        </button>
      </div>

      {/* Below-canvas colour palette (kept for quick number reference). */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {COLORS.map((c, i) => (
          <button
            key={c.name}
            type="button"
            onClick={() => pickColor(i)}
            aria-pressed={i === selected}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl text-xs font-bold ring-4 transition-transform",
              i === selected
                ? "scale-110 ring-foreground"
                : "ring-white/70 hover:-translate-y-0.5",
            )}
            style={{ background: c.css }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <p className="text-center text-sm text-muted-foreground">
          {isTouch
            ? "Pickaxe digs, hammer builds. Tap Fly to float, hold Up/Down to move."
            : "Left-click digs, right-click builds. Hold either to keep going. Press F to fly."}
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1.5 text-sm font-bold text-rose-700 ring-2 ring-rose-200 hover:bg-rose-200"
        >
          <RotateCcw className="size-4" /> Reset world
        </button>
      </div>
    </div>
  );
}

function buildScene(
  container: HTMLDivElement,
  selectedRef: React.MutableRefObject<number>,
  touchInputRef: React.MutableRefObject<TouchInput>,
  opts: BuildSceneOpts,
): SceneState {
  const { save, notifyChange, notifyFly } = opts;

  // --- Audio (8-bit synth, lazily initialised on first action) ---
  let audioCtx: AudioContext | null = null;
  function getAudio(): AudioContext | null {
    if (audioCtx) return audioCtx;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    } catch {
      return null;
    }
    return audioCtx;
  }
  type Blip = {
    startFreq: number;
    endFreq: number;
    dur: number;
    type?: OscillatorType;
    vol?: number;
  };
  function blip({
    startFreq,
    endFreq,
    dur,
    type = "square",
    vol = 0.08,
  }: Blip) {
    const ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, endFreq),
      now + dur,
    );
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }
  function chord(notes: number[]) {
    notes.forEach((freq, i) => {
      setTimeout(
        () =>
          blip({
            startFreq: freq,
            endFreq: freq * 1.5,
            dur: 0.1,
            type: "triangle",
            vol: 0.06,
          }),
        i * 70,
      );
    });
  }
  const SFX = {
    dig: () => blip({ startFreq: 200, endFreq: 80, dur: 0.09, vol: 0.08 }),
    build: () => blip({ startFreq: 360, endFreq: 540, dur: 0.06, vol: 0.07 }),
    jump: () =>
      blip({
        startFreq: 360,
        endFreq: 720,
        dur: 0.05,
        type: "triangle",
        vol: 0.05,
      }),
    fly: () =>
      blip({
        startFreq: 520,
        endFreq: 820,
        dur: 0.12,
        type: "triangle",
        vol: 0.07,
      }),
    spawn: () => chord([523, 659, 784, 1046]),
  };

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const sizeCanvas = () => {
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";

  // --- Scene + camera ---
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xff9bd0, 50, 120);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
  sizeCanvas();

  // --- Skybox (rainbow gradient dome) ---
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0xff6fcf) },
      midColor: { value: new THREE.Color(0xff97e3) },
      horizonColor: { value: new THREE.Color(0xffe3c2) },
      groundColor: { value: new THREE.Color(0xd28af0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col;
        if (h >= 0.0) {
          float t = pow(h, 0.55);
          col = mix(horizonColor, midColor, smoothstep(0.0, 0.4, t));
          col = mix(col, topColor, smoothstep(0.4, 1.0, t));
        } else {
          col = mix(horizonColor, groundColor, smoothstep(0.0, 0.7, -h));
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMat);
  scene.add(sky);

  // --- Lights ---
  scene.add(new THREE.HemisphereLight(0xfff0fb, 0xb47ab3, 0.85));
  const sun = new THREE.DirectionalLight(0xfff5d1, 1.1);
  sun.position.set(40, 60, 30);
  scene.add(sun);
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
  );
  sunMesh.position.copy(sun.position).multiplyScalar(1.4);
  scene.add(sunMesh);

  // --- Clouds ---
  const clouds = new THREE.Group();
  const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  const cloudSeeds = [
    [-20, 22, -10, 6, 2, 4],
    [10, 26, -25, 8, 2, 3],
    [25, 24, 5, 5, 2, 3],
    [-5, 28, 18, 7, 2, 4],
    [-30, 25, 12, 4, 2, 3],
    [18, 23, 22, 6, 2, 4],
  ];
  for (const [cx, cy, cz, w, h, d] of cloudSeeds) {
    const m = new THREE.Mesh(cloudGeo, cloudMat);
    m.position.set(cx, cy, cz);
    m.scale.set(w, h, d);
    clouds.add(m);
  }
  scene.add(clouds);

  // --- World data ---
  const voxels = new Map<Key, number>();
  const tmpMatrix = new THREE.Matrix4();
  const perColor: PerColor[] = COLORS.map((c) => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: c.hex });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX_PER_COLOR);
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, positions: [] };
  });

  // --- Persistence ---
  // Disabled during initial load + reset so we don't write back what we just
  // read or thrash the store while rebuilding the plain.
  let saveEnabled = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSave() {
    if (!saveEnabled) return;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistSaveToStorage(voxels, selectedRef.current);
    }, 250);
  }

  function buildInitialPlain() {
    // Rainbow grid: every cell takes the next colour along the (x+z) diagonal
    // so neighbours always differ along both axes, producing a tiled rainbow
    // floor.
    const palette = COLORS.length;
    for (let x = -HALF_W; x < HALF_W; x++) {
      for (let z = -HALF_D; z < HALF_D; z++) {
        const colorIdx = (((x + z) % palette) + palette) % palette;
        addVoxel(x, 0, z, colorIdx);
      }
    }
  }

  if (save) {
    for (const [x, y, z, c] of save.voxels) {
      if (
        Number.isInteger(c) &&
        c >= 0 &&
        c < COLORS.length &&
        Number.isInteger(x) &&
        Number.isInteger(y) &&
        Number.isInteger(z)
      ) {
        addVoxel(x, y, z, c);
      }
    }
  } else {
    buildInitialPlain();
  }
  refreshAllInstances();
  saveEnabled = true;

  // --- Player ---
  const player = {
    pos: new THREE.Vector3(0, 6, 0),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: -0.2,
    onGround: false,
    flying: false,
  };
  syncCamera();

  // --- Raycast + highlights ---
  const raycaster = new THREE.Raycaster();
  raycaster.far = REACH;
  const meshes = perColor.map((p) => p.mesh);

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
    }),
  );
  outline.visible = false;
  outline.renderOrder = 999;
  scene.add(outline);

  const facePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.98),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  facePlane.visible = false;
  facePlane.renderOrder = 999;
  scene.add(facePlane);

  const _faceUp = new THREE.Vector3(0, 1, 0);
  const _faceTmp = new THREE.Vector3();
  function updateHighlight() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0 || !hits[0].face) {
      outline.visible = false;
      facePlane.visible = false;
      return;
    }
    const hit = hits[0];
    const n = hit.face!.normal;
    const inside = hit.point.clone().add(n.clone().multiplyScalar(-0.01));
    const bx = Math.floor(inside.x);
    const by = Math.floor(inside.y);
    const bz = Math.floor(inside.z);
    outline.position.set(bx + 0.5, by + 0.5, bz + 0.5);
    outline.visible = true;

    facePlane.position.set(
      bx + 0.5 + n.x * 0.51,
      by + 0.5 + n.y * 0.51,
      bz + 0.5 + n.z * 0.51,
    );
    _faceTmp.copy(facePlane.position).add(n);
    const up = Math.abs(n.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : _faceUp;
    facePlane.up.copy(up);
    facePlane.lookAt(_faceTmp);
    (facePlane.material as THREE.MeshBasicMaterial).color.setHex(
      COLORS[selectedRef.current].hex,
    );
    facePlane.visible = true;
  }

  // --- Actions ---
  function digAction(): boolean {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0 || !hits[0].face) return false;
    const hit = hits[0];
    const normal = hit.face!.normal;
    const inside = hit.point.clone().add(normal.clone().multiplyScalar(-0.01));
    const bx = Math.floor(inside.x);
    const by = Math.floor(inside.y);
    const bz = Math.floor(inside.z);
    const key = k(bx, by, bz);
    if (!voxels.has(key)) return false;
    const c = voxels.get(key) ?? 0;
    removeVoxel(bx, by, bz);
    spawnPuff(bx + 0.5, by + 0.5, bz + 0.5, c);
    notifyChange();
    scheduleSave();
    SFX.dig();
    return true;
  }

  function buildAction(): boolean {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0 || !hits[0].face) return false;
    const hit = hits[0];
    const outside = hit.point
      .clone()
      .add(hit.face!.normal.clone().multiplyScalar(0.01));
    const px = Math.floor(outside.x);
    const py = Math.floor(outside.y);
    const pz = Math.floor(outside.z);
    if (!withinBounds(px, py, pz)) return false;
    if (voxels.has(k(px, py, pz))) return false;
    if (intersectsPlayer(px, py, pz, player.pos)) return false;
    addVoxel(px, py, pz, selectedRef.current);
    perColor[selectedRef.current].mesh.instanceMatrix.needsUpdate = true;
    spawnPuff(px + 0.5, py + 0.5, pz + 0.5, selectedRef.current);
    notifyChange();
    scheduleSave();
    SFX.build();
    return true;
  }

  // Tap-on-canvas (touch) keeps the original "dig if on block, else build"
  // gesture so single-tap-to-build still works without two separate buttons.
  function autoAction(): boolean {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0 || !hits[0].face) return false;
    const hit = hits[0];
    const normal = hit.face!.normal;
    const inside = hit.point.clone().add(normal.clone().multiplyScalar(-0.01));
    const bx = Math.floor(inside.x);
    const by = Math.floor(inside.y);
    const bz = Math.floor(inside.z);
    const key = k(bx, by, bz);
    if (voxels.has(key)) {
      const c = voxels.get(key) ?? 0;
      removeVoxel(bx, by, bz);
      spawnPuff(bx + 0.5, by + 0.5, bz + 0.5, c);
      notifyChange();
      scheduleSave();
      SFX.dig();
      return true;
    }
    return buildAction();
  }

  // --- Mouse input + hold-to-repeat ---
  let diggingHeld = false;
  let placingHeld = false;
  let digCd = 0;
  let buildCd = 0;
  function onMouseDown(e: MouseEvent) {
    if (document.pointerLockElement !== container) return;
    e.preventDefault();
    if (e.button === 0) {
      diggingHeld = true;
      digAction();
      digCd = DIG_INTERVAL;
    } else if (e.button === 2) {
      placingHeld = true;
      buildAction();
      buildCd = BUILD_INTERVAL;
    }
  }
  function onMouseUp(e: MouseEvent) {
    if (e.button === 0) diggingHeld = false;
    else if (e.button === 2) placingHeld = false;
  }
  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
  }
  container.addEventListener("mousedown", onMouseDown);
  container.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("mouseup", onMouseUp);

  // --- Touch look + tap on the canvas ---
  const lookState = {
    id: -1,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    startT: 0,
  };
  function onCanvasTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (lookState.id !== -1) return;
    const t = e.changedTouches[0];
    if (!t) return;
    lookState.id = t.identifier;
    lookState.lastX = t.clientX;
    lookState.lastY = t.clientY;
    lookState.startX = t.clientX;
    lookState.startY = t.clientY;
    lookState.startT = performance.now();
  }
  function onCanvasTouchMove(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i);
      if (!t || t.identifier !== lookState.id) continue;
      const dx = t.clientX - lookState.lastX;
      const dy = t.clientY - lookState.lastY;
      lookState.lastX = t.clientX;
      lookState.lastY = t.clientY;
      player.yaw -= dx * 0.005;
      player.pitch -= dy * 0.005;
      const lim = Math.PI / 2 - 0.05;
      if (player.pitch > lim) player.pitch = lim;
      if (player.pitch < -lim) player.pitch = -lim;
      return;
    }
  }
  function onCanvasTouchEnd(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i);
      if (!t || t.identifier !== lookState.id) continue;
      const moved = Math.hypot(
        t.clientX - lookState.startX,
        t.clientY - lookState.startY,
      );
      const elapsed = performance.now() - lookState.startT;
      if (moved < 10 && elapsed < 250) autoAction();
      lookState.id = -1;
      return;
    }
  }
  const canvas = renderer.domElement;
  canvas.addEventListener("touchstart", onCanvasTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onCanvasTouchMove, { passive: false });
  canvas.addEventListener("touchend", onCanvasTouchEnd);
  canvas.addEventListener("touchcancel", onCanvasTouchEnd);

  // --- Pointer-lock look ---
  function onMouseMove(e: MouseEvent) {
    if (document.pointerLockElement !== container) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0022;
    const lim = Math.PI / 2 - 0.05;
    if (player.pitch > lim) player.pitch = lim;
    if (player.pitch < -lim) player.pitch = -lim;
  }
  document.addEventListener("mousemove", onMouseMove);

  // --- Keyboard ---
  const keys = new Set<string>();
  function toggleFly() {
    player.flying = !player.flying;
    player.vel.y = 0;
    notifyFly(player.flying);
    SFX.fly();
  }
  function onKeyDown(e: KeyboardEvent) {
    if (document.pointerLockElement !== container) return;
    keys.add(e.code);
    if (
      e.code === "Space" ||
      e.code === "KeyW" ||
      e.code === "KeyA" ||
      e.code === "KeyS" ||
      e.code === "KeyD" ||
      e.code === "ControlLeft" ||
      e.code === "ControlRight" ||
      e.code === "KeyF"
    ) {
      e.preventDefault();
    }
    if (e.code === "KeyF" && !e.repeat) {
      toggleFly();
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Drop held buttons + keys when the user pauses (ESC) so we don't
  // keep tunnelling after they unlock.
  function onLockChangeInternal() {
    if (document.pointerLockElement !== container) {
      diggingHeld = false;
      placingHeld = false;
      keys.clear();
    }
  }
  document.addEventListener("pointerlockchange", onLockChangeInternal);

  // --- Resize ---
  const ro = new ResizeObserver(() => sizeCanvas());
  ro.observe(container);

  // --- Particles ---
  const PARTICLE_CAP = 400;
  const particleData = new Float32Array(PARTICLE_CAP * 8);
  let particleCount = 0;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_CAP * 3);
  const colorAttr = new Float32Array(PARTICLE_CAP * 3);
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute("color", new THREE.BufferAttribute(colorAttr, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  particles.frustumCulled = false;
  scene.add(particles);

  function spawnPuff(x: number, y: number, z: number, colorIdx: number) {
    const baseColor = new THREE.Color(COLORS[colorIdx].hex);
    for (let i = 0; i < 16; i++) {
      if (particleCount >= PARTICLE_CAP) break;
      const idx = particleCount * 8;
      particleData[idx] = x;
      particleData[idx + 1] = y;
      particleData[idx + 2] = z;
      particleData[idx + 3] = (Math.random() - 0.5) * 3;
      particleData[idx + 4] = 1 + Math.random() * 2.5;
      particleData[idx + 5] = (Math.random() - 0.5) * 3;
      particleData[idx + 6] = 0.5 + Math.random() * 0.4;
      particleData[idx + 7] = 0;
      const ci = particleCount * 3;
      colorAttr[ci] = baseColor.r;
      colorAttr[ci + 1] = baseColor.g;
      colorAttr[ci + 2] = baseColor.b;
      particleCount++;
    }
    particleGeo.attributes.color.needsUpdate = true;
  }

  function updateParticles(dt: number) {
    let write = 0;
    for (let i = 0; i < particleCount; i++) {
      const base = i * 8;
      const life = particleData[base + 6] - dt;
      if (life <= 0) continue;
      const x = particleData[base] + particleData[base + 3] * dt;
      const y = particleData[base + 1] + particleData[base + 4] * dt;
      const z = particleData[base + 2] + particleData[base + 5] * dt;
      const vy = particleData[base + 4] - 9 * dt;
      const wBase = write * 8;
      particleData[wBase] = x;
      particleData[wBase + 1] = y;
      particleData[wBase + 2] = z;
      particleData[wBase + 3] = particleData[base + 3];
      particleData[wBase + 4] = vy;
      particleData[wBase + 5] = particleData[base + 5];
      particleData[wBase + 6] = life;
      particleData[wBase + 7] = particleData[base + 7];
      const srcCi = i * 3;
      const dstCi = write * 3;
      colorAttr[dstCi] = colorAttr[srcCi];
      colorAttr[dstCi + 1] = colorAttr[srcCi + 1];
      colorAttr[dstCi + 2] = colorAttr[srcCi + 2];
      positions[write * 3] = x;
      positions[write * 3 + 1] = y;
      positions[write * 3 + 2] = z;
      write++;
    }
    particleCount = write;
    for (let i = write; i < PARTICLE_CAP; i++) {
      const pi = i * 3;
      positions[pi] = 0;
      positions[pi + 1] = -1000;
      positions[pi + 2] = 0;
    }
    particleGeo.attributes.position.needsUpdate = true;
    particleGeo.attributes.color.needsUpdate = true;
    particleGeo.setDrawRange(0, particleCount);
  }

  // --- Voxel mutation ---
  function addVoxel(x: number, y: number, z: number, colorIdx: number) {
    const key = k(x, y, z);
    if (voxels.has(key)) return;
    voxels.set(key, colorIdx);
    const pc = perColor[colorIdx];
    const slot = pc.positions.length;
    if (slot >= MAX_PER_COLOR) return;
    pc.positions.push({ x, y, z, key });
    tmpMatrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
    pc.mesh.setMatrixAt(slot, tmpMatrix);
    pc.mesh.count = pc.positions.length;
    pc.mesh.instanceMatrix.needsUpdate = true;
  }

  function removeVoxel(x: number, y: number, z: number) {
    const key = k(x, y, z);
    const colorIdx = voxels.get(key);
    if (colorIdx === undefined) return;
    voxels.delete(key);
    const pc = perColor[colorIdx];
    const idx = pc.positions.findIndex((p) => p.key === key);
    if (idx === -1) return;
    const last = pc.positions.length - 1;
    if (idx !== last) {
      const swap = pc.positions[last];
      pc.positions[idx] = swap;
      tmpMatrix.makeTranslation(swap.x + 0.5, swap.y + 0.5, swap.z + 0.5);
      pc.mesh.setMatrixAt(idx, tmpMatrix);
    }
    pc.positions.pop();
    pc.mesh.count = pc.positions.length;
    pc.mesh.instanceMatrix.needsUpdate = true;
  }

  function refreshAllInstances() {
    for (const pc of perColor) {
      for (let i = 0; i < pc.positions.length; i++) {
        const p = pc.positions[i];
        tmpMatrix.makeTranslation(p.x + 0.5, p.y + 0.5, p.z + 0.5);
        pc.mesh.setMatrixAt(i, tmpMatrix);
      }
      pc.mesh.count = pc.positions.length;
      pc.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // --- Helpers ---
  function withinBounds(x: number, y: number, z: number) {
    return (
      x >= -HALF_W &&
      x < HALF_W &&
      z >= -HALF_D &&
      z < HALF_D &&
      y >= 0 &&
      y < WORLD_H
    );
  }
  function intersectsPlayer(
    bx: number,
    by: number,
    bz: number,
    pos: THREE.Vector3,
  ) {
    const minX = pos.x - PLAYER_HALF;
    const maxX = pos.x + PLAYER_HALF;
    const minY = pos.y;
    const maxY = pos.y + PLAYER_HEIGHT;
    const minZ = pos.z - PLAYER_HALF;
    const maxZ = pos.z + PLAYER_HALF;
    return (
      bx + 1 > minX &&
      bx < maxX &&
      by + 1 > minY &&
      by < maxY &&
      bz + 1 > minZ &&
      bz < maxZ
    );
  }
  function syncCamera() {
    camera.position.set(player.pos.x, player.pos.y + EYE_HEIGHT, player.pos.z);
    const e = new THREE.Euler(player.pitch, player.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(e);
  }

  // --- Physics step ---
  function moveAxis(axis: "x" | "y" | "z", delta: number) {
    player.pos[axis] += delta;
    const minX = Math.floor(player.pos.x - PLAYER_HALF);
    const maxX = Math.floor(player.pos.x + PLAYER_HALF - 1e-4);
    const minY = Math.floor(player.pos.y);
    const maxY = Math.floor(player.pos.y + PLAYER_HEIGHT - 1e-4);
    const minZ = Math.floor(player.pos.z - PLAYER_HALF);
    const maxZ = Math.floor(player.pos.z + PLAYER_HALF - 1e-4);
    let collided = false;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (voxels.has(k(x, y, z))) {
            collided = true;
            if (axis === "x") {
              if (delta > 0) player.pos.x = x - PLAYER_HALF - 1e-4;
              else player.pos.x = x + 1 + PLAYER_HALF + 1e-4;
              player.vel.x = 0;
            } else if (axis === "y") {
              if (delta > 0) {
                player.pos.y = y - PLAYER_HEIGHT - 1e-4;
                player.vel.y = 0;
              } else {
                player.pos.y = y + 1 + 1e-4;
                player.vel.y = 0;
                player.onGround = true;
              }
            } else {
              if (delta > 0) player.pos.z = z - PLAYER_HALF - 1e-4;
              else player.pos.z = z + 1 + PLAYER_HALF + 1e-4;
              player.vel.z = 0;
            }
            break;
          }
        }
        if (collided) break;
      }
      if (collided) break;
    }
    if (!collided && axis === "y" && delta < 0) {
      player.onGround = false;
    }
    if (axis === "y" && player.pos.y < 0) {
      player.pos.y = 0;
      player.vel.y = 0;
      player.onGround = true;
    }
    if (axis === "x") {
      const min = -HALF_W + PLAYER_HALF;
      const max = HALF_W - PLAYER_HALF;
      if (player.pos.x < min) {
        player.pos.x = min;
        player.vel.x = 0;
      } else if (player.pos.x > max) {
        player.pos.x = max;
        player.vel.x = 0;
      }
    } else if (axis === "z") {
      const min = -HALF_D + PLAYER_HALF;
      const max = HALF_D - PLAYER_HALF;
      if (player.pos.z < min) {
        player.pos.z = min;
        player.vel.z = 0;
      } else if (player.pos.z > max) {
        player.pos.z = max;
        player.vel.z = 0;
      }
    }
  }

  // --- Creatures ---
  type Creature = {
    group: THREE.Group;
    update: (dt: number, elapsed: number) => void;
    dispose: () => void;
  };
  const creatures: Creature[] = [];

  function makeButterfly(x: number, y: number, z: number): Creature {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a1d3a });
    const bodyGeo = new THREE.BoxGeometry(0.18, 0.18, 0.6);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);
    const wingGeoTop = new THREE.BoxGeometry(0.6, 0.04, 0.5);
    const wingGeoBot = new THREE.BoxGeometry(0.5, 0.04, 0.4);
    const palette = [0xff85e0, 0xffd166, 0x4cc9f0, 0x5eea7e, 0xff4d6d];
    const cA = palette[Math.floor(Math.random() * palette.length)];
    const cB = palette[Math.floor(Math.random() * palette.length)];
    const wMatA = new THREE.MeshLambertMaterial({ color: cA });
    const wMatB = new THREE.MeshLambertMaterial({ color: cB });
    const wTopL = new THREE.Mesh(wingGeoTop, wMatA);
    const wTopR = new THREE.Mesh(wingGeoTop, wMatA);
    const wBotL = new THREE.Mesh(wingGeoBot, wMatB);
    const wBotR = new THREE.Mesh(wingGeoBot, wMatB);
    wTopL.position.set(-0.35, 0, -0.05);
    wTopR.position.set(0.35, 0, -0.05);
    wBotL.position.set(-0.3, 0, 0.2);
    wBotR.position.set(0.3, 0, 0.2);
    const pivotL = new THREE.Group();
    const pivotR = new THREE.Group();
    pivotL.add(wTopL);
    pivotL.add(wBotL);
    pivotR.add(wTopR);
    pivotR.add(wBotR);
    group.add(pivotL);
    group.add(pivotR);
    const startX = x;
    const startY = y;
    const startZ = z;
    let t0 = 0;
    return {
      group,
      update: (dt, elapsed) => {
        t0 += dt;
        const flap = Math.sin(elapsed * 18);
        pivotL.rotation.z = flap * 1.1;
        pivotR.rotation.z = -flap * 1.1;
        const r = 3.5;
        group.position.x = startX + Math.cos(t0 * 0.7) * r;
        group.position.z = startZ + Math.sin(t0 * 0.7) * r;
        group.position.y = startY + Math.sin(elapsed * 0.9) * 0.6;
        group.rotation.y = -t0 * 0.7 + Math.PI / 2;
      },
      dispose: () => {
        bodyGeo.dispose();
        wingGeoTop.dispose();
        wingGeoBot.dispose();
        bodyMat.dispose();
        wMatA.dispose();
        wMatB.dispose();
      },
    };
  }

  function makeBird(x: number, y: number, z: number): Creature {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4cc9f0 });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0xff8c42 });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x050038 });
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.45, 0.7);
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const beakGeo = new THREE.BoxGeometry(0.12, 0.12, 0.25);
    const wingGeo = new THREE.BoxGeometry(0.6, 0.06, 0.5);
    const tailGeo = new THREE.BoxGeometry(0.3, 0.05, 0.4);
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 0.3, -0.45);
    const beak = new THREE.Mesh(beakGeo, accentMat);
    beak.position.set(0, 0.27, -0.75);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.15, 0.4, -0.6);
    eyeR.position.set(0.15, 0.4, -0.6);
    const tail = new THREE.Mesh(tailGeo, accentMat);
    tail.position.set(0, 0, 0.5);

    const wingL = new THREE.Mesh(wingGeo, bodyMat);
    const wingR = new THREE.Mesh(wingGeo, bodyMat);
    wingL.position.set(-0.35, 0.1, 0);
    wingR.position.set(0.35, 0.1, 0);
    const pivotL = new THREE.Group();
    const pivotR = new THREE.Group();
    pivotL.add(wingL);
    pivotR.add(wingR);

    group.add(body, head, beak, eyeL, eyeR, tail, pivotL, pivotR);

    const startY = y;
    let t0 = 0;
    return {
      group,
      update: (dt, elapsed) => {
        t0 += dt;
        const flap = Math.sin(elapsed * 9);
        pivotL.rotation.z = flap * 0.8;
        pivotR.rotation.z = -flap * 0.8;
        const r = 7;
        const speed = 0.4;
        group.position.x = x + Math.cos(t0 * speed) * r;
        group.position.z = z + Math.sin(t0 * speed) * r;
        group.position.y = startY + 2 + Math.sin(elapsed * 0.8) * 0.4;
        group.rotation.y = -t0 * speed + Math.PI / 2;
      },
      dispose: () => {
        [bodyGeo, headGeo, beakGeo, wingGeo, tailGeo, eyeGeo].forEach((g) =>
          g.dispose(),
        );
        [bodyMat, accentMat, eyeMat].forEach((m) => m.dispose());
      },
    };
  }

  function makeUnicorn(x: number, y: number, z: number): Creature {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xfff0fb });
    const hornMat = new THREE.MeshLambertMaterial({ color: 0xffd166 });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x050038 });
    const maneMats = [
      new THREE.MeshLambertMaterial({ color: 0xff4d6d }),
      new THREE.MeshLambertMaterial({ color: 0xff8c42 }),
      new THREE.MeshLambertMaterial({ color: 0xffd166 }),
      new THREE.MeshLambertMaterial({ color: 0x5eea7e }),
      new THREE.MeshLambertMaterial({ color: 0x4cc9f0 }),
      new THREE.MeshLambertMaterial({ color: 0x8b5cf6 }),
    ];
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.7, 1.3);
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.6);
    const snoutGeo = new THREE.BoxGeometry(0.35, 0.35, 0.25);
    const legGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
    const hornGeo = new THREE.ConeGeometry(0.1, 0.45, 6);
    const earGeo = new THREE.BoxGeometry(0.12, 0.2, 0.08);
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const tailGeo = new THREE.BoxGeometry(0.16, 0.5, 0.16);
    const maneGeo = new THREE.BoxGeometry(0.5, 0.18, 0.18);

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.85;
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 1.3, -0.85);
    const snout = new THREE.Mesh(snoutGeo, bodyMat);
    snout.position.set(0, 1.2, -1.18);
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(0, 1.75, -0.85);
    horn.rotation.x = -0.2;
    const earL = new THREE.Mesh(earGeo, bodyMat);
    const earR = new THREE.Mesh(earGeo, bodyMat);
    earL.position.set(-0.18, 1.62, -0.75);
    earR.position.set(0.18, 1.62, -0.75);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.18, 1.35, -1.05);
    eyeR.position.set(0.18, 1.35, -1.05);

    group.add(body, head, snout, horn, earL, earR, eyeL, eyeR);

    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(maneGeo, maneMats[i]);
      m.position.set(0, 1.45 - i * 0.08, -0.55 + i * 0.05);
      group.add(m);
    }
    const tail = new THREE.Mesh(tailGeo, maneMats[0]);
    tail.position.set(0, 0.85, 0.7);
    tail.rotation.x = 0.3;
    group.add(tail);

    const legPositions: [number, number, number][] = [
      [-0.22, 0.35, -0.45],
      [0.22, 0.35, -0.45],
      [-0.22, 0.35, 0.45],
      [0.22, 0.35, 0.45],
    ];
    const legPivots: THREE.Group[] = [];
    for (const [lx, ly, lz] of legPositions) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, ly + 0.35, lz);
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.y = -0.35;
      pivot.add(leg);
      group.add(pivot);
      legPivots.push(pivot);
    }

    const startY = y;
    let t0 = 0;
    let dir = Math.random() * Math.PI * 2;
    let nextTurn = 2 + Math.random() * 3;
    const speed = 1.8;
    return {
      group,
      update: (dt, elapsed) => {
        t0 += dt;
        const swing = Math.sin(elapsed * 6);
        legPivots[0].rotation.x = swing * 0.6;
        legPivots[3].rotation.x = swing * 0.6;
        legPivots[1].rotation.x = -swing * 0.6;
        legPivots[2].rotation.x = -swing * 0.6;
        if (t0 > nextTurn) {
          dir += (Math.random() - 0.5) * 1.5;
          nextTurn = t0 + 2 + Math.random() * 3;
        }
        const nx = group.position.x + Math.sin(dir) * speed * dt;
        const nz = group.position.z + Math.cos(dir) * speed * dt;
        const lim = HALF_W - 2;
        if (Math.abs(nx) < lim && Math.abs(nz) < lim) {
          group.position.x = nx;
          group.position.z = nz;
        } else {
          dir += Math.PI;
        }
        group.position.y = startY + Math.abs(Math.sin(elapsed * 6)) * 0.05;
        group.rotation.y = dir + Math.PI;
      },
      dispose: () => {
        [
          bodyGeo,
          headGeo,
          snoutGeo,
          legGeo,
          hornGeo,
          earGeo,
          eyeGeo,
          tailGeo,
          maneGeo,
        ].forEach((g) => g.dispose());
        [bodyMat, hornMat, eyeMat].forEach((m) => m.dispose());
        maneMats.forEach((m) => m.dispose());
      },
    };
  }

  function spawnCreature(kind: CreatureKind) {
    const dirX = -Math.sin(player.yaw);
    const dirZ = -Math.cos(player.yaw);
    const offset = 3.5;
    const cx = player.pos.x + dirX * offset;
    const cz = player.pos.z + dirZ * offset;
    let creature: Creature;
    if (kind === "butterfly") {
      creature = makeButterfly(cx, player.pos.y + 1.5, cz);
    } else if (kind === "bird") {
      creature = makeBird(cx, player.pos.y + 3, cz);
    } else {
      // Unicorn group origin = feet level; stand on the rainbow plain.
      creature = makeUnicorn(cx, 1, cz);
    }
    scene.add(creature.group);
    creatures.push(creature);
    SFX.spawn();
  }

  // --- Reset ---
  function resetScene() {
    saveEnabled = false;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    voxels.clear();
    for (const pc of perColor) {
      pc.positions.length = 0;
      pc.mesh.count = 0;
      pc.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const c of creatures) {
      scene.remove(c.group);
      c.dispose();
    }
    creatures.length = 0;
    buildInitialPlain();
    refreshAllInstances();
    player.pos.set(0, 6, 0);
    player.vel.set(0, 0, 0);
    player.yaw = 0;
    player.pitch = -0.2;
    if (player.flying) {
      player.flying = false;
      notifyFly(false);
    }
    syncCamera();
    clearSaveFromStorage();
    notifyChange();
    saveEnabled = true;
  }

  // --- Loop ---
  let last = performance.now();
  let rafId = 0;
  let elapsed = 0;
  function frame(t: number) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    elapsed += dt;

    let mx = 0;
    let mz = 0;
    const ti = touchInputRef.current;
    if (ti.joyActive) {
      mx = ti.joyDX;
      mz = ti.joyDZ;
    } else {
      if (keys.has("KeyW")) mz -= 1;
      if (keys.has("KeyS")) mz += 1;
      if (keys.has("KeyA")) mx -= 1;
      if (keys.has("KeyD")) mx += 1;
    }
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }
    const cos = Math.cos(player.yaw);
    const sin = Math.sin(player.yaw);
    const wishX = mx * cos + mz * sin;
    const wishZ = -mx * sin + mz * cos;
    const target = WALK_SPEED;
    player.vel.x = wishX * target;
    player.vel.z = wishZ * target;

    if (player.flying) {
      let vy = 0;
      if (keys.has("Space") || ti.jumpHeld) vy += FLY_V;
      if (
        keys.has("ControlLeft") ||
        keys.has("ControlRight") ||
        ti.flyDownHeld
      ) {
        vy -= FLY_V;
      }
      player.vel.y = vy;
      player.onGround = false;
    } else {
      if ((keys.has("Space") || ti.jumpHeld) && player.onGround) {
        player.vel.y = JUMP_V;
        player.onGround = false;
        SFX.jump();
      }
      player.vel.y -= GRAVITY * dt;
    }

    moveAxis("x", player.vel.x * dt);
    moveAxis("z", player.vel.z * dt);
    moveAxis("y", player.vel.y * dt);

    syncCamera();
    updateHighlight();

    // Held mouse: re-trigger at intervals while pointer is locked.
    if (document.pointerLockElement === container) {
      digCd -= dt;
      buildCd -= dt;
      if (diggingHeld && digCd <= 0) {
        digCd = digAction() ? DIG_INTERVAL : 0.05;
      }
      if (placingHeld && buildCd <= 0) {
        buildCd = buildAction() ? BUILD_INTERVAL : 0.05;
      }
    }

    clouds.position.x = ((t * 0.001) % 200) - 100;

    for (const cr of creatures) cr.update(dt, elapsed);

    updateParticles(dt);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  return {
    scene,
    camera,
    renderer,
    raycaster,
    perColor,
    voxels,
    player,
    keys,
    autoAction,
    buildAction,
    spawnCreature,
    toggleFly,
    resetScene,
    dispose: () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChangeInternal);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("touchstart", onCanvasTouchStart);
      canvas.removeEventListener("touchmove", onCanvasTouchMove);
      canvas.removeEventListener("touchend", onCanvasTouchEnd);
      canvas.removeEventListener("touchcancel", onCanvasTouchEnd);
      ro.disconnect();
      if (document.pointerLockElement === container) document.exitPointerLock();
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      persistSaveToStorage(voxels, selectedRef.current);
      for (const pc of perColor) {
        pc.mesh.geometry.dispose();
        (pc.mesh.material as THREE.Material).dispose();
        scene.remove(pc.mesh);
      }
      for (const c of creatures) {
        scene.remove(c.group);
        c.dispose();
      }
      creatures.length = 0;
      particleGeo.dispose();
      particleMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      outline.geometry.dispose();
      (outline.material as THREE.Material).dispose();
      facePlane.geometry.dispose();
      (facePlane.material as THREE.Material).dispose();
      sky.geometry.dispose();
      skyMat.dispose();
      renderer.dispose();
      if (audioCtx) {
        void audioCtx.close();
      }
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
