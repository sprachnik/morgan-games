import { notFound } from "next/navigation";

import { GameShell } from "@/components/game-shell";
import { games, getGame } from "@/lib/games";

export function generateStaticParams() {
  return games.map((g) => ({ slug: g.slug }));
}

export const dynamicParams = false;

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getGame(slug)) notFound();
  return <GameShell slug={slug} />;
}
