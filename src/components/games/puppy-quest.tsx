"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flame,
  Heart,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

const CANVAS_W = 900;
const CANVAS_H = 480;
const GROUND_Y = 380;
const RUN_GOAL = 7000;
const BASE_SPEED = 2.6;
const MAX_SPEED = 5.4;
const GRAVITY = 0.42;
const JUMP_V = 13;
const PLAYER_RUN_X = 220;
const PLAYER_MIN_X = 110;
const PLAYER_MAX_X = 720;
const SIDE_SPEED = 3.4;
const DRAGON_HITS_TO_WIN = 8;
const DRAGON_CHARGE_MS = 850;

type Phase = "ready" | "running" | "boss" | "won" | "lost";

type Obstacle = {
  x: number;
  kind: "rock" | "bramble" | "log" | "tall-rock";
  w: number;
  h: number;
  hit: boolean;
};

type Fireball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  kind: "arc" | "straight";
  hit: boolean;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  gravity: number;
};

type Input = {
  left: boolean;
  right: boolean;
};

type GameState = {
  phase: Phase;
  worldOffset: number;
  worldSpeed: number;
  playerX: number;
  playerVx: number; // forward boost from jumps, decays toward 0
  playerY: number;
  playerVy: number;
  obstacles: Obstacle[];
  fireballs: Fireball[];
  particles: Particle[];
  hearts: number;
  invuln: number;
  spawnTimer: number;
  bossTimer: number;
  fireCooldown: number;
  dragonCharging: number; // ms remaining in charge before firing
  dragonMouthGlow: number;
  dragonHits: number; // how many fireballs successfully dodged
  dragonShake: number;
  shake: number;
};

function newGameState(): GameState {
  return {
    phase: "ready",
    worldOffset: 0,
    worldSpeed: BASE_SPEED,
    playerX: PLAYER_RUN_X,
    playerVx: 0,
    playerY: 0,
    playerVy: 0,
    obstacles: [],
    fireballs: [],
    particles: [],
    hearts: 3,
    invuln: 0,
    spawnTimer: 1800,
    bossTimer: 0,
    fireCooldown: 1500,
    dragonCharging: 0,
    dragonMouthGlow: 0,
    dragonHits: 0,
    dragonShake: 0,
    shake: 0,
  };
}

