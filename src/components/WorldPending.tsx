"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Asks the server to build "Their world" for this person, then refreshes the page. */
export function WorldPending({ id }: { id: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/world", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      .then(async (r) => { const t = await r.text(); if (!r.ok || !t.trim().split("\n").pop()?.includes('"ok":true')) throw new Error("no"); router.refresh(); })
      .catch(() => setFailed(true));
  }, [id, router]);
  return <p className="data text-ink-soft">{failed ? "Could not gather the background just now." : "Gathering the background from the year pages, about half a minute…"}</p>;
}
