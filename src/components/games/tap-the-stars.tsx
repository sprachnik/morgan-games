"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles, Star } from "lucide-react";

import { cn } from "@/lib/utils";

type Star = {
  id: number;
  x: number;
  y: number;
  hue: number;
  size: number;
  born: number;
  life: number;
};

const ROUND_SECONDS = 30;
const SPAWN_MS = 650;

export function TapTheStars() {
  const [stars, setStars] = useState<Star[]>([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(ROUND_SECONDS);
  const [running, setRunning] = useState(false);
  const idRef = useRef(0);

  const startGame = useCallback(() => {
    setScore(0);
    setTime(ROUND_SECONDS);
    setStars([]);
    setRunning(true);
  }, []);

  // Countdown
  useEffect(() => {
    if (!running) return;
    if (time <= 0) {
      setRunning(false);
      setStars([]);
      return;
    }
    const t = setTimeout(() => setTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, time]);

  // Spawner
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => {
      setStars((current) => {
        const now = Date.now();
        const alive = current.filter((s) => now - s.born < s.life);
        if (alive.length >= 5) return alive;
        idRef.current += 1;
        const next: Star = {
          id: idRef.current,
          x: 8 + Math.random() * 84,
          y: 12 + Math.random() * 76,
          hue: Math.floor(Math.random() * 360),
          size: 56 + Math.random() * 36,
          born: now,
          life: 1700 + Math.random() * 900,
        };
        return [...alive, next];
      });
    }, SPAWN_MS);
    return () => clearInterval(i);
  }, [running]);

  // Reaper — drop stars that timed out
  useEffect(() => {
    if (!running) return;
    const r = setInterval(() => {
      const now = Date.now();
      setStars((current) => current.filter((s) => now - s.born < s.life));
    }, 200);
    return () => clearInterval(r);
  }, [running]);

  const pop = (id: number) => {
    setStars((current) => current.filter((s) => s.id !== id));
    setScore((s) => s + 1);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ScoreChip label="Score" value={score.toString()} accent="magenta" />
        <ScoreChip
          label="Time"
          value={`${time}s`}
          accent={time <= 5 ? "red" : "purple"}
        />
        <button
          type="button"
          onClick={startGame}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-bold text-primary-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
        >
          {running || time === ROUND_SECONDS ? (
            <>
              <Sparkles className="size-5" strokeWidth={3} />
              {running ? "Playing!" : "Start"}
            </>
          ) : (
            <>
              <RotateCcw className="size-5" strokeWidth={3} />
              Play Again
            </>
          )}
        </button>
      </div>

      <div
        className={cn(
          "relative mt-6 flex-1 overflow-hidden rounded-3xl ring-4 ring-white/70 shadow-pop",
          "bg-gradient-to-br from-fun-purple via-fun-magenta to-fun-pink",
        )}
        style={{ minHeight: 420 }}
      >
        {/* sparkle background dots */}
        <div className="pointer-events-none absolute inset-0 opacity-60">
          {sparkleSeeds.map((s, i) => (
            <span
              key={i}
              className="absolute size-1.5 rounded-full bg-white/70"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            />
          ))}
        </div>

        {!running && time === ROUND_SECONDS && (
          <Overlay title="Ready?" subtitle="Tap the stars before they fly away!" />
        )}
        {!running && time !== ROUND_SECONDS && (
          <Overlay
            title={score === 0 ? "Try again!" : `You got ${score}!`}
            subtitle={
              score >= 15
                ? "Amazing job, superstar!"
                : score >= 8
                  ? "Great work!"
                  : "Have another go?"
            }
          />
        )}

        {stars.map((star) => (
          <button
            key={star.id}
            type="button"
            onClick={() => pop(star.id)}
            aria-label="Pop the star"
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-90"
            style={{ left: `${star.x}%`, top: `${star.y}%` }}
          >
            <Star
              fill="white"
              strokeWidth={2.5}
              style={{
                width: star.size,
                height: star.size,
                color: `hsl(${star.hue}deg 95% 75%)`,
                filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.18))",
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function Overlay({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/15 backdrop-blur-[1px]">
      <p className="font-heading text-5xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-6xl">
        {title}
      </p>
      <p className="mt-3 text-xl font-semibold text-white/95 sm:text-2xl">
        {subtitle}
      </p>
    </div>
  );
}

function ScoreChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "magenta" | "purple" | "red";
}) {
  const accentClass = {
    magenta: "text-fun-magenta",
    purple: "text-fun-purple",
    red: "text-fun-red",
  }[accent];
  return (
    <div className="inline-flex items-baseline gap-3 rounded-full bg-card px-5 py-2.5 ring-4 ring-white/70 shadow-pop-sm">
      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className={cn("font-heading text-3xl font-bold", accentClass)}>
        {value}
      </span>
    </div>
  );
}

const sparkleSeeds = Array.from({ length: 40 }).map(() => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
}));
