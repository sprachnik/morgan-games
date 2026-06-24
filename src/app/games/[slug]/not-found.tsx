import Link from "next/link";
import { Frown } from "lucide-react";

export default function GameNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-card p-12 text-center ring-4 ring-white/70 shadow-pop">
      <div className="flex size-20 items-center justify-center rounded-full bg-fun-pink/30 text-fun-magenta">
        <Frown className="size-10" strokeWidth={2.5} />
      </div>
      <p className="font-heading mt-6 text-3xl font-bold text-foreground sm:text-4xl">
        Hmm, can&apos;t find that one!
      </p>
      <p className="mt-3 max-w-md text-lg text-muted-foreground">
        That game isn&apos;t in the gallery. Let&apos;s pick something fun together.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-bold text-primary-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
      >
        Back to the games
      </Link>
    </div>
  );
}
