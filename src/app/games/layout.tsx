import { Home } from "lucide-react";

import { RandomGameButton } from "@/components/random-game-button";
import { href } from "@/lib/paths";

export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8 sm:px-10">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={href("/")}
          className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-base font-bold text-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
        >
          <Home className="size-5" strokeWidth={3} />
          All Games
        </a>
        <RandomGameButton />
      </div>
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
