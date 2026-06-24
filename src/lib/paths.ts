const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prepend the configured basePath to an absolute app-relative path.
 * Use this with plain <a href> tags so we sidestep Next.js's layout-router
 * (which has been throwing transient "invariant" errors in dev HMR).
 */
export function href(path: string): string {
  if (!path.startsWith("/")) return path;
  // Keep trailing slash for /games/[slug] routes since we export with trailingSlash:true
  const needsSlash = path !== "/" && !path.endsWith("/");
  return `${BASE}${path}${needsSlash ? "/" : ""}`;
}
