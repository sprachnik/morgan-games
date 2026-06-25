"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eraser, Pencil, Sparkles } from "lucide-react";

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
  {
    slug: "puppy",
    name: "Puppy",
    draw: drawPuppy,
  },
  {
    slug: "tiger",
    name: "Tiger",
    draw: drawTiger,
  },
  {
    slug: "elephant",
    name: "Elephant",
    draw: drawElephant,
  },
  {
    slug: "giraffe",
    name: "Giraffe",
    draw: drawGiraffe,
  },
  {
    slug: "penguin",
    name: "Penguin",
    draw: drawPenguin,
  },
  {
    slug: "horse",
    name: "Horse",
    draw: drawHorse,
  },
  {
    slug: "snake",
    name: "Snake",
    draw: drawSnake,
  },
  {
    slug: "free",
    name: "Free Draw",
    draw: () => {},
  },
];

const FREE_DRAW_SLUG = "free";

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
  const [mode, setMode] = useState<"pop" | "draw">("pop");
  // Mirror mode into a ref so the animation loop (which only closes over
  // `spawnBubble`) can read it without restarting whenever mode changes.
  const modeRef = useRef<"pop" | "draw">("pop");
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

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

  const paintPaper = useCallback(() => {
    ensureOffscreen();
    const paperCtx = paperCanvasRef.current!.getContext("2d")!;
    paperCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const g = paperCtx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, "#fff9fc");
    g.addColorStop(1, "#ffeaf4");
    paperCtx.fillStyle = g;
    paperCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, [ensureOffscreen]);

  const clearOutline = useCallback(() => {
    ensureOffscreen();
    const outlineCtx = outlineCanvasRef.current!.getContext("2d")!;
    outlineCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }, [ensureOffscreen]);

  const redrawPicture = useCallback(
    (idx: number) => {
      paintPaper();
      clearOutline();
      // Free Draw has no preset outline — leave the layer blank for the user.
      if (PICTURES[idx].slug === FREE_DRAW_SLUG) return;

      const outlineCtx = outlineCanvasRef.current!.getContext("2d")!;
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
    [paintPaper, clearOutline],
  );

  // Solid dark stroke — no halo on live drawing, because each segment would
  // otherwise paint its halo on top of the previous segment's dark line and
  // visibly break the stroke during fast pointer movement.
  const drawSegment = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      ensureOffscreen();
      const ctx = outlineCanvasRef.current!.getContext("2d")!;
      ctx.strokeStyle = "#3a1a4a";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    [ensureOffscreen],
  );

  const drawDot = useCallback(
    (x: number, y: number) => {
      ensureOffscreen();
      const ctx = outlineCanvasRef.current!.getContext("2d")!;
      ctx.fillStyle = "#3a1a4a";
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
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
      // Free Draw lands in draw mode so the first click is a pen stroke,
      // not a bubble pop. Other pictures land in pop mode.
      setMode(PICTURES[idx].slug === FREE_DRAW_SLUG ? "draw" : "pop");
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

      // Spawn (pause while the user is drawing their own outline)
      spawnTimerRef.current -= dt;
      if (
        modeRef.current === "pop" &&
        spawnTimerRef.current <= 0 &&
        bubblesRef.current.length < 16
      ) {
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
          {PICTURES[pictureIdx].slug === FREE_DRAW_SLUG && (
            <button
              type="button"
              onClick={() =>
                setMode((m) => (m === "draw" ? "pop" : "draw"))
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-bold ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5",
                mode === "draw"
                  ? "bg-fun-magenta text-primary-foreground"
                  : "bg-card text-foreground",
              )}
            >
              {mode === "draw" ? (
                <>
                  <Sparkles className="size-5" strokeWidth={3} />
                  Release bubbles!
                </>
              ) : (
                <>
                  <Pencil className="size-5" strokeWidth={3} />
                  Keep drawing
                </>
              )}
            </button>
          )}
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
            if (mode === "draw") {
              drawingRef.current = true;
              lastPointRef.current = { x, y };
              drawDot(x, y);
              e.currentTarget.setPointerCapture(e.pointerId);
            } else {
              handlePop(x, y);
            }
          }}
          onPointerMove={(e) => {
            if (mode !== "draw" || !drawingRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            // Use coalesced events so fast strokes capture every intermediate
            // point the OS reported (the browser otherwise merges them into
            // one event and we'd visibly skip pixels).
            const native = e.nativeEvent;
            const events =
              typeof native.getCoalescedEvents === "function"
                ? native.getCoalescedEvents()
                : [native];
            for (const ne of events.length ? events : [native]) {
              const x = ((ne.clientX - rect.left) / rect.width) * CANVAS_W;
              const y = ((ne.clientY - rect.top) / rect.height) * CANVAS_H;
              const last = lastPointRef.current;
              if (last) drawSegment(last.x, last.y, x, y);
              lastPointRef.current = { x, y };
            }
          }}
          onPointerUp={(e) => {
            if (mode !== "draw") return;
            drawingRef.current = false;
            lastPointRef.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
          onPointerCancel={() => {
            drawingRef.current = false;
            lastPointRef.current = null;
          }}
          className={cn(
            "block h-auto w-full touch-none select-none",
            mode === "draw" ? "cursor-crosshair" : "cursor-pointer",
          )}
        />
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        {mode === "draw"
          ? "Draw your own picture! Click and drag — then press “Release bubbles!” to start splashing paint."
          : "Pop the floating bubbles. The sparkly ones splash paint onto the picture!"}
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

function drawPuppy(ctx: CanvasRenderingContext2D) {
  // Floppy ears — short, wide, triangular-droopy (not long oval rabbit ears).
  // Each ear is an open curve attaching high on the head, sweeping wide
  // outward, then back to the head at the cheek.
  ctx.beginPath();
  ctx.moveTo(-50, -82);
  ctx.bezierCurveTo(-130, -92, -158, -30, -132, 25);
  ctx.bezierCurveTo(-115, 55, -88, 50, -70, 22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(50, -82);
  ctx.bezierCurveTo(130, -92, 158, -30, 132, 25);
  ctx.bezierCurveTo(115, 55, 88, 50, 70, 22);
  ctx.stroke();
  // Ear inner-fold lines
  ctx.beginPath();
  ctx.moveTo(-80, -45);
  ctx.bezierCurveTo(-110, -25, -115, 10, -100, 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(80, -45);
  ctx.bezierCurveTo(110, -25, 115, 10, 100, 30);
  ctx.stroke();
  // Head (slightly wider than tall)
  ctx.beginPath();
  ctx.ellipse(0, 0, 95, 92, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Forehead fur tuft
  ctx.beginPath();
  ctx.moveTo(-22, -88);
  ctx.quadraticCurveTo(-13, -106, -3, -95);
  ctx.quadraticCurveTo(0, -112, 3, -95);
  ctx.quadraticCurveTo(13, -106, 22, -88);
  ctx.stroke();
  // Eyes — big and round
  ctx.beginPath();
  ctx.arc(-35, -22, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(35, -22, 17, 0, Math.PI * 2);
  ctx.stroke();
  // Pupils
  ctx.beginPath();
  ctx.arc(-32, -18, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(38, -18, 10, 0, Math.PI * 2);
  ctx.stroke();
  // Eye sparkles
  ctx.beginPath();
  ctx.arc(-37, -27, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(33, -27, 3, 0, Math.PI * 2);
  ctx.stroke();
  // Wide rounded muzzle — clearly visible, key dog feature
  ctx.beginPath();
  ctx.ellipse(0, 52, 66, 46, 0, 0, Math.PI * 2);
  ctx.stroke();
  // BIG round nose (puppy-style oval)
  ctx.beginPath();
  ctx.moveTo(-24, 24);
  ctx.bezierCurveTo(-34, 10, 34, 10, 24, 24);
  ctx.bezierCurveTo(34, 48, -34, 48, -24, 24);
  ctx.closePath();
  ctx.stroke();
  // Nose highlight
  ctx.beginPath();
  ctx.ellipse(-10, 19, 5, 3, -0.2, 0, Math.PI * 2);
  ctx.stroke();
  // Snout center line
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.lineTo(0, 68);
  ctx.stroke();
  // Mouth (puppy smile — open curves to either side)
  ctx.beginPath();
  ctx.moveTo(0, 68);
  ctx.bezierCurveTo(-15, 82, -40, 78, -48, 62);
  ctx.moveTo(0, 68);
  ctx.bezierCurveTo(15, 82, 40, 78, 48, 62);
  ctx.stroke();
  // Tongue hanging out
  ctx.beginPath();
  ctx.moveTo(-16, 75);
  ctx.bezierCurveTo(-20, 108, 20, 108, 16, 75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 85);
  ctx.lineTo(0, 106);
  ctx.stroke();
}

function drawTiger(ctx: CanvasRenderingContext2D) {
  // Face outline (rounded, with cheek ruff bumps)
  ctx.beginPath();
  ctx.moveTo(-130, 0);
  ctx.bezierCurveTo(-138, -90, -85, -135, 0, -130);
  ctx.bezierCurveTo(85, -135, 138, -90, 130, 0);
  ctx.bezierCurveTo(138, 55, 105, 110, 70, 130);
  ctx.bezierCurveTo(35, 148, -35, 148, -70, 130);
  ctx.bezierCurveTo(-105, 110, -138, 55, -130, 0);
  ctx.closePath();
  ctx.stroke();
  // Ears
  ctx.beginPath();
  ctx.moveTo(-105, -85);
  ctx.lineTo(-130, -152);
  ctx.lineTo(-65, -120);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(105, -85);
  ctx.lineTo(130, -152);
  ctx.lineTo(65, -120);
  ctx.closePath();
  ctx.stroke();
  // Inner ears
  ctx.beginPath();
  ctx.moveTo(-100, -98);
  ctx.lineTo(-115, -134);
  ctx.lineTo(-78, -116);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(100, -98);
  ctx.lineTo(115, -134);
  ctx.lineTo(78, -116);
  ctx.closePath();
  ctx.stroke();
  // Almond eyes
  ctx.beginPath();
  ctx.moveTo(-65, -28);
  ctx.bezierCurveTo(-55, -50, -25, -50, -15, -28);
  ctx.bezierCurveTo(-25, -8, -55, -8, -65, -28);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(65, -28);
  ctx.bezierCurveTo(55, -50, 25, -50, 15, -28);
  ctx.bezierCurveTo(25, -8, 55, -8, 65, -28);
  ctx.closePath();
  ctx.stroke();
  // Pupils (vertical slits)
  ctx.beginPath();
  ctx.ellipse(-40, -28, 4, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(40, -28, 4, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Eye highlights
  ctx.beginPath();
  ctx.arc(-42, -34, 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(38, -34, 2, 0, Math.PI * 2);
  ctx.stroke();
  // Nose
  ctx.beginPath();
  ctx.moveTo(-18, 18);
  ctx.quadraticCurveTo(0, 8, 18, 18);
  ctx.quadraticCurveTo(22, 38, 0, 44);
  ctx.quadraticCurveTo(-22, 38, -18, 18);
  ctx.closePath();
  ctx.stroke();
  // Nose highlight
  ctx.beginPath();
  ctx.arc(-8, 20, 2, 0, Math.PI * 2);
  ctx.stroke();
  // Mouth
  ctx.beginPath();
  ctx.moveTo(0, 44);
  ctx.lineTo(0, 64);
  ctx.moveTo(0, 64);
  ctx.bezierCurveTo(-12, 82, -38, 80, -48, 60);
  ctx.moveTo(0, 64);
  ctx.bezierCurveTo(12, 82, 38, 80, 48, 60);
  ctx.stroke();
  // Lower lip / chin
  ctx.beginPath();
  ctx.moveTo(-25, 80);
  ctx.quadraticCurveTo(0, 95, 25, 80);
  ctx.stroke();
  // Fangs
  ctx.beginPath();
  ctx.moveTo(-12, 78);
  ctx.lineTo(-8, 90);
  ctx.lineTo(-4, 78);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, 78);
  ctx.lineTo(8, 90);
  ctx.lineTo(4, 78);
  ctx.closePath();
  ctx.stroke();
  // Whisker dot rows
  for (const cy of [42, 56, 70]) {
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sgn * 30, cy, 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Whiskers
  for (const dy of [-8, 6, 22]) {
    ctx.beginPath();
    ctx.moveTo(-32, 50 + dy);
    ctx.quadraticCurveTo(-90, 50 + dy * 1.1, -135, 55 + dy * 1.3);
    ctx.moveTo(32, 50 + dy);
    ctx.quadraticCurveTo(90, 50 + dy * 1.1, 135, 55 + dy * 1.3);
    ctx.stroke();
  }
  // Forehead stripes — three Vs
  const foreheadStripes: [number, number][] = [
    [-30, -110],
    [0, -118],
    [30, -110],
  ];
  for (const [x, y] of foreheadStripes) {
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x, y + 30);
    ctx.lineTo(x + 7, y);
    ctx.closePath();
    ctx.stroke();
  }
  // Crown stripes (longer)
  ctx.beginPath();
  ctx.moveTo(-58, -120);
  ctx.lineTo(-48, -85);
  ctx.lineTo(-50, -118);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(58, -120);
  ctx.lineTo(48, -85);
  ctx.lineTo(50, -118);
  ctx.closePath();
  ctx.stroke();
  // Cheek stripes — tear-drop wedges
  const cheekStripes: [number, number, number, number][] = [
    [-118, -28, -88, -18],
    [-122, 8, -88, 18],
    [-115, 44, -85, 50],
    [118, -28, 88, -18],
    [122, 8, 88, 18],
    [115, 44, 85, 50],
  ];
  for (const [x1, y1, x2, y2] of cheekStripes) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + 6, x2, y2);
    ctx.lineTo(x2, y2 - 8);
    ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 4, x1, y1 - 6);
    ctx.closePath();
    ctx.stroke();
  }
}

function drawElephant(ctx: CanvasRenderingContext2D) {
  // Big ears (drawn first, behind head)
  ctx.beginPath();
  ctx.moveTo(-85, -85);
  ctx.bezierCurveTo(-215, -100, -245, 65, -130, 120);
  ctx.bezierCurveTo(-100, 95, -88, 55, -85, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(85, -85);
  ctx.bezierCurveTo(215, -100, 245, 65, 130, 120);
  ctx.bezierCurveTo(100, 95, 88, 55, 85, 0);
  ctx.stroke();
  // Inner ear creases
  ctx.beginPath();
  ctx.moveTo(-105, -58);
  ctx.bezierCurveTo(-185, -68, -205, 40, -125, 88);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(105, -58);
  ctx.bezierCurveTo(185, -68, 205, 40, 125, 88);
  ctx.stroke();
  // Head dome (top)
  ctx.beginPath();
  ctx.moveTo(-85, 0);
  ctx.bezierCurveTo(-100, -140, 100, -140, 85, 0);
  ctx.stroke();
  // Cheek curves down to trunk root
  ctx.beginPath();
  ctx.moveTo(85, 0);
  ctx.bezierCurveTo(80, 55, 55, 75, 35, 72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-85, 0);
  ctx.bezierCurveTo(-80, 55, -55, 75, -35, 72);
  ctx.stroke();
  // Trunk — left edge curling down then up at tip
  ctx.beginPath();
  ctx.moveTo(-35, 72);
  ctx.bezierCurveTo(-45, 135, -10, 185, 35, 188);
  ctx.bezierCurveTo(75, 188, 80, 158, 65, 142);
  ctx.stroke();
  // Trunk — right edge
  ctx.beginPath();
  ctx.moveTo(35, 72);
  ctx.bezierCurveTo(42, 115, 38, 145, 22, 155);
  ctx.bezierCurveTo(5, 162, -2, 145, 15, 132);
  ctx.lineTo(65, 142);
  ctx.stroke();
  // Trunk wrinkles
  ctx.beginPath();
  ctx.moveTo(-35, 92);
  ctx.quadraticCurveTo(0, 98, 35, 92);
  ctx.moveTo(-38, 112);
  ctx.quadraticCurveTo(0, 118, 38, 112);
  ctx.moveTo(-42, 132);
  ctx.quadraticCurveTo(-8, 138, 28, 130);
  ctx.moveTo(-32, 152);
  ctx.quadraticCurveTo(5, 158, 28, 150);
  ctx.stroke();
  // Tusks
  ctx.beginPath();
  ctx.moveTo(-52, 60);
  ctx.quadraticCurveTo(-64, 95, -46, 115);
  ctx.quadraticCurveTo(-38, 92, -40, 60);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(52, 60);
  ctx.quadraticCurveTo(64, 95, 46, 115);
  ctx.quadraticCurveTo(38, 92, 40, 60);
  ctx.closePath();
  ctx.stroke();
  // Eyes
  ctx.beginPath();
  ctx.arc(-45, -25, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(45, -25, 11, 0, Math.PI * 2);
  ctx.stroke();
  // Pupils
  ctx.beginPath();
  ctx.arc(-43, -23, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(47, -23, 5, 0, Math.PI * 2);
  ctx.stroke();
  // Eye sparkles
  ctx.beginPath();
  ctx.arc(-46, -28, 1.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(44, -28, 1.8, 0, Math.PI * 2);
  ctx.stroke();
  // Eyelashes (3 each)
  for (const sgn of [-1, 1]) {
    const cx = sgn * 45;
    for (const dx of [-9, -2, 5]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, -36);
      ctx.lineTo(cx + dx * 1.4, -46);
      ctx.stroke();
    }
  }
  // Forehead bump
  ctx.beginPath();
  ctx.moveTo(-18, -95);
  ctx.quadraticCurveTo(0, -118, 18, -95);
  ctx.stroke();
}

function drawGiraffe(ctx: CanvasRenderingContext2D) {
  // Head (top)
  ctx.beginPath();
  ctx.ellipse(0, -190, 58, 44, -0.05, 0, Math.PI * 2);
  ctx.stroke();
  // Snout extension
  ctx.beginPath();
  ctx.moveTo(-42, -180);
  ctx.bezierCurveTo(-72, -168, -72, -142, -48, -138);
  ctx.bezierCurveTo(-26, -134, -8, -150, -8, -170);
  ctx.stroke();
  // Nostril
  ctx.beginPath();
  ctx.arc(-62, -155, 2.8, 0, Math.PI * 2);
  ctx.stroke();
  // Mouth
  ctx.beginPath();
  ctx.moveTo(-42, -138);
  ctx.quadraticCurveTo(-30, -132, -18, -140);
  ctx.stroke();
  // Eye
  ctx.beginPath();
  ctx.ellipse(18, -200, 11, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(18, -200, 4.5, 0, Math.PI * 2);
  ctx.stroke();
  // Eye sparkle
  ctx.beginPath();
  ctx.arc(15, -203, 1.6, 0, Math.PI * 2);
  ctx.stroke();
  // Eyelashes
  ctx.beginPath();
  ctx.moveTo(9, -208);
  ctx.lineTo(4, -220);
  ctx.moveTo(18, -210);
  ctx.lineTo(18, -224);
  ctx.moveTo(27, -208);
  ctx.lineTo(32, -220);
  ctx.stroke();
  // Ears
  ctx.beginPath();
  ctx.moveTo(-38, -218);
  ctx.bezierCurveTo(-65, -250, -85, -240, -68, -212);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(48, -215);
  ctx.bezierCurveTo(72, -250, 92, -240, 75, -208);
  ctx.stroke();
  // Ossicones (horns with rounded knobs)
  ctx.beginPath();
  ctx.moveTo(-15, -225);
  ctx.lineTo(-19, -255);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-19, -260, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(25, -225);
  ctx.lineTo(29, -255);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(29, -260, 7, 0, Math.PI * 2);
  ctx.stroke();
  // Neck — back side curving down
  ctx.beginPath();
  ctx.moveTo(-42, -155);
  ctx.bezierCurveTo(-65, -60, -55, 110, -85, 245);
  ctx.stroke();
  // Neck — front side
  ctx.beginPath();
  ctx.moveTo(42, -155);
  ctx.bezierCurveTo(52, -60, 70, 110, 40, 245);
  ctx.stroke();
  // Mane tufts down the back of the neck
  const manePts: [number, number][] = [
    [-48, -120],
    [-52, -85],
    [-58, -45],
    [-62, 0],
    [-66, 50],
    [-72, 105],
    [-78, 160],
    [-82, 215],
  ];
  for (const [x, y] of manePts) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - 8, y + 8, x - 18, y + 16, x - 22, y + 18);
    ctx.stroke();
  }
  // Spots on neck (irregular blobs)
  const spots: [number, number, number][] = [
    [-32, -110, 13],
    [10, -95, 15],
    [-22, -55, 17],
    [25, -38, 14],
    [-12, 5, 16],
    [30, 30, 14],
    [-18, 65, 17],
    [22, 95, 14],
    [-12, 135, 16],
    [25, 165, 13],
    [-15, 200, 15],
  ];
  for (const [x, y, r] of spots) {
    ctx.beginPath();
    const sides = 7;
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const rr = r * (0.7 + ((i * 7 + Math.floor(x)) % 5) / 10);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

function drawPenguin(ctx: CanvasRenderingContext2D) {
  // Body (egg)
  ctx.beginPath();
  ctx.ellipse(0, 30, 115, 165, 0, 0, Math.PI * 2);
  ctx.stroke();
  // White belly inset
  ctx.beginPath();
  ctx.ellipse(0, 60, 78, 115, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Face mask (oval inside head area)
  ctx.beginPath();
  ctx.ellipse(0, -85, 62, 56, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Eyes
  ctx.beginPath();
  ctx.ellipse(-24, -92, 12, 15, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(24, -92, 12, 15, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Pupils
  ctx.beginPath();
  ctx.arc(-22, -90, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(26, -90, 6, 0, Math.PI * 2);
  ctx.stroke();
  // Eye sparkles
  ctx.beginPath();
  ctx.arc(-25, -94, 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(23, -94, 2, 0, Math.PI * 2);
  ctx.stroke();
  // Beak (open, wedge)
  ctx.beginPath();
  ctx.moveTo(-20, -58);
  ctx.lineTo(0, -32);
  ctx.lineTo(20, -58);
  ctx.closePath();
  ctx.stroke();
  // Beak opening line
  ctx.beginPath();
  ctx.moveTo(-15, -52);
  ctx.lineTo(15, -52);
  ctx.stroke();
  // Cheek dots (rosy)
  ctx.beginPath();
  ctx.arc(-45, -55, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(45, -55, 6, 0, Math.PI * 2);
  ctx.stroke();
  // Flippers
  ctx.beginPath();
  ctx.moveTo(-98, -25);
  ctx.bezierCurveTo(-155, 35, -155, 110, -98, 120);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(98, -25);
  ctx.bezierCurveTo(155, 35, 155, 110, 98, 120);
  ctx.closePath();
  ctx.stroke();
  // Feet (oval pads)
  ctx.beginPath();
  ctx.ellipse(-42, 200, 38, 18, 0.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(42, 200, 38, 18, -0.1, 0, Math.PI * 2);
  ctx.stroke();
  // Toe webbing lines
  for (const cx of [-42, 42]) {
    for (const dx of [-15, 0, 15]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, 192);
      ctx.lineTo(cx + dx * 1.1, 215);
      ctx.stroke();
    }
  }
  // Belly button / chest dot (tuft)
  ctx.beginPath();
  ctx.arc(0, 30, 6, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHorse(ctx: CanvasRenderingContext2D) {
  // Head + neck profile facing right.
  // Top of head & front of face curving to muzzle
  ctx.beginPath();
  ctx.moveTo(70, -130);
  ctx.bezierCurveTo(150, -110, 195, -60, 200, -10);
  ctx.bezierCurveTo(205, 30, 195, 55, 175, 62);
  ctx.stroke();
  // Underside of jaw → throat → neck front → chest
  ctx.beginPath();
  ctx.moveTo(175, 62);
  ctx.bezierCurveTo(155, 72, 130, 65, 110, 45);
  ctx.bezierCurveTo(85, 28, 60, 55, 35, 80);
  ctx.bezierCurveTo(25, 140, 45, 205, 70, 250);
  ctx.stroke();
  // Back of neck (crest sweeping down to shoulder)
  ctx.beginPath();
  ctx.moveTo(70, -130);
  ctx.bezierCurveTo(40, -90, -70, -40, -110, 60);
  ctx.bezierCurveTo(-135, 135, -130, 210, -100, 250);
  ctx.stroke();
  // Cheekbone
  ctx.beginPath();
  ctx.arc(132, 8, 13, 0, Math.PI * 2);
  ctx.stroke();
  // Eye
  ctx.beginPath();
  ctx.ellipse(155, -35, 10, 8, -0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(157, -35, 4.5, 0, Math.PI * 2);
  ctx.stroke();
  // Eye sparkle
  ctx.beginPath();
  ctx.arc(154, -38, 1.8, 0, Math.PI * 2);
  ctx.stroke();
  // Eyelashes
  ctx.beginPath();
  ctx.moveTo(148, -44);
  ctx.lineTo(144, -54);
  ctx.moveTo(155, -45);
  ctx.lineTo(154, -57);
  ctx.moveTo(162, -44);
  ctx.lineTo(167, -53);
  ctx.stroke();
  // Nostril
  ctx.beginPath();
  ctx.ellipse(186, 28, 6, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Mouth / lips
  ctx.beginPath();
  ctx.moveTo(165, 55);
  ctx.quadraticCurveTo(178, 65, 190, 55);
  ctx.stroke();
  // Ear
  ctx.beginPath();
  ctx.moveTo(82, -130);
  ctx.lineTo(62, -188);
  ctx.bezierCurveTo(82, -188, 110, -168, 105, -125);
  ctx.stroke();
  // Inner ear lines
  ctx.beginPath();
  ctx.moveTo(78, -148);
  ctx.lineTo(72, -178);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(72, -178);
  ctx.lineTo(98, -158);
  ctx.stroke();
  // Forelock falling between ears onto forehead
  ctx.beginPath();
  ctx.moveTo(85, -130);
  ctx.quadraticCurveTo(120, -138, 138, -98);
  ctx.quadraticCurveTo(118, -115, 98, -92);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(98, -92);
  ctx.quadraticCurveTo(118, -85, 128, -70);
  ctx.stroke();
  // Mane (locks flowing down the neck)
  const manePts: [number, number][] = [
    [50, -100],
    [15, -68],
    [-25, -32],
    [-60, 8],
    [-90, 58],
    [-112, 115],
    [-124, 170],
    [-128, 225],
  ];
  for (const [x, y] of manePts) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - 22, y + 12, x - 38, y + 28, x - 48, y + 28);
    ctx.stroke();
  }
}

function drawSnake(ctx: CanvasRenderingContext2D) {
  // Body — S-curve, top edge then bottom edge
  ctx.beginPath();
  ctx.moveTo(-200, -70);
  ctx.bezierCurveTo(-80, -160, 80, 80, 200, -30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-200, -10);
  ctx.bezierCurveTo(-80, -100, 80, 140, 200, 30);
  ctx.stroke();
  // Tail end cap (curl on the left)
  ctx.beginPath();
  ctx.moveTo(-200, -70);
  ctx.bezierCurveTo(-245, -70, -245, -10, -200, -10);
  ctx.stroke();
  // Head (oval at the right end)
  ctx.beginPath();
  ctx.ellipse(218, 0, 42, 33, -0.15, 0, Math.PI * 2);
  ctx.stroke();
  // Eye
  ctx.beginPath();
  ctx.arc(218, -12, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(220, -13, 3, 0, Math.PI * 2);
  ctx.stroke();
  // Eye highlight
  ctx.beginPath();
  ctx.arc(216, -15, 1.4, 0, Math.PI * 2);
  ctx.stroke();
  // Nostril
  ctx.beginPath();
  ctx.arc(252, -2, 2.5, 0, Math.PI * 2);
  ctx.stroke();
  // Mouth slit
  ctx.beginPath();
  ctx.moveTo(240, 16);
  ctx.lineTo(258, 12);
  ctx.stroke();
  // Forked tongue
  ctx.beginPath();
  ctx.moveTo(258, 13);
  ctx.lineTo(302, 22);
  ctx.moveTo(302, 22);
  ctx.lineTo(322, 14);
  ctx.moveTo(302, 22);
  ctx.lineTo(322, 30);
  ctx.stroke();
  // Belly scales — short cross strokes along the bottom curve
  for (let i = 0; i < 14; i++) {
    const t = 0.05 + (i / 13) * 0.9;
    const u = 1 - t;
    // Bottom-edge bezier: P0=(-200,-10), P1=(-80,-100), P2=(80,140), P3=(200,30)
    const x =
      u * u * u * -200 +
      3 * u * u * t * -80 +
      3 * u * t * t * 80 +
      t * t * t * 200;
    const y =
      u * u * u * -10 +
      3 * u * u * t * -100 +
      3 * u * t * t * 140 +
      t * t * t * 30;
    ctx.beginPath();
    ctx.moveTo(x, y - 2);
    ctx.lineTo(x, y - 16);
    ctx.stroke();
  }
  // Diamond/V scale markings along the back
  const scales: [number, number][] = [
    [-124, -65],
    [-65, -55],
    [-12, -25],
    [42, 10],
    [95, 30],
    [140, 27],
  ];
  for (const [x, y] of scales) {
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 6);
    ctx.lineTo(x, y + 8);
    ctx.lineTo(x + 14, y - 6);
    ctx.stroke();
  }
}
