"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function GamePager({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label="Games pagination"
      className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row"
    >
      <PageButton
        disabled={!hasPrev}
        onClick={() => hasPrev && onPageChange(page - 1)}
        direction="prev"
      >
        Back
      </PageButton>

      <div className="flex items-center gap-2">
        {Array.from({ length: totalPages }).map((_, idx) => {
          const target = idx + 1;
          const isActive = target === page;
          return (
            <button
              type="button"
              key={target}
              onClick={() => onPageChange(target)}
              aria-current={isActive ? "page" : undefined}
              aria-label={`Go to page ${target}`}
              className={cn(
                "flex size-12 items-center justify-center rounded-full text-xl font-bold ring-4 ring-white/70 transition-transform",
                isActive
                  ? "bg-primary text-primary-foreground shadow-pop-sm scale-110"
                  : "bg-card text-foreground hover:-translate-y-0.5",
              )}
            >
              {target}
            </button>
          );
        })}
      </div>

      <PageButton
        disabled={!hasNext}
        onClick={() => hasNext && onPageChange(page + 1)}
        direction="next"
      >
        More!
      </PageButton>
    </nav>
  );
}

function PageButton({
  onClick,
  children,
  disabled,
  direction,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  direction: "prev" | "next";
}) {
  const baseClass = cn(
    "inline-flex items-center gap-2 rounded-full px-6 py-3 text-lg font-bold ring-4 ring-white/70 transition-transform",
    disabled
      ? "bg-muted text-muted-foreground opacity-60"
      : "bg-card text-foreground shadow-pop-sm hover:-translate-y-1",
  );
  const icon =
    direction === "prev" ? (
      <ArrowLeft className="size-6" strokeWidth={3} />
    ) : (
      <ArrowRight className="size-6" strokeWidth={3} />
    );

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={baseClass}>
      {direction === "prev" && icon}
      {children}
      {direction === "next" && icon}
    </button>
  );
}
