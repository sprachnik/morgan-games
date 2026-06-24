import type { LucideIcon } from "lucide-react";
import { Boxes, Castle, Palette, Sparkles } from "lucide-react";

export type GameStatus = "ready" | "soon" | "idea";

export type Game = {
  slug: string;
  title: string;
  blurb: string;
  Icon: LucideIcon;
  /** Tailwind utility classes describing the gradient swatch behind the icon. */
  gradient: string;
  status: GameStatus;
};

export const games: Game[] = [
  {
    slug: "morgancraft",
    title: "Morgancraft",
    blurb: "Dig and build with rainbow blocks in a tiny 3D world.",
    Icon: Boxes,
    gradient: "from-fun-yellow via-fun-mint to-fun-purple",
    status: "ready",
  },
  {
    slug: "puppy-quest",
    title: "Puppy Quest",
    blurb: "Ride the big pink puppy to the castle and beat the dragon!",
    Icon: Castle,
    gradient: "from-fun-purple via-fun-magenta to-fun-pink",
    status: "ready",
  },
  {
    slug: "bubble-splash",
    title: "Bubble Splash",
    blurb: "Pop the sparkly bubbles to splash paint on a picture.",
    Icon: Palette,
    gradient: "from-fun-mint via-fun-magenta to-fun-pink",
    status: "ready",
  },
  {
    slug: "sample-tap-the-stars",
    title: "Tap the Stars",
    blurb: "Pop the twinkly stars before they fly away!",
    Icon: Sparkles,
    gradient: "from-fun-magenta via-fun-pink to-fun-yellow",
    status: "ready",
  },
];

export const GAMES_PER_PAGE = 6;

export function getPage(page: number) {
  const total = games.length;
  const totalPages = Math.max(1, Math.ceil(total / GAMES_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * GAMES_PER_PAGE;
  return {
    items: games.slice(start, start + GAMES_PER_PAGE),
    page: safePage,
    totalPages,
    total,
  };
}

export function getGame(slug: string) {
  return games.find((g) => g.slug === slug);
}
