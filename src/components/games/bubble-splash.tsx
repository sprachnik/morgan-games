"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eraser, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const CANVAS_W = 800;
const CANVAS_H = 540;

type PaintKind = {
  hue: number;
  lightness: number;
  glitter: boolean;
};

type Bubble = {
  id: number;
  x: number;
  y: number;
  r: number;
  vy: number;
  wobble: number;
  wobbleSpeed: number;
  phase: number;
  paint: PaintKind | null;
  popping: number; // -1 = alive, >0 = animating, 0 = finished (remove)
};

type Pop = {
  x: number;
  y: number;
  life: number;
  color: string;
};

const PAINT_COLORS: PaintKind[] = [
  { hue: 330, lightness: 60, glitter: true },
  { hue: 290, lightness: 55, glitter: false },
  { hue: 15, lightness: 60, glitter: true },
  { hue: 200, lightness: 60, glitter: false },
  { hue: 50, lightness: 65, glitter: true },
  { hue: 150, lightness: 55, glitter: false },
  { hue: 0, lightness: 65, glitter: true },
];

type Picture = {
  slug: string;
  name: string;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

const PICTURES: Picture[] = [
  {
    slug: "butterfly",
    name: "Butterfly",
    draw: drawButterfly,
  },
  {
    slug: "unicorn",
    name: "Unicorn",
    draw: drawUnicorn,
  },
  {
    slug: "rainbow",
    name: "Rainbow",
    draw: drawRainbow,
  },
  {
    slug: "kitty",
    name: "Kitty Cat",
    draw: drawKitty,
  },
  {
    slug: "flower",
    name: "Big Flower",
    draw: drawFlower,
  },
];

export function BubbleSplash() {
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paperCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outlineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const popsRef = useRef<Pop[]>([]);
  const idRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const [pictureIdx, setPictureIdx] = useState(0);
  const [splatCount, setSplatCount] = useState(0);

  const ensureOffscreen = useCallback(() => {
    const make = () => {
      const c = document.createElement("canvas");
      c.width = CANVAS_W;
      c.height = CANVAS_H;
      return c;
    };
    if (!paintCanvasRef.current) paintCanvasRef.current = make();
    if (!paperCanvasRef.current) paperCanvasRef.current = make();
    if (!outlineCanvasRef.current) outlineCanvasRef.current = make();
  }, []);

  const redrawPicture = useCallback(
    (idx: number) => {
      ensureOffscreen();
      // Paper (background only)
      const paperCtx = paperCanvasRef.current!.getContext("2d")!;
      paperCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      const g = paperCtx.createLinearGradient(0, 0, 0, CANVAS_H);
      g.addColorStop(0, "#fff9fc");
      g.addColorStop(1, "#ffeaf4");
      paperCtx.fillStyle = g;
      paperCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Outline (transparent layer drawn over paint)
      const outlineCtx = outlineCanvasRef.current!.getContext("2d")!;
      outlineCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      outlineCtx.save();
      outlineCtx.translate(CANVAS_W / 2, CANVAS_H / 2);
      outlineCtx.lineCap = "round";
      outlineCtx.lineJoin = "round";
      // Soft halo so the outline reads even on top of dark paint splats
      outlineCtx.strokeStyle = "rgba(255,255,255,0.85)";
      outlineCtx.lineWidth = 8;
      PICTURES[idx].draw(outlineCtx);
      // Crisp dark line on top
      outlineCtx.strokeStyle = "#3a1a4a";
      outlineCtx.lineWidth = 3.5;
      PICTURES[idx].draw(outlineCtx);
      outlineCtx.restore();
    },
    [ensureOffscreen],
  );

  const clearPaint = useCallback(() => {
    ensureOffscreen();
    const pc = paintCanvasRef.current!;
    const pctx = pc.getContext("2d");
    if (pctx) pctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setSplatCount(0);
  }, [ensureOffscreen]);

  const choosePicture = useCallback(
    (idx: number) => {
      setPictureIdx(idx);
      redrawPicture(idx);
      clearPaint();
    },
    [redrawPicture, clearPaint],
  );

  const downloadPng = useCallback(() => {
    ensureOffscreen();
    const out = document.createElement("canvas");
    out.width = CANVAS_W;
    out.height = CANVAS_H;
    const octx = out.getContext("2d");
    if (!octx) return;
    octx.drawImage(paperCanvasRef.current!, 0, 0);
    octx.drawImage(paintCanvasRef.current!, 0, 0);
    octx.drawImage(outlineCanvasRef.current!, 0, 0);
    const name = `morgan-${PICTURES[pictureIdx].slug}-${Date.now()}.png`;
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }, [ensureOffscreen, pictureIdx]);

  // Set up offscreen canvases on mount
  useEffect(() => {
    ensureOffscreen();
    redrawPicture(pictureIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spawn loop
  const spawnBubble = useCallback(() => {
    const paint =
      Math.random() < 0.65
        ? PAINT_COLORS[Math.floor(Math.random() * PAINT_COLORS.length)]
        : null;
    const r = 22 + Math.random() * 38;
    idRef.current += 1;
    bubblesRef.current.push({
      id: idRef.current,
      x: r + Math.random() * (CANVAS_W - r * 2),
      y: CANVAS_H + r + 10,
      r,
      vy: 0.6 + Math.random() * 1.2 + (paint ? -0.1 : 0.1),
      wobble: 14 + Math.random() * 22,
      wobbleSpeed: 0.001 + Math.random() * 0.0015,
      phase: Math.random() * Math.PI * 2,
      paint,
      popping: -1,
    });
  }, []);

  // Pop handler
  const handlePop = useCallback(
    (cx: number, cy: number) => {
      ensureOffscreen();
      const bubbles = bubblesRef.current;
      // Find topmost (largest y on screen = smallest y value) that's under the pointer
      let target: Bubble | null = null;
      for (const b of bubbles) {
        if (b.popping >= 0) continue;
        const dx = cx - b.x;
        const dy = cy - b.y;
        if (dx * dx + dy * dy <= b.r * b.r) {
          if (!target || b.y < target.y) target = b;
        }
      }
      if (!target) return;
      target.popping = 250;

      // Pop ring
      popsRef.current.push({
        x: target.x,
        y: target.y,
        life: 1,
        color: target.paint
          ? `hsl(${target.paint.hue}deg ${target.paint.lightness * 1.1}% 80%)`
          : "rgba(255,255,255,0.9)",
      });

      // Splat onto paint layer
      if (target.paint) {
        const pctx = paintCanvasRef.current!.getContext("2d")!;
        splat(pctx, target.x, target.y, target.r, target.paint);
        setSplatCount((c) => c + 1);
      }
    },
    [ensureOffscreen],
  );

  // Render loop
  useEffect(() => {
    const live = liveCanvasRef.current;
    if (!live) return;
    const ctx = live.getContext("2d");
    if (!ctx) return;

    const loop = (t: number) => {
      const last = lastTimeRef.current ?? t;
      const dt = Math.min(40, t - last);
      lastTimeRef.current = t;

      // Spawn
      spawnTimerRef.current -= dt;
      if (spawnTimerRef.current <= 0 && bubblesRef.current.length < 16) {
        spawnBubble();
        spawnTimerRef.current = 350 + Math.random() * 500;
      }

      // Update bubbles
      const bubbles = bubblesRef.current;
      for (const b of bubbles) {
        b.phase += b.wobbleSpeed * dt;
        if (b.popping < 0) {
          b.y -= b.vy * (dt / 16.67);
        } else {
          b.popping = Math.max(0, b.popping - dt);
        }
      }
      bubblesRef.current = bubbles.filter((b) => {
        if (b.popping === 0) return false;        // finished popping → remove
        if (b.popping > 0) return true;           // mid-pop animation
        return b.y + b.r > -40;                   // alive, keep until off top
      });

      // Pops fade
      for (const p of popsRef.current) p.life -= dt / 350;
      popsRef.current = popsRef.current.filter((p) => p.life > 0);

      // Draw layers bottom-up so the outline stays visible over paint splats.
      // 1. paper background
      ctx.drawImage(paperCanvasRef.current!, 0, 0);
      // 2. accumulated paint splats
      ctx.drawImage(paintCanvasRef.current!, 0, 0);
      // 3. outline drawing — sits ON TOP of paint
      ctx.drawImage(outlineCanvasRef.current!, 0, 0);
      // 4. live bubbles
      for (const b of bubblesRef.current) drawBubble(ctx, b, t);
      // 5. pop rings
      for (const p of popsRef.current) drawPopRing(ctx, p);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [spawnBubble]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PICTURES.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => choosePicture(i)}
              className={cn(
                "rounded-full px-4 py-2 text-base font-bold ring-4 ring-white/70 transition-transform",
                i === pictureIdx
                  ? "bg-primary text-primary-foreground shadow-pop-sm scale-105"
                  : "bg-card text-foreground hover:-translate-y-0.5",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-baseline gap-2 rounded-full bg-card px-4 py-2 ring-4 ring-white/70 shadow-pop-sm">
            <Sparkles className="size-4 text-fun-magenta" />
            <span className="font-heading text-xl font-bold text-fun-magenta">
              {splatCount}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">splats</span>
          </div>
          <button
            type="button"
            onClick={downloadPng}
            disabled={splatCount === 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-base font-bold text-primary-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Download className="size-5" strokeWidth={3} />
            Save picture
          </button>
          <button
            type="button"
            onClick={clearPaint}
            className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-base font-bold text-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
          >
            <Eraser className="size-5" strokeWidth={3} />
            Clear paint
          </button>
        </div>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-3xl ring-4 ring-white/70 shadow-pop">
        <canvas
          ref={liveCanvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
            const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
            handlePop(x, y);
          }}
          className="block h-auto w-full cursor-pointer touch-none select-none"
        />
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Pop the floating bubbles. The sparkly ones splash paint onto the picture!
      </p>
    </div>
  );
}

// -- Drawing helpers --

function drawBubble(ctx: CanvasRenderingContext2D, b: Bubble, t: number) {
  ctx.save();
  const wobble = Math.sin(b.phase + t * 0.001) * (b.wobble * 0.18);
  const cx = b.x + wobble;
  const cy = b.y;
  const popK = b.popping >= 0 ? 1 - b.popping / 250 : 0;
  const scale = 1 + popK * 0.35;
  const alpha = b.popping >= 0 ? 1 - popK : 1;

  ctx.globalAlpha = alpha;

  if (b.paint) {
    const { hue, lightness } = b.paint;
    // Paint body
    const grad = ctx.createRadialGradient(
      cx - b.r * 0.4,
      cy - b.r * 0.5,
      b.r * 0.1,
      cx,
      cy,
      b.r * scale,
    );
    grad.addColorStop(0, `hsla(${hue},90%,${lightness + 18}%,0.95)`);
    grad.addColorStop(0.7, `hsla(${hue},85%,${lightness}%,0.9)`);
    grad.addColorStop(1, `hsla(${hue},85%,${lightness - 10}%,0.85)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, b.r * scale, 0, Math.PI * 2);
    ctx.fill();
    // Inner swirl
    ctx.strokeStyle = `hsla(${hue},80%,${lightness + 25}%,0.7)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 1.6; a += 0.2) {
      const rr = b.r * 0.55 * (1 - a / (Math.PI * 2));
      const ax = cx + Math.cos(a + b.phase) * rr;
      const ay = cy + Math.sin(a + b.phase) * rr;
      if (a === 0) ctx.moveTo(ax, ay);
      else ctx.lineTo(ax, ay);
    }
    ctx.stroke();
    // Glitter
    if (b.paint.glitter) {
      for (let i = 0; i < 6; i++) {
        const a = b.phase * 1.5 + i * 1.05;
        const rr = b.r * 0.65 * (0.4 + ((i * 13) % 7) / 10);
        const gx = cx + Math.cos(a) * rr;
        const gy = cy + Math.sin(a) * rr;
        const tw = (Math.sin(t * 0.005 + i) + 1) / 2;
        ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.5})`;
        ctx.beginPath();
        ctx.arc(gx, gy, 1.7 + tw * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // Plain bubble (translucent)
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(cx, cy, b.r * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rim
  ctx.strokeStyle = b.paint
    ? `hsla(${b.paint.hue},85%,${b.paint.lightness + 25}%,0.85)`
    : "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx, cy, b.r * scale, 0, Math.PI * 2);
  ctx.stroke();

  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.ellipse(
    cx - b.r * 0.35,
    cy - b.r * 0.4,
    b.r * 0.22,
    b.r * 0.12,
    -0.7,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.arc(cx - b.r * 0.45, cy - b.r * 0.25, b.r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPopRing(ctx: CanvasRenderingContext2D, p: Pop) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, p.life);
  const r = (1 - p.life) * 60 + 8;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 4 * p.life;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function splat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  paint: PaintKind,
) {
  const { hue, lightness, glitter } = paint;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  // Main blob
  ctx.fillStyle = `hsla(${hue},85%,${lightness}%,0.92)`;
  blob(ctx, cx, cy, size * (0.95 + Math.random() * 0.3));

  // Secondary smaller blobs around
  const ring = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < ring; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = size * (0.9 + Math.random() * 1.4);
    const r = size * (0.18 + Math.random() * 0.45);
    ctx.fillStyle = `hsla(${hue + (Math.random() * 30 - 15)},85%,${lightness + (Math.random() * 12 - 6)}%,${0.7 + Math.random() * 0.25})`;
    blob(ctx, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r);
  }

  // Thin droplets shooting outward (Pollock-y)
  ctx.strokeStyle = `hsla(${hue},85%,${lightness - 5}%,0.7)`;
  ctx.lineCap = "round";
  const drips = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < drips; i++) {
    const a = Math.random() * Math.PI * 2;
    const d1 = size * (1.0 + Math.random() * 0.6);
    const d2 = size * (1.8 + Math.random() * 1.6);
    const x1 = cx + Math.cos(a) * d1;
    const y1 = cy + Math.sin(a) * d1;
    const x2 = cx + Math.cos(a) * d2;
    const y2 = cy + Math.sin(a) * d2;
    ctx.lineWidth = 1 + Math.random() * 3.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // tip dot
    ctx.fillStyle = `hsla(${hue},85%,${lightness}%,0.85)`;
    ctx.beginPath();
    ctx.arc(x2, y2, 2 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glitter
  if (glitter) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = size * (0.4 + Math.random() * 2.2);
      const gx = cx + Math.cos(a) * dist;
      const gy = cy + Math.sin(a) * dist;
      ctx.fillStyle = `hsla(${hue + 20},100%,90%,${0.6 + Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.arc(gx, gy, 1.2 + Math.random() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  const points = 9;
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (0.78 + Math.random() * 0.5);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// ---- Picture drawings (all start with ctx translated to centre, scaled normally) ----

function drawButterfly(ctx: CanvasRenderingContext2D) {
  // Body
  ctx.beginPath();
  ctx.moveTo(0, -80);
  ctx.lineTo(0, 80);
  ctx.stroke();
  // Antennae
  ctx.beginPath();
  ctx.moveTo(-2, -80);
  ctx.quadraticCurveTo(-20, -110, -40, -120);
  ctx.moveTo(2, -80);
  ctx.quadraticCurveTo(20, -110, 40, -120);
  ctx.stroke();
  // Upper wings
  ctx.beginPath();
  ctx.moveTo(-2, -50);
  ctx.quadraticCurveTo(-180, -140, -200, -30);
  ctx.quadraticCurveTo(-150, 10, -10, 10);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, -50);
  ctx.quadraticCurveTo(180, -140, 200, -30);
  ctx.quadraticCurveTo(150, 10, 10, 10);
  ctx.closePath();
  ctx.stroke();
  // Lower wings
  ctx.beginPath();
  ctx.moveTo(-5, 5);
  ctx.quadraticCurveTo(-160, 60, -120, 140);
  ctx.quadraticCurveTo(-60, 90, -8, 60);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5, 5);
  ctx.quadraticCurveTo(160, 60, 120, 140);
  ctx.quadraticCurveTo(60, 90, 8, 60);
  ctx.closePath();
  ctx.stroke();
  // Wing spots
  for (const [x, y, r] of [
    [-100, -45, 22],
    [100, -45, 22],
    [-70, 80, 14],
    [70, 80, 14],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawUnicorn(ctx: CanvasRenderingContext2D) {
  // Head
  ctx.beginPath();
  ctx.ellipse(0, 0, 110, 95, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Muzzle
  ctx.beginPath();
  ctx.ellipse(-90, 30, 35, 28, -0.25, 0, Math.PI * 2);
  ctx.stroke();
  // Nostril
  ctx.beginPath();
  ctx.arc(-110, 30, 4, 0, Math.PI * 2);
  ctx.stroke();
  // Eye (closed lashes)
  ctx.beginPath();
  ctx.moveTo(-35, -10);
  ctx.quadraticCurveTo(-20, -25, -5, -10);
  ctx.stroke();
  for (const a of [-0.6, -0.2, 0.2]) {
    const x = -20 + Math.cos(Math.PI + a) * 18;
    const y = -10 + Math.sin(Math.PI + a) * 18;
    ctx.beginPath();
    ctx.moveTo(-20, -20);
    ctx.lineTo(x, y - 5);
    ctx.stroke();
  }
  // Ear
  ctx.beginPath();
  ctx.moveTo(50, -85);
  ctx.lineTo(80, -130);
  ctx.lineTo(95, -85);
  ctx.closePath();
  ctx.stroke();
  // Horn
  ctx.beginPath();
  ctx.moveTo(15, -85);
  ctx.lineTo(35, -170);
  ctx.lineTo(55, -85);
  ctx.closePath();
  ctx.stroke();
  // Horn stripes
  ctx.beginPath();
  ctx.moveTo(22, -110);
  ctx.lineTo(48, -110);
  ctx.moveTo(28, -135);
  ctx.lineTo(42, -135);
  ctx.stroke();
  // Mane (flowing)
  for (let i = 0; i < 5; i++) {
    const sy = -60 + i * 30;
    ctx.beginPath();
    ctx.moveTo(70, sy);
    ctx.quadraticCurveTo(140 + i * 8, sy + 30, 180 + i * 10, sy + 80);
    ctx.stroke();
  }
  // Neck base
  ctx.beginPath();
  ctx.moveTo(60, 80);
  ctx.quadraticCurveTo(100, 130, 140, 180);
  ctx.moveTo(20, 90);
  ctx.quadraticCurveTo(40, 140, 60, 200);
  ctx.stroke();
}

function drawRainbow(ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < 6; i++) {
    const r = 200 - i * 24;
    ctx.beginPath();
    ctx.arc(0, 80, r, Math.PI, 0);
    ctx.stroke();
  }
  // Clouds at base
  for (const [cx, cy] of [
    [-200, 80],
    [200, 80],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy - 10, 32, 0, Math.PI * 2);
    ctx.arc(cx + 60, cy, 28, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy + 12, 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Sun above
  ctx.beginPath();
  ctx.arc(140, -180, 32, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(140 + Math.cos(a) * 40, -180 + Math.sin(a) * 40);
    ctx.lineTo(140 + Math.cos(a) * 56, -180 + Math.sin(a) * 56);
    ctx.stroke();
  }
}

function drawKitty(ctx: CanvasRenderingContext2D) {
  // Head
  ctx.beginPath();
  ctx.arc(0, 0, 130, 0, Math.PI * 2);
  ctx.stroke();
  // Ears
  ctx.beginPath();
  ctx.moveTo(-110, -70);
  ctx.lineTo(-150, -160);
  ctx.lineTo(-60, -120);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(110, -70);
  ctx.lineTo(150, -160);
  ctx.lineTo(60, -120);
  ctx.closePath();
  ctx.stroke();
  // Inner ears
  ctx.beginPath();
  ctx.moveTo(-100, -85);
  ctx.lineTo(-128, -140);
  ctx.lineTo(-75, -110);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(100, -85);
  ctx.lineTo(128, -140);
  ctx.lineTo(75, -110);
  ctx.closePath();
  ctx.stroke();
  // Eyes
  ctx.beginPath();
  ctx.ellipse(-40, -10, 18, 26, 0, 0, Math.PI * 2);
  ctx.ellipse(40, -10, 18, 26, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-40, -10, 6, 0, Math.PI * 2);
  ctx.arc(40, -10, 6, 0, Math.PI * 2);
  ctx.stroke();
  // Nose
  ctx.beginPath();
  ctx.moveTo(-12, 30);
  ctx.lineTo(12, 30);
  ctx.lineTo(0, 48);
  ctx.closePath();
  ctx.stroke();
  // Mouth
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.lineTo(0, 60);
  ctx.moveTo(0, 60);
  ctx.quadraticCurveTo(-22, 75, -34, 62);
  ctx.moveTo(0, 60);
  ctx.quadraticCurveTo(22, 75, 34, 62);
  ctx.stroke();
  // Whiskers
  for (const dy of [-15, 0, 15]) {
    ctx.beginPath();
    ctx.moveTo(-50, 35 + dy);
    ctx.lineTo(-130, 35 + dy * 1.6);
    ctx.moveTo(50, 35 + dy);
    ctx.lineTo(130, 35 + dy * 1.6);
    ctx.stroke();
  }
}

function drawFlower(ctx: CanvasRenderingContext2D) {
  // Petals
  const petals = 8;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -130, 50, 90, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Center
  ctx.beginPath();
  ctx.arc(0, 0, 55, 0, Math.PI * 2);
  ctx.stroke();
  // Center dots
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 28, Math.sin(a) * 28, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Stem
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.quadraticCurveTo(-20, 150, 0, 240);
  ctx.stroke();
  // Leaf
  ctx.beginPath();
  ctx.moveTo(-15, 150);
  ctx.quadraticCurveTo(-90, 130, -110, 180);
  ctx.quadraticCurveTo(-60, 200, -10, 170);
  ctx.closePath();
  ctx.stroke();
}
