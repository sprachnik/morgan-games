"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";

import { GameCard } from "@/components/game-card";
import { GamePager } from "@/components/game-pager";
import { games, getPage } from "@/lib/games";
import { href } from "@/lib/paths";

export function GamesGallery() {
  const [requested, setRequested] = useState(1);
  const { items, page, totalPages, total } = getPage(requested);

  const goRandom = () => {
    const ready = games.filter((g) => g.status === "ready");
    const pool = ready.length ? ready : games;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    window.location.href = href(`/games/${pick.slug}`);
  };

  return (
    <>
      <header className="text-center">
        <button
          type="button"
          onClick={goRandom}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5 hover:wiggle"
        >
          <Shuffle className="size-4" strokeWidth={3} />
          Random Game
        </button>
        <h1 className="font-heading mt-6 text-5xl font-bold leading-none tracking-tight text-foreground text-pop sm:text-7xl">
          <span className="bg-gradient-to-r from-fun-magenta via-fun-red to-fun-purple bg-clip-text text-transparent">
            Morgan&apos;s
          </span>{" "}
          Game Time!
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl">
          Pick a game from the colourful cards below. New games appear all the
          time — flip the pages to see what&apos;s next!
        </p>
        <p className="mt-3 text-sm font-semibold text-fun-purple">
          Page {page} of {totalPages} · {total} games in the gallery
        </p>
      </header>

      <section className="mt-12 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </section>

      <GamePager page={page} totalPages={totalPages} onPageChange={setRequested} />
    </>
  );
}
