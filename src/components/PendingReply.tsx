"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Asks the server for the site's reply to a fresh comment, then refreshes the thread. */
export function PendingReply({ id, page }: { id: string; page: string }) {
  const router = useRouter();
  const [state, setState] = useState<"working" | "waiting" | "failed">("working");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let timer: ReturnType<typeof setTimeout>;
    // The server saves the reply even if this request is cut off, so when it is, keep looking for
    // a couple of minutes rather than telling him it failed. A refresh drops this line once it lands.
    const waitAndLook = (left: number) => {
      setState(left > 0 ? "waiting" : "failed");
      if (left <= 0) return;
      timer = setTimeout(() => { router.refresh(); waitAndLook(left - 1); }, 15000);
    };
    fetch("/api/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, page }) })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const text = await r.text(); // keep-alive spaces, then one JSON line
        const last = text.trim().split("\n").pop() ?? "";
        if (!last.startsWith("{")) throw new Error("no result");
        router.refresh();
      })
      .catch(() => waitAndLook(8));
    return () => clearTimeout(timer);
  }, [id, page, router]);
  return (
    <p className="mt-3 data text-ink-soft" aria-live="polite">
      {state === "working"
        ? "The tree is looking this up, about half a minute…"
        : state === "waiting"
          ? "Still working on this; the reply will appear here on its own."
          : "The reply did not come through; it has been passed on."}
    </p>
  );
}
