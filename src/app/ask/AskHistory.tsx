"use client";

import { useEffect, useState } from "react";
import type { Ask as AskRow } from "@/lib/asks";

/** The left-hand list of earlier questions; picking one shows it in the main column. */
export function AskHistory({ history }: { history: AskRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const onPick = () => setOpen(null);
    window.addEventListener("ask:new", onPick);
    return () => window.removeEventListener("ask:new", onPick);
  }, []);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <ul className="mt-3 divide-y divide-rule">
      {history.length === 0 && <li className="py-2 data text-ink-soft">Nothing asked yet.</li>}
      {history.map((h) => (
        <li key={h.id} className="py-2">
          <button
            type="button"
            onClick={() => { setOpen(h.id); window.dispatchEvent(new CustomEvent("ask:open", { detail: h })); }}
            className={`text-left ${open === h.id ? "text-ink font-semibold" : "text-sea"} underline decoration-1 underline-offset-2`}
          >
            {h.question.length > 90 ? h.question.slice(0, 88) + "…" : h.question}
          </button>
          <span className="data block text-ink-soft">{fmt(h.created_at)}{h.author ? `, ${h.author.split("@")[0]}` : ""}</span>
        </li>
      ))}
    </ul>
  );
}
