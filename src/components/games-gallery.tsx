"use client";

import { useState } from "react";

import { GameCard } from "@/components/game-card";
import { GamePager } from "@/components/game-pager";
import { getPage } from "@/lib/games";

export function GamesGallery() {
  const [requested, setRequested] = useState(1);
  const { items, page, totalPages, total } = getPage(requested);

  return (
    <>
      <header className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-fun-magenta shadow-pop-sm ring-4 ring-white/70">
          ✨ Made for Morgan ✨
        </p>
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
