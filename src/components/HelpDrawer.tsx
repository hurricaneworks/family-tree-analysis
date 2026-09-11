"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { helpFor } from "@/lib/help";

/** A right-hand panel with a short guide to the current page. Remembers whether it was left open. */
export function HelpDrawer() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setOpen(localStorage.getItem("help-open") === "1"); } catch {} }, []);
  useEffect(() => { document.body.classList.toggle("help-open", open); }, [open]);
  const toggle = () => { const v = !open; setOpen(v); try { localStorage.setItem("help-open", v ? "1" : "0"); } catch {} };
  const help = helpFor(path ?? "/");
  return (
    <>
      {!open && (
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls="help-drawer" className="help-button">Help</button>
      )}
      <aside id="help-drawer" className={`help-drawer ${open ? "is-open" : ""}`} aria-label="Help for this page" hidden={!open}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="data text-ink-soft">Help</p>
          <button type="button" onClick={toggle} className="help-button">Close</button>
        </div>
        <h2>{help.title}</h2>
        {help.body.map((p, i) => <p key={i} className="mt-3">{p}</p>)}
        <p className="mt-6 data text-ink-soft">Still stuck? Write in the comment box at the foot of the page and the tree will answer.</p>
        <p className="mt-6"><button type="button" onClick={toggle} className="help-button">Close help</button></p>
      </aside>
    </>
  );
}
