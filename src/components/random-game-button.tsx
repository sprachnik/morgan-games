"use client";

import { Shuffle } from "lucide-react";

import { games } from "@/lib/games";
import { href } from "@/lib/paths";
import { cn } from "@/lib/utils";

type Variant = "primary" | "card";

export function RandomGameButton({
  variant = "card",
  excludeSlug,
  className,
}: {
  variant?: Variant;
  excludeSlug?: string;
  className?: string;
}) {
  const goRandom = () => {
    const ready = games.filter((g) => g.status === "ready");
    const pool = (ready.length ? ready : games).filter(
      (g) => g.slug !== excludeSlug,
    );
    const chooseFrom = pool.length
      ? pool
      : ready.length
        ? ready
        : games;
    if (!chooseFrom.length) return;
    const pick = chooseFrom[Math.floor(Math.random() * chooseFrom.length)];
    window.location.href = href(`/games/${pick.slug}`);
  };

  return (
    <button
      type="button"
      onClick={goRandom}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-bold ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5 hover:wiggle",
        variant === "primary"
          ? "bg-primary text-primary-foreground"
          : "bg-card text-foreground",
        className,
      )}
    >
      <Shuffle className="size-5" strokeWidth={3} />
      Random Game
    </button>
  );
}
