import { GamesGallery } from "@/components/games-gallery";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-12 sm:px-10 sm:py-16">
      <GamesGallery />
    </main>
  );
}
