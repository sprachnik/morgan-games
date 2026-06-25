"use client";

import { Lock } from "lucide-react";

import { BubbleSplash } from "@/components/games/bubble-splash";
import { Morgancraft } from "@/components/games/morgancraft";
import { PuppyQuest } from "@/components/games/puppy-quest";
import { TapTheStars } from "@/components/games/tap-the-stars";
import { UnicornSpeller } from "@/components/games/unicorn-speller";
import { getGame } from "@/lib/games";
import { href } from "@/lib/paths";

export function GameShell({ slug }: { slug: string }) {
  const game = getGame(slug);
  if (!game) return null;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-4">
        <div
          className={`flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br ring-2 ring-white/60 ${game.gradient}`}
        >
          <game.Icon className="size-9 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground text-pop sm:text-4xl">
            {game.title}
          </h1>
          <p className="text-base text-muted-foreground">{game.blurb}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        {game.slug === "sample-tap-the-stars" ? (
          <TapTheStars />
        ) : game.slug === "puppy-quest" ? (
          <PuppyQuest />
        ) : game.slug === "bubble-splash" ? (
          <BubbleSplash />
        ) : game.slug === "morgancraft" ? (
          <Morgancraft />
        ) : game.slug === "unicorn-speller" ? (
          <UnicornSpeller />
        ) : (
          <ComingSoon />
        )}
      </div>
    </div>
  );
}

function ComingSoon() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-card p-12 text-center ring-4 ring-white/70 shadow-pop">
      <div className="flex size-20 items-center justify-center rounded-full bg-fun-yellow/40 text-fun-magenta">
        <Lock className="size-10" strokeWidth={2.5} />
      </div>
      <p className="font-heading mt-6 text-3xl font-bold text-foreground sm:text-4xl">
        Almost ready!
      </p>
      <p className="mt-3 max-w-md text-lg text-muted-foreground">
        This game is still being made. Come back soon and it might be ready to
        play!
      </p>
      <a
        href={href("/")}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-bold text-primary-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
      >
        Pick another game
      </a>
    </div>
  );
}