export function PuppyQuest() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(newGameState());
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const inputRef = useRef<Input>({ left: false, right: false });
  const [, forceUi] = useReducer((x: number) => x + 1, 0);

  const reset = useCallback(() => {
    stateRef.current = { ...newGameState(), phase: "running" };
    lastTimeRef.current = null;
    forceUi();
  }, []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "ready" || s.phase === "won" || s.phase === "lost") {
      reset();
      return;
    }
    if (s.playerY <= 0.5) {
      s.playerVy = JUMP_V;
      s.playerVx = 2.4; // forward hop momentum
      for (let i = 0; i < 10; i++) {
        s.particles.push({
          x: s.playerX - 10 + Math.random() * 40,
          y: GROUND_Y - 4,
          vx: -1 + Math.random() * 2,
          vy: -1 - Math.random() * 2,
          life: 0.7,
          color: `hsl(${320 + Math.random() * 40},90%,80%)`,
          size: 3 + Math.random() * 3,
          gravity: 0.18,
        });
      }
    }
  }, [reset]);

  const setSide = useCallback((dir: "left" | "right", on: boolean) => {
    inputRef.current[dir] = on;
  }, []);

  useEffect(() => {
    const isAction = (key: string) =>
      key === " " ||
      key === "ArrowUp" ||
      key === "Enter" ||
      key === "w" ||
      key === "W";
    const onDown = (e: KeyboardEvent) => {
      if (isAction(e.key)) {
        e.preventDefault();
        jump();
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        inputRef.current.left = true;
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        inputRef.current.right = true;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        inputRef.current.left = false;
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        inputRef.current.right = false;
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [jump]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const loop = (t: number) => {
      const last = lastTimeRef.current ?? t;
      const dt = Math.min(40, t - last);
      lastTimeRef.current = t;
      update(stateRef.current, inputRef.current, dt);
      draw(ctx, stateRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const i = setInterval(forceUi, 200);
    return () => clearInterval(i);
  }, []);

  const s = stateRef.current;
  const showOverlay = s.phase === "ready" || s.phase === "won" || s.phase === "lost";

  const progressLabel =
    s.phase === "boss"
      ? "Dragon"
      : s.phase === "won"
        ? "Victory"
        : s.phase === "lost"
          ? "Try Again"
          : "Adventure";

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

        {s.phase === "boss" ? (
          <DragonMeter hits={s.dragonHits} max={DRAGON_HITS_TO_WIN} />
        ) : (
          <div className="inline-flex items-baseline gap-3 rounded-full bg-card px-5 py-2.5 ring-4 ring-white/70 shadow-pop-sm">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {progressLabel}
            </span>
            <span className="font-heading text-2xl font-bold text-fun-magenta">
              {Math.floor(s.worldOffset / 10)}m
              <span className="ml-1 text-sm font-semibold text-muted-foreground">
                / {Math.floor(RUN_GOAL / 10)}m
              </span>
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={jump}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-bold text-primary-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
        >
          {s.phase === "ready" ? (
            <>
              <Sparkles className="size-5" strokeWidth={3} /> Start
            </>
          ) : s.phase === "won" || s.phase === "lost" ? (
            <>
              <RotateCcw className="size-5" strokeWidth={3} /> Play Again
            </>
          ) : (
            <>Jump!</>
          )}
        </button>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-3xl ring-4 ring-white/70 shadow-pop">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={(e) => {
            e.preventDefault();
            jump();
          }}
          className="block h-auto w-full cursor-pointer touch-none select-none"
        />
        {showOverlay && (
          <Overlay
            title={
              s.phase === "ready"
                ? "Ready, Morgan?"
                : s.phase === "won"
                  ? "You saved the kingdom!"
                  : "Oh no!"
            }
            subtitle={
              s.phase === "ready"
                ? "Ride your big pink puppy on a long adventure to the dragon's castle. Use ← → to steer and tap or SPACE to jump."
                : s.phase === "won"
                  ? "The dragon flew away! Hero of the day."
                  : "The dragon got us — let's try again!"
            }
            cta={s.phase === "ready" ? "Tap anywhere to start" : "Tap anywhere to play again"}
          />
        )}
      </div>

      <DirectionPad jump={jump} setSide={setSide} />

      <p className="mt-3 text-center text-sm text-muted-foreground">
        Tap or press SPACE / ↑ to jump.  Use ← → (or the buttons) to move.
      </p>
    </div>
  );
}

function DragonMeter({ hits, max }: { hits: number; max: number }) {
  const pct = Math.min(100, (hits / max) * 100);
  return (
    <div className="inline-flex min-w-[260px] flex-col gap-1 rounded-2xl bg-card px-5 py-2 ring-4 ring-white/70 shadow-pop-sm">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="inline-flex items-center gap-1 text-fun-red">
          <Flame className="size-4" /> Dragon
        </span>
        <span className="text-fun-magenta">
          {hits} / {max}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fun-magenta via-fun-red to-fun-yellow transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DirectionPad({
  jump,
  setSide,
}: {
  jump: () => void;
  setSide: (dir: "left" | "right", on: boolean) => void;
}) {
  const padButton =
    "inline-flex h-16 w-20 items-center justify-center rounded-2xl bg-card text-foreground ring-4 ring-white/70 shadow-pop-sm select-none touch-none active:translate-y-px";
  return (
    <div className="mt-4 grid grid-cols-3 gap-3 sm:flex sm:justify-center">
      <button
        type="button"
        aria-label="Move left"
        onPointerDown={(e) => {
          e.preventDefault();
          setSide("left", true);
        }}
        onPointerUp={() => setSide("left", false)}
        onPointerLeave={() => setSide("left", false)}
        onPointerCancel={() => setSide("left", false)}
        className={padButton}
      >
        <ArrowLeft className="size-8" strokeWidth={3} />
      </button>
      <button
        type="button"
        aria-label="Jump"
        onPointerDown={(e) => {
          e.preventDefault();
          jump();
        }}
        className={cn(padButton, "bg-primary text-primary-foreground")}
      >
        <ArrowUp className="size-8" strokeWidth={3} />
      </button>
      <button
        type="button"
        aria-label="Move right"
        onPointerDown={(e) => {
          e.preventDefault();
          setSide("right", true);
        }}
        onPointerUp={() => setSide("right", false)}
        onPointerLeave={() => setSide("right", false)}
        onPointerCancel={() => setSide("right", false)}
        className={padButton}
      >
        <ArrowRight className="size-8" strokeWidth={3} />
      </button>
    </div>
  );
}

function Overlay({
  title,
  subtitle,
  cta,
}: {
  title: string;
  subtitle: string;
  cta: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/35 px-6 text-center backdrop-blur-[2px]">
      <p className="font-heading text-4xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.35)] sm:text-6xl">
        {title}
      </p>
      <p className="mt-4 max-w-md text-lg font-semibold text-white/95 sm:text-xl">
        {subtitle}
      </p>
      <p className="mt-6 rounded-full bg-white/20 px-5 py-2 text-sm font-semibold text-white">
        {cta}
      </p>
    </div>
  );
}

// ---------- update ----------

function update(s: GameState, input: Input, dt: number) {
  s.dragonMouthGlow = Math.max(0, s.dragonMouthGlow - dt);
  s.shake = Math.max(0, s.shake - dt);
  s.dragonShake = Math.max(0, s.dragonShake - dt);

  for (const p of s.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.life -= dt / 700;
  }
  s.particles = s.particles.filter((p) => p.life > 0);

  if (s.phase !== "running" && s.phase !== "boss") return;

  // Horizontal movement (input + decaying jump momentum)
  let vx = s.playerVx;
  if (input.left) vx -= SIDE_SPEED;
  if (input.right) vx += SIDE_SPEED;
  s.playerX += vx * (dt / 16.67);
  // Decay forward jump momentum (faster decay once landed so it doesn't drift forever)
  const decayRate = s.playerY > 0 ? 0.97 : 0.86;
  s.playerVx *= Math.pow(decayRate, dt / 16.67);
  if (Math.abs(s.playerVx) < 0.05) s.playerVx = 0;
  if (s.playerX < PLAYER_MIN_X) s.playerX = PLAYER_MIN_X;
  if (s.playerX > PLAYER_MAX_X) s.playerX = PLAYER_MAX_X;

  // Vertical physics — floaty
  if (s.playerY > 0 || s.playerVy !== 0) {
    s.playerVy -= GRAVITY * (dt / 16.67);
    s.playerY += s.playerVy * (dt / 16.67);
    if (s.playerY <= 0) {
      s.playerY = 0;
      s.playerVy = 0;
    }
  }

  if (s.invuln > 0) s.invuln -= dt;

  if (s.phase === "running") {
    // Slower ramp from BASE_SPEED to MAX_SPEED across the full run distance.
    s.worldSpeed = Math.min(
      MAX_SPEED,
      BASE_SPEED + (s.worldOffset / RUN_GOAL) * (MAX_SPEED - BASE_SPEED),
    );
    s.worldOffset += s.worldSpeed * (dt / 16.67);

    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      spawnObstacle(s);
      const minGap = Math.max(1100, 2400 - (s.worldOffset / RUN_GOAL) * 1100);
      s.spawnTimer = minGap + Math.random() * 900;
    }

    for (const o of s.obstacles) o.x -= s.worldSpeed * (dt / 16.67);
    s.obstacles = s.obstacles.filter((o) => o.x > -200);

    if (s.invuln <= 0) {
      const hb = playerHitbox(s);
      for (const o of s.obstacles) {
        if (o.hit) continue;
        const ox = o.x - o.w * 0.45;
        const oy = GROUND_Y - o.h;
        const overlap =
          hb.x < ox + o.w * 0.85 &&
          hb.x + hb.w * 0.85 > ox + o.w * 0.1 &&
          hb.y + hb.h * 0.95 > oy + o.h * 0.25;
        if (overlap) {
          takeHit(s, o.x, GROUND_Y - o.h * 0.5);
          o.hit = true;
          if (s.hearts <= 0) {
            s.phase = "lost";
            break;
          }
        }
      }
    }

    if (s.worldOffset >= RUN_GOAL) {
      s.phase = "boss";
      s.obstacles = [];
      s.bossTimer = 0;
      s.fireCooldown = 1600;
      s.dragonCharging = 0;
      s.dragonMouthGlow = 0;
      s.dragonHits = 0;
    }
  } else if (s.phase === "boss") {
    s.bossTimer += dt;
    s.worldSpeed = 0;

    // Charge / fire cycle
    if (s.dragonCharging > 0) {
      s.dragonCharging -= dt;
      s.dragonMouthGlow = DRAGON_CHARGE_MS;
      if (s.dragonCharging <= 0) {
        spawnFireballs(s);
        const interval = Math.max(900, 2200 - s.dragonHits * 100);
        s.fireCooldown = interval + Math.random() * 400;
      }
    } else {
      s.fireCooldown -= dt;
      if (s.fireCooldown <= 0) {
        s.dragonCharging = DRAGON_CHARGE_MS;
      }
    }

    // Move fireballs (slower base speeds → easier to read)
    for (const f of s.fireballs) {
      f.x += f.vx * (dt / 16.67);
      f.y += f.vy * (dt / 16.67);
      if (f.kind === "arc") f.vy += 0.25 * (dt / 16.67);
      f.life += dt;
      if (Math.random() < 0.5) {
        s.particles.push({
          x: f.x + (-4 + Math.random() * 8),
          y: f.y + (-4 + Math.random() * 8),
          vx: -0.5 + Math.random(),
          vy: -0.5 + Math.random(),
          life: 0.7,
          color: `hsl(${15 + Math.random() * 30},95%,${55 + Math.random() * 15}%)`,
          size: 4 + Math.random() * 3,
          gravity: 0.05,
        });
      }
    }

    // Score successful dodges as fireballs leave the screen
    const survivors: Fireball[] = [];
    for (const f of s.fireballs) {
      const offScreen = f.y > GROUND_Y + 60 || f.x < -60;
      if (offScreen) {
        if (!f.hit) {
          s.dragonHits += 1;
          s.dragonShake = 350;
          // Small magic burst near dragon to show damage
          for (let i = 0; i < 12; i++) {
            s.particles.push({
              x: 640 + (Math.random() - 0.5) * 30,
              y: 150 + (Math.random() - 0.5) * 30,
              vx: -2 + Math.random() * 4,
              vy: -3 + Math.random() * 2,
              life: 1,
              color: `hsl(${290 + Math.random() * 60},95%,80%)`,
              size: 3 + Math.random() * 4,
              gravity: 0.2,
            });
          }
          if (s.dragonHits >= DRAGON_HITS_TO_WIN) {
            s.phase = "won";
            for (let i = 0; i < 90; i++) {
              s.particles.push({
                x: 200 + Math.random() * 500,
                y: 80 + Math.random() * 200,
                vx: -4 + Math.random() * 8,
                vy: -6 + Math.random() * 4,
                life: 1.5,
                color: `hsl(${300 + Math.random() * 80},95%,75%)`,
                size: 4 + Math.random() * 4,
                gravity: 0.15,
              });
            }
            break;
          }
        }
      } else {
        survivors.push(f);
      }
    }
    s.fireballs = survivors;

    if (s.invuln <= 0 && s.phase === "boss") {
      const hb = playerHitbox(s);
      const cx = hb.x + hb.w / 2;
      const cy = hb.y + hb.h / 2;
      const r = 36;
      for (const f of s.fireballs) {
        if (f.hit) continue;
        const dx = f.x - cx;
        const dy = f.y - cy;
        if (dx * dx + dy * dy < r * r) {
          takeHit(s, f.x, f.y);
          f.hit = true;
          if (s.hearts <= 0) {
            s.phase = "lost";
            break;
          }
        }
      }
    }
  }
}

function playerHitbox(s: GameState) {
  return {
    x: s.playerX - 32,
    y: GROUND_Y - 75 - s.playerY,
    w: 72,
    h: 75,
  };
}

function spawnObstacle(s: GameState) {
  const kinds: Obstacle["kind"][] = ["rock", "bramble", "log", "tall-rock"];
  // Tall rocks more common late in the level
  const lateBias = s.worldOffset / RUN_GOAL; // 0..1
  const r = Math.random();
  let kind: Obstacle["kind"];
  if (r < 0.3) kind = "rock";
  else if (r < 0.55) kind = "bramble";
  else if (r < 0.85) kind = "log";
  else kind = "tall-rock";
  if (lateBias > 0.6 && Math.random() < 0.25) kind = "tall-rock";

  const sizeRanges: Record<Obstacle["kind"], { w: [number, number]; h: [number, number] }> = {
    rock: { w: [40, 72], h: [32, 50] },
    bramble: { w: [55, 95], h: [28, 45] },
    log: { w: [80, 140], h: [22, 32] },
    "tall-rock": { w: [42, 60], h: [60, 88] },
  };
  const range = sizeRanges[kind];
  const w = range.w[0] + Math.random() * (range.w[1] - range.w[0]);
  const h = range.h[0] + Math.random() * (range.h[1] - range.h[0]);
  s.obstacles.push({ x: CANVAS_W + 80, kind, w, h, hit: false });
}

function spawnFireballs(s: GameState) {
  const dragonX = 640;
  const dragonY = 150;
  s.dragonMouthGlow = 350;

  // Arcing fireball aimed near (but not perfectly at) the player
  const targetX = s.playerX + (-50 + Math.random() * 100);
  const frames = 90; // slower than before
  const vx = (targetX - dragonX) / frames;
  const fallY = GROUND_Y - 30 - dragonY;
  const vy = (fallY - 0.5 * 0.25 * frames * frames) / frames;
  s.fireballs.push({
    x: dragonX,
    y: dragonY,
    vx,
    vy,
    life: 0,
    kind: "arc",
    hit: false,
  });

  // After a few dodges, occasionally add a straight slow one — easy to step aside from
  if (s.dragonHits >= 3 && Math.random() < 0.5) {
    s.fireballs.push({
      x: dragonX,
      y: dragonY + 30,
      vx: -4.5 - Math.random() * 1.5,
      vy: 0.4,
      life: 0,
      kind: "straight",
      hit: false,
    });
  }
}

function takeHit(s: GameState, x: number, y: number) {
  s.hearts -= 1;
  s.invuln = 1500;
  s.shake = 320;
  for (let i = 0; i < 20; i++) {
    s.particles.push({
      x,
      y,
      vx: -3 + Math.random() * 6,
      vy: -4 + Math.random() * 3,
      life: 1,
      color: `hsl(${340 + Math.random() * 30},95%,70%)`,
      size: 3 + Math.random() * 4,
      gravity: 0.3,
    });
  }
}

// ---------- draw ----------

function draw(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.save();
  if (s.shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * 6 * (s.shake / 320),
      (Math.random() - 0.5) * 6 * (s.shake / 320),
    );
  }

  drawSky(ctx, s);
  drawCelestial(ctx, s);
  if (s.phase === "boss") drawStars(ctx, s);

  drawMountains(ctx, -s.worldOffset * 0.18, 230, "#3c1564", 1);
  drawMountains(ctx, -s.worldOffset * 0.3 + 120, 270, "#7c2a8c", 1.2);

  drawCastle(ctx, s);

  drawHills(ctx, -s.worldOffset * 0.55, "#c61b6f");
  drawHills(ctx, -s.worldOffset * 0.78 + 60, "#e6428e");

  drawGround(ctx, s);

  for (const o of s.obstacles) drawObstacle(ctx, o);

  if (s.phase === "boss") drawDragon(ctx, s);

  drawPlayer(ctx, s);

  for (const f of s.fireballs) drawFireball(ctx, f);

  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Phase progress along the top during run
  if (s.phase === "running") drawRunProgress(ctx, s);

  ctx.restore();
}

function drawRunProgress(ctx: CanvasRenderingContext2D, s: GameState) {
  const pct = Math.min(1, s.worldOffset / RUN_GOAL);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(20, 20, CANVAS_W - 40, 10);
  ctx.fillStyle = "#ff5fa8";
  ctx.fillRect(20, 20, (CANVAS_W - 40) * pct, 10);
  // Castle icon at the end
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(CANVAS_W - 28, 25, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7c2a8c";
  ctx.fillRect(CANVAS_W - 32, 20, 8, 10);
  ctx.fillRect(CANVAS_W - 36, 18, 4, 4);
  ctx.fillRect(CANVAS_W - 28, 18, 4, 4);
  ctx.fillRect(CANVAS_W - 20, 18, 4, 4);
}

function drawSky(ctx: CanvasRenderingContext2D, s: GameState) {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  if (s.phase === "boss") {
    g.addColorStop(0, "#1c0834");
    g.addColorStop(0.45, "#5a1860");
    g.addColorStop(1, "#c4347d");
  } else {
    g.addColorStop(0, "#ff9bd0");
    g.addColorStop(0.55, "#ff66a8");
    g.addColorStop(1, "#ffd0e3");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawCelestial(ctx: CanvasRenderingContext2D, s: GameState) {
  if (s.phase === "boss") {
    ctx.fillStyle = "#fdf3c1";
    ctx.beginPath();
    ctx.arc(CANVAS_W - 120, 100, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.beginPath();
    ctx.arc(CANVAS_W - 110, 92, 10, 0, Math.PI * 2);
    ctx.arc(CANVAS_W - 132, 112, 7, 0, Math.PI * 2);
    ctx.arc(CANVAS_W - 105, 118, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(255,234,150,0.35)";
    ctx.beginPath();
    ctx.arc(CANVAS_W - 140, 105, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff2ad";
    ctx.beginPath();
    ctx.arc(CANVAS_W - 140, 105, 42, 0, Math.PI * 2);
    ctx.fill();

    const cloudX = ((s.worldOffset * 0.05) % (CANVAS_W + 240)) - 120;
    drawCloud(ctx, 220 - cloudX, 70);
    drawCloud(ctx, 560 - cloudX, 130);
    drawCloud(ctx, 880 - cloudX, 95);
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.arc(x + 20, y - 6, 22, 0, Math.PI * 2);
  ctx.arc(x + 44, y, 18, 0, Math.PI * 2);
  ctx.arc(x + 24, y + 8, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars(ctx: CanvasRenderingContext2D, s: GameState) {
  for (let i = 0; i < 50; i++) {
    const x = (i * 137) % CANVAS_W;
    const y = (i * 53) % 220;
    const tw = (Math.sin(s.bossTimer * 0.003 + i) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.35 + tw * 0.6})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawMountains(
  ctx: CanvasRenderingContext2D,
  offset: number,
  baseY: number,
  color: string,
  amp: number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  for (let x = 0; x <= CANVAS_W + 4; x += 4) {
    const wx = x - offset;
    const y =
      baseY -
      (60 * amp) *
        (Math.sin(wx * 0.0085) * 0.8 + Math.sin(wx * 0.022) * 0.4 + 0.2);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.closePath();
  ctx.fill();
}

function drawHills(
  ctx: CanvasRenderingContext2D,
  offset: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  for (let x = 0; x <= CANVAS_W + 4; x += 4) {
    const wx = x - offset;
    const y =
      GROUND_Y -
      10 -
      (45 * (Math.sin(wx * 0.011) + Math.sin(wx * 0.027) * 0.5) + 30);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.closePath();
  ctx.fill();
}

function drawCastle(ctx: CanvasRenderingContext2D, s: GameState) {
  let cx: number;
  if (s.phase === "boss") {
    cx = 600;
  } else {
    const remaining = RUN_GOAL - s.worldOffset;
    if (remaining > 600) return;
    cx = CANVAS_W + 80 - (600 - remaining) * 0.6;
    if (cx > CANVAS_W + 100) return;
  }
  const baseY = GROUND_Y - 10;
  ctx.fillStyle = "#9c2a8c";
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 4, 200, 50, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#bfbfd0";
  ctx.fillRect(cx - 110, baseY - 110, 220, 110);
  ctx.fillStyle = "#9595a8";
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(cx - 110 + i * 28, baseY - 122, 18, 12);
  }
  ctx.fillStyle = "#cfcfdd";
  ctx.fillRect(cx - 35, baseY - 200, 70, 200);
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(cx - 35 + i * 26, baseY - 212, 18, 12);
  }
  ctx.fillStyle = "#bfbfd0";
  ctx.fillRect(cx - 130, baseY - 160, 36, 160);
  ctx.fillRect(cx + 94, baseY - 160, 36, 160);
  for (let i = 0; i < 2; i++) {
    ctx.fillRect(cx - 130 + i * 20, baseY - 172, 12, 12);
    ctx.fillRect(cx + 94 + i * 20, baseY - 172, 12, 12);
  }
  ctx.fillStyle = "#d9264f";
  drawTriangle(ctx, cx - 35, baseY - 200, cx + 35, baseY - 200, cx, baseY - 250);
  drawTriangle(ctx, cx - 130, baseY - 160, cx - 94, baseY - 160, cx - 112, baseY - 198);
  drawTriangle(ctx, cx + 94, baseY - 160, cx + 130, baseY - 160, cx + 112, baseY - 198);
  ctx.fillStyle = "#3a1a26";
  ctx.beginPath();
  ctx.moveTo(cx - 22, baseY);
  ctx.lineTo(cx - 22, baseY - 40);
  ctx.quadraticCurveTo(cx, baseY - 60, cx + 22, baseY - 40);
  ctx.lineTo(cx + 22, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffe680";
  for (const wx of [cx - 80, cx - 60, cx + 60, cx + 80]) {
    ctx.fillRect(wx, baseY - 80, 10, 16);
  }
  ctx.fillStyle = "#3a1564";
  ctx.fillRect(cx - 1, baseY - 270, 2, 24);
  ctx.fillStyle = "#ff5fa8";
  ctx.beginPath();
  ctx.moveTo(cx + 1, baseY - 270);
  ctx.lineTo(cx + 20, baseY - 263);
  ctx.lineTo(cx + 1, baseY - 256);
  ctx.closePath();
  ctx.fill();
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, s: GameState) {
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_H);
  if (s.phase === "boss") {
    g.addColorStop(0, "#5a2879");
    g.addColorStop(1, "#2a0f3a");
  } else {
    g.addColorStop(0, "#7ed957");
    g.addColorStop(1, "#3a8a32");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
  ctx.fillStyle = s.phase === "boss" ? "#7a3a92" : "#4fa83a";
  ctx.fillRect(0, GROUND_Y, CANVAS_W, 4);

  const tuftSpacing = 38;
  const baseOffset = s.phase === "boss" ? 0 : s.worldOffset;
  const startWx = Math.floor(baseOffset / tuftSpacing) * tuftSpacing - tuftSpacing;
  for (let wx = startWx; wx < startWx + CANVAS_W + tuftSpacing * 2; wx += tuftSpacing) {
    const x = wx - baseOffset;
    if (x < -10 || x > CANVAS_W + 10) continue;
    const seed = ((wx * 9301 + 49297) % 233280) / 233280;
    ctx.strokeStyle = s.phase === "boss" ? "#a45fbf" : "#2e7a26";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 6);
    ctx.lineTo(x + 3, GROUND_Y - 4 - seed * 6);
    ctx.lineTo(x + 6, GROUND_Y + 6);
    ctx.stroke();
    if (seed < 0.22 && s.phase !== "boss") {
      const colors = ["#ff5fa8", "#ffe255", "#ffffff", "#c576ff"];
      ctx.fillStyle = colors[Math.floor(seed * 4 * 4) % 4];
      ctx.beginPath();
      ctx.arc(x + 3, GROUND_Y - 10 - seed * 6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff2ad";
      ctx.beginPath();
      ctx.arc(x + 3, GROUND_Y - 10 - seed * 6, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const baseY = GROUND_Y;
  ctx.save();
  ctx.translate(o.x, baseY);
  if (o.kind === "rock" || o.kind === "tall-rock") {
    ctx.fillStyle = "#7d6f86";
    ctx.beginPath();
    ctx.ellipse(0, -o.h * 0.5, o.w * 0.55, o.h * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a09aaa";
    ctx.beginPath();
    ctx.ellipse(-6, -o.h * 0.7, o.w * 0.32, o.h * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    if (o.kind === "tall-rock") {
      ctx.fillStyle = "#574c66";
      ctx.beginPath();
      ctx.ellipse(8, -o.h * 0.3, o.w * 0.3, o.h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (o.kind === "bramble") {
    ctx.fillStyle = "#2e6a32";
    ctx.beginPath();
    ctx.ellipse(0, -o.h * 0.5, o.w * 0.55, o.h * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#48a850";
    const leaves = Math.max(3, Math.floor(o.w / 18));
    for (let i = 0; i < leaves; i++) {
      const t = i / (leaves - 1) - 0.5;
      ctx.beginPath();
      ctx.ellipse(
        t * o.w * 0.7,
        -o.h * 0.75 + Math.abs(t) * 6,
        7,
        9,
        t * 0.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#d9264f";
    ctx.beginPath();
    ctx.arc(-o.w * 0.2, -o.h * 0.55, 3.5, 0, Math.PI * 2);
    ctx.arc(o.w * 0.15, -o.h * 0.6, 3.5, 0, Math.PI * 2);
    ctx.arc(0, -o.h * 0.4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // log
    ctx.fillStyle = "#7c4a2a";
    ctx.fillRect(-o.w * 0.5, -o.h, o.w, o.h);
    ctx.fillStyle = "#a36138";
    ctx.beginPath();
    ctx.ellipse(-o.w * 0.5, -o.h * 0.5, o.h * 0.5, o.h * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(o.w * 0.5, -o.h * 0.5, o.h * 0.5, o.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a3a1f";
    ctx.beginPath();
    ctx.arc(-o.w * 0.5, -o.h * 0.5, o.h * 0.25, 0, Math.PI * 2);
    ctx.arc(o.w * 0.5, -o.h * 0.5, o.h * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.save();
  // Smoother bob: smaller amplitude, slower phase
  let bob = 0;
  if ((s.phase === "running" || s.phase === "boss") && s.playerY === 0) {
    bob = Math.sin(s.worldOffset * 0.12 + s.bossTimer * 0.008) * 1.2;
  }
  ctx.translate(s.playerX, GROUND_Y - s.playerY + bob);

  const flashing = s.invuln > 0 && Math.floor(s.invuln / 110) % 2 === 0;
  if (flashing) ctx.globalAlpha = 0.45;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(
    0,
    4 - s.playerY * 0.1,
    55 - Math.min(40, s.playerY * 0.25),
    8,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Legs — slower, gentler animation
  const legPhase = s.playerY > 0 ? 0 : (s.worldOffset * 0.16) % (Math.PI * 2);
  const l1 = Math.sin(legPhase) * 3;
  const l2 = Math.sin(legPhase + Math.PI) * 3;
  ctx.fillStyle = "#e066a8";
  ctx.fillRect(-32, -10, 12, 14 + l1);
  ctx.fillRect(-14, -10, 12, 14 + l2);
  ctx.fillRect(10, -10, 12, 14 + l1);
  ctx.fillRect(28, -10, 12, 14 + l2);

  // Tail (slower wag)
  ctx.strokeStyle = "#ff8cc8";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-44, -32);
  const tailWag = Math.sin(s.worldOffset * 0.18 + s.bossTimer * 0.005) * 6;
  ctx.quadraticCurveTo(-60, -50 + tailWag, -50, -18);
  ctx.stroke();

  // Body
  ctx.fillStyle = "#ff8cc8";
  ctx.beginPath();
  ctx.ellipse(0, -28, 52, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffb1d8";
  ctx.beginPath();
  ctx.ellipse(0, -22, 44, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = "#ff8cc8";
  ctx.beginPath();
  ctx.arc(38, -45, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#dc5fa0";
  ctx.beginPath();
  ctx.ellipse(28, -58, 8, 16, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e066a8";
  ctx.beginPath();
  ctx.ellipse(46, -60, 8, 14, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Muzzle
  ctx.fillStyle = "#ffd1e3";
  ctx.beginPath();
  ctx.ellipse(53, -38, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a1a3a";
  ctx.beginPath();
  ctx.arc(61, -42, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff6b9c";
  ctx.beginPath();
  ctx.ellipse(56, -32, 5, 3.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(42, -50, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0a3a";
  ctx.beginPath();
  ctx.arc(44, -50, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(45, -51, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(217,38,79,0.45)";
  ctx.beginPath();
  ctx.arc(34, -38, 4, 0, Math.PI * 2);
  ctx.fill();

  // --- Girl on top ---
  ctx.save();
  ctx.translate(-2, -bob * 0.4);
  ctx.fillStyle = "#7e3ff2";
  ctx.beginPath();
  ctx.moveTo(-14, -52);
  ctx.lineTo(14, -52);
  ctx.lineTo(22, -85);
  ctx.lineTo(-22, -85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9b5bff";
  ctx.fillRect(-18, -78, 36, 4);
  ctx.fillStyle = "#fde2ce";
  ctx.beginPath();
  ctx.ellipse(-20, -45, 6, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(20, -45, 6, 12, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff5fa8";
  ctx.beginPath();
  ctx.ellipse(-22, -35, 7, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(22, -35, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fde2ce";
  ctx.fillRect(-5, -92, 10, 10);
  ctx.beginPath();
  ctx.arc(0, -100, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#542a8a";
  ctx.beginPath();
  ctx.arc(0, -106, 16, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-10, -100, 6, 9, -0.4, 0, Math.PI * 2);
  ctx.ellipse(10, -100, 6, 9, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff5fa8";
  ctx.beginPath();
  ctx.arc(-16, -94, 7, 0, Math.PI * 2);
  ctx.arc(16, -94, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe255";
  ctx.beginPath();
  ctx.arc(-16, -100, 2.5, 0, Math.PI * 2);
  ctx.arc(16, -100, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0a3a";
  ctx.beginPath();
  ctx.arc(-5, -100, 2, 0, Math.PI * 2);
  ctx.arc(5, -100, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-4.3, -100.6, 0.8, 0, Math.PI * 2);
  ctx.arc(5.7, -100.6, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7a1b6b";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -94, 3, 0.1, Math.PI - 0.1);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,95,168,0.55)";
  ctx.beginPath();
  ctx.arc(-9, -96, 2.5, 0, Math.PI * 2);
  ctx.arc(9, -96, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fde2ce";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-10, -78);
  ctx.lineTo(0, -65);
  ctx.stroke();
  const armSwing =
    s.phase === "boss"
      ? Math.sin(s.bossTimer * 0.006) * 0.6
      : Math.sin(s.worldOffset * 0.16) * 0.4;
  ctx.beginPath();
  ctx.moveTo(10, -78);
  ctx.lineTo(20 + Math.cos(armSwing) * 8, -88 - Math.sin(armSwing) * 8);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawDragon(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.save();
  let cx = 650;
  let cy = 150;
  if (s.dragonShake > 0) {
    cx += (Math.random() - 0.5) * 5 * (s.dragonShake / 350);
    cy += (Math.random() - 0.5) * 5 * (s.dragonShake / 350);
  }
  const wing = Math.sin(s.bossTimer * 0.006) * 12;

  ctx.fillStyle = "#82143a";
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 10);
  ctx.quadraticCurveTo(cx - 80, cy - 60 + wing, cx - 110, cy + 20 + wing);
  ctx.quadraticCurveTo(cx - 60, cy + 5, cx - 10, cy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy - 10);
  ctx.quadraticCurveTo(cx + 80, cy - 60 + wing, cx + 110, cy + 20 + wing);
  ctx.quadraticCurveTo(cx + 60, cy + 5, cx + 10, cy + 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#3a8a32";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 50, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d6e89c";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 22, 32, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3a8a32";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy + 40);
  ctx.quadraticCurveTo(cx - 30, cy + 100, cx - 80, cy + 80);
  ctx.stroke();

  ctx.fillStyle = "#3a8a32";
  ctx.beginPath();
  ctx.ellipse(cx - 30, cy - 20, 30, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - 55, cy - 12, 22, 14, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5d36b";
  drawTriangle(ctx, cx - 22, cy - 38, cx - 18, cy - 40, cx - 14, cy - 60);
  drawTriangle(ctx, cx - 38, cy - 38, cx - 34, cy - 40, cx - 30, cy - 58);
  ctx.fillStyle = "#fffae0";
  ctx.beginPath();
  ctx.arc(cx - 30, cy - 22, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0a0a";
  ctx.beginPath();
  ctx.arc(cx - 33, cy - 22, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff6b3c";
  ctx.beginPath();
  ctx.arc(cx - 33, cy - 22, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Mouth glow grows during charging
  const charge = s.dragonCharging > 0 ? 1 - s.dragonCharging / DRAGON_CHARGE_MS : 0;
  const glow = Math.max(charge, s.dragonMouthGlow / DRAGON_CHARGE_MS);
  if (glow > 0) {
    ctx.fillStyle = `rgba(255,160,40,${0.55 * glow})`;
    ctx.beginPath();
    ctx.arc(cx - 70, cy - 12, 24 * glow + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,240,180,${0.7 * glow})`;
    ctx.beginPath();
    ctx.arc(cx - 70, cy - 12, 12 * glow + 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#1a0a1a";
  ctx.beginPath();
  ctx.ellipse(cx - 65, cy - 8, 10, 4, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffae0";
  drawTriangle(ctx, cx - 68, cy - 9, cx - 64, cy - 9, cx - 66, cy - 2);
  drawTriangle(ctx, cx - 60, cy - 9, cx - 56, cy - 9, cx - 58, cy - 1);

  ctx.fillStyle = "#225a1d";
  for (let i = 0; i < 4; i++) {
    drawTriangle(
      ctx,
      cx - 25 + i * 18,
      cy - 18,
      cx - 15 + i * 18,
      cy - 18,
      cx - 20 + i * 18,
      cy - 34,
    );
  }

  // Telegraph: while charging, draw a translucent target line from dragon mouth toward predicted landing
  if (s.dragonCharging > 0) {
    const pulse = (Math.sin(s.bossTimer * 0.02) + 1) / 2;
    ctx.strokeStyle = `rgba(255,200,80,${0.35 + 0.4 * pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy - 12);
    ctx.lineTo(s.playerX + 10, GROUND_Y - 40);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawFireball(ctx: CanvasRenderingContext2D, f: Fireball) {
  ctx.save();
  ctx.translate(f.x, f.y);
  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 22);
  grad.addColorStop(0, "rgba(255,255,180,1)");
  grad.addColorStop(0.5, "rgba(255,140,40,0.95)");
  grad.addColorStop(1, "rgba(255,60,20,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff2c4";
  ctx.beginPath();
  ctx.arc(-1, -1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
