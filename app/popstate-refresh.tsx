"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mounted once in the root layout, always present.
//
// Bug this fixes: from the project modal (intercepted /projects/[id],
// rendered in the @modal slot over the dashboard/projects list), clicking
// a milestone's Invoice/AR opens a document page — a plain route with no
// relation to @modal, reached via router.push. That push leaves the
// browser on a fresh history entry whose children/@modal pairing is
// "document page / null". Clicking Back (browser button or the toolbar's
// "Back to project") pops back to the /projects/[id] history entry, but
// Next's client router restores that entry from its own cache rather
// than re-resolving the route — and the cached pairing for that entry
// was captured mid-transition, before the intercepted modal had properly
// re-matched. Net effect: the URL bar shows /projects/[id] but the page
// shown is whatever children last was (the dashboard), with no modal.
//
// router.refresh() forces Next to re-fetch the RSC payload for the
// current URL from the server instead of trusting the client cache. On
// popstate specifically — the only navigation path where this staleness
// shows up — this reliably re-resolves both slots for whatever URL the
// browser just landed on, including re-opening the intercepted modal
// when the URL is /projects/[id].
export function PopstateRefresh() {
  const router = useRouter();

  useEffect(() => {
    function handlePopstate() {
      router.refresh();
    }
    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, [router]);

  return null;
}
