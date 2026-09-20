"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationFeedback() {
  const pathname = usePathname();
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const pending = destinationPath !== null && destinationPath !== pathname;

  useEffect(() => {
    const beginNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (`${destination.pathname}${destination.search}` === `${window.location.pathname}${window.location.search}`) return;
      setDestinationPath(destination.pathname);
    };
    const beginHistoryNavigation = () => setDestinationPath(window.location.pathname);
    document.addEventListener("click", beginNavigation);
    window.addEventListener("popstate", beginHistoryNavigation);
    return () => {
      document.removeEventListener("click", beginNavigation);
      window.removeEventListener("popstate", beginHistoryNavigation);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timeout = window.setTimeout(() => setDestinationPath(null), 10_000);
    return () => window.clearTimeout(timeout);
  }, [pending]);

  if (!pending) return null;
  return <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/15" role="progressbar" aria-label="Loading page"><div className="h-full w-1/3 animate-navigation-progress bg-primary motion-reduce:w-full motion-reduce:animate-pulse" /></div>;
}
