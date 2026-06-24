import { ArrowRight, Lock, Sparkles } from "lucide-react";

import type { Game } from "@/lib/games";
import { href } from "@/lib/paths";
import { cn } from "@/lib/utils";

const statusLabel: Record<Game["status"], string> = {
  ready: "Play!",
  soon: "Coming Soon",
  idea: "On the Wishlist",
};

export function GameCard({ game }: { game: Game }) {
  const playable = game.status === "ready";

  const className = cn(
    "group relative flex flex-col overflow-hidden rounded-3xl bg-card p-6 ring-4 ring-white/70 transition-transform duration-200",
    "shadow-pop",
    playable
      ? "hover:-translate-y-1 hover:rotate-[-0.6deg] focus-visible:-translate-y-1"
      : "opacity-90",
  );

  if (playable) {
    return (
      <a href={href(`/games/${game.slug}`)} className={className}>
        <Inner game={game} />
      </a>
    );
  }

  return (
    <div className={className}>
      <Inner game={game} />
    </div>
  );
}

function Inner({ game }: { game: Game }) {
  const playable = game.status === "ready";
  const { Icon } = game;
  return (
    <>
      <div
        className={cn(
          "mb-5 flex h-32 items-center justify-center rounded-2xl bg-gradient-to-br ring-2 ring-white/60",
          game.gradient,
        )}
      >
        <Icon
          className="size-16 text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.18)] group-hover:animate-float"
          strokeWidth={2.4}
        />
      </div>

      <div className="flex items-center gap-2">
        <h3 className="font-heading text-2xl leading-tight font-bold text-foreground text-pop">
          {game.title}
        </h3>
        {playable && <Sparkles className="size-5 text-fun-magenta" aria-hidden />}
      </div>

      <p className="mt-2 text-base text-muted-foreground">{game.blurb}</p>

      <div className="mt-5 flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            playable
              ? "bg-fun-magenta/15 text-fun-magenta"
              : game.status === "soon"
                ? "bg-fun-yellow/30 text-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {playable ? <Sparkles className="size-4" /> : <Lock className="size-4" />}
          {statusLabel[game.status]}
        </span>
        {playable && (
          <span
            aria-hidden
            className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop-sm transition-transform group-hover:translate-x-0.5"
          >
            <ArrowRight className="size-5" strokeWidth={3} />
          </span>
        )}
      </div>
    </>
  );
}
