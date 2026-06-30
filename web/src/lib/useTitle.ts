import { useEffect } from "react";

export const BRAND = "BrightKids";

/**
 * useTitle sets the browser tab/document title for the current page, suffixed
 * with the product name (e.g. "Settings · BrightKids"). Pass nothing — or an
 * empty string while data is still loading — to show just the brand. Set
 * `exact` to use the given string verbatim (e.g. the branded landing title).
 */
export function useTitle(page?: string, opts?: { exact?: boolean }): void {
  const exact = opts?.exact ?? false;
  useEffect(() => {
    if (exact && page) document.title = page;
    else document.title = page ? `${page} · ${BRAND}` : BRAND;
  }, [page, exact]);
}
