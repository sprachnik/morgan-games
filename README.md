# Morgan's Game Time

A colourful kid-friendly game gallery built for my daughter, deployed to GitHub Pages.

**Live site:** https://sprachnik.github.io/morgan-games/

## Games

- **Puppy Quest** — a parallax runner where a girl rides a big pink puppy to a dragon's castle. Floaty jumps, scaling difficulty, telegraphed fireballs, dodge-the-dragon boss.
- **Bubble Splash** — pop rising bubbles to splash paint on a hidden line drawing. Save your masterpiece as a PNG.
- **Tap the Stars** — a quick reaction warm-up. Tap stars before they fly away.

## Stack

- Next.js 16 (App Router, static export)
- React 19
- Tailwind 4
- shadcn/ui
- pnpm
- Deployed via GitHub Actions → GitHub Pages

## Local dev

```sh
pnpm install
pnpm dev
```

## Build

```sh
pnpm build      # produces ./out for static hosting
```

The site uses `basePath: /morgan-games` in production so it lives under `https://sprachnik.github.io/morgan-games/`.
