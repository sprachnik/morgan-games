"use client";

import { useEffect, useRef, useState } from "react";

export function SiteFooter() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <footer className="mt-12 border-t border-white/40 bg-card/40 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p className="text-center font-semibold text-foreground/80 sm:text-left">
            © 2026 James &amp; Morgan Stalley-Moores ·{" "}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="underline decoration-fun-magenta decoration-2 underline-offset-2 transition-colors hover:text-fun-magenta"
            >
              Non-commercial licence
            </button>
          </p>

          <nav className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://www.linkedin.com/in/jamesmoores"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-semibold text-foreground/80 ring-2 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
              aria-label="LinkedIn — James Moores"
            >
              <LinkedinMark className="size-4" />
              <span>LinkedIn</span>
            </a>
            <a
              href="https://github.com/sprachnik/morgan-games"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-semibold text-foreground/80 ring-2 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
              aria-label="GitHub — morgan-games repo"
            >
              <GithubMark className="size-4" />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.anthropic.com/claude"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-semibold text-foreground/80 ring-2 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
            >
              <ClaudeMark className="size-4" />
              <span>
                Made with Claude <span className="text-fun-magenta">Opus 4.8</span>
              </span>
            </a>
          </nav>
        </div>
      </footer>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // Click on the backdrop (the dialog element itself, not its content) closes.
          if (e.target === dialogRef.current) setOpen(false);
        }}
        className="m-auto max-w-lg rounded-3xl bg-card p-0 text-foreground shadow-pop ring-4 ring-white/70 backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
      >
        <div className="p-6 sm:p-8">
          <h2 className="font-heading text-2xl font-bold text-foreground">
            Licence
          </h2>
          <p className="mt-3 text-sm font-semibold text-fun-purple">
            © 2026 James Stalley-Moores and Morgan Stalley-Moores
          </p>
          <div className="mt-4 space-y-3 text-sm text-foreground/80">
            <p>
              This project is released for personal, non-commercial use only.
            </p>
            <p>
              You may view, copy, share, and modify the code and assets for
              personal, educational, and other non-commercial purposes,
              provided that you give appropriate credit to the authors and
              indicate if changes were made.
            </p>
            <p>
              You{" "}
              <span className="font-bold text-fun-magenta">may not</span> use
              any part of this project for commercial purposes, sell it, or
              incorporate it into commercial products or services, without
              prior written permission from the authors.
            </p>
            <p className="text-xs text-muted-foreground">
              Formally licensed under{" "}
              <a
                href="https://creativecommons.org/licenses/by-nc/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-fun-magenta decoration-2 underline-offset-2 hover:text-fun-magenta"
              >
                CC BY-NC 4.0
              </a>
              . Full text in the{" "}
              <a
                href="https://github.com/sprachnik/morgan-games/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-fun-magenta decoration-2 underline-offset-2 hover:text-fun-magenta"
              >
                LICENSE file
              </a>
              .
            </p>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground ring-4 ring-white/70 shadow-pop-sm transition-transform hover:-translate-y-0.5"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.31-1.27-1.66-1.27-1.66-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.05-1.86-3.05-1.86 0-2.14 1.45-2.14 2.95v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.86 3.37-1.86 3.6 0 4.27 2.37 4.27 5.45v6.3zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.78C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.78 24h20.44c.98 0 1.78-.78 1.78-1.74V1.74C24 .78 23.2 0 22.22 0z" />
    </svg>
  );
}

function ClaudeMark({ className }: { className?: string }) {
  // Stylised burst mark inspired by the Claude/Anthropic icon.
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <g fill="#d97757">
        <path d="M12 1.5l1.5 6.5L20 12l-6.5 1.5L12 20l-1.5-6.5L4 12l6.5-1.5L12 1.5z" />
        <circle cx="5" cy="5" r="1.1" />
        <circle cx="19" cy="5" r="1.1" />
        <circle cx="5" cy="19" r="1.1" />
        <circle cx="19" cy="19" r="1.1" />
      </g>
    </svg>
  );
}
