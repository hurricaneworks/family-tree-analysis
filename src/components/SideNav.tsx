"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = readonly [href: string, label: string, hint: string];

/**
 * Three groups, in the order the work happens: what to do, where to look it up, ways to see it.
 * The hint under each label is what tells the reader which is which, so it is part of the link, not decoration.
 */
const GROUPS: { title: string; note?: string; items: readonly Item[] }[] = [
  {
    title: "Doing",
    items: [
      ["/", "Home", "Where the tree stands today"],
      ["/list", "My list", "What to do on Ancestry, in order"],
      ["/gaps", "Gaps", "What the tree is missing"],
      ["/papers", "Papers", "Where certificates disagree"],
    ],
  },
  {
    title: "Looking things up",
    items: [
      ["/people", "People", "Find anyone by name or place"],
      ["/ask", "Ask", "Ask a question in plain words"],
      ["/photos", "Pictures", "The whole gallery"],
      ["/messages", "Messages", "Your comments and the replies"],
    ],
  },
  {
    title: "Seeing it whole",
    items: [
      ["/journey", "Journey", "Scroll back through the generations"],
      ["/fan", "Fan", "Seven generations in rings"],
      ["/sixteen", "The sixteen", "Your great-great-grandparents"],
      ["/lives", "Lives", "Lifespans side by side"],
      ["/descendants", "Descendants", "Every branch below a couple"],
      ["/album", "Album", "Pictures by decade"],
      ["/map", "Map", "Where the family has been"],
    ],
  },
];

const FOOT: readonly Item[] = [
  ["/start", "Start here", "How it all fits together"],
  ["/log", "Log", "Decisions made here"],
  ["/changes", "Changes", "Each fresh export"],
];

function Item({ item, path, onPick }: { item: Item; path: string; onPick: () => void }) {
  const [href, label, hint] = item;
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <li>
      <Link href={href} onClick={onPick} className={`nav-link${active ? " is-here" : ""}`} aria-current={active ? "page" : undefined}>
        <span className="nav-label">{label}</span>
        <span className="nav-hint">{hint}</span>
      </Link>
    </li>
  );
}

/** Left-hand menu: work, lookup, views, then the quiet links. One Menu button on small screens. */
export function SideNav({ treeName, signOut, hidden = [] }: { treeName: string; signOut: React.ReactNode; hidden?: string[] }) {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className="sidenav-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="sidenav">{open ? "Close menu" : "Menu"}</button>
      <nav id="sidenav" className={`sidenav ${open ? "is-open" : ""}`} aria-label="Site">
        <Link href="/" onClick={close} className="nav-brand">The family tree</Link>
        <p className="nav-brand-sub">{treeName}</p>
        {GROUPS.map((g) => (
          <div key={g.title} className="nav-group">
            <p className="nav-group-title">{g.title}</p>
            <ul>{g.items.filter((i) => !hidden.includes(i[0])).map((i) => <Item key={i[0]} item={i} path={path} onPick={close} />)}</ul>
          </div>
        ))}
        <div className="nav-group nav-quiet">
          <ul>{FOOT.filter((i) => !hidden.includes(i[0])).map((i) => <Item key={i[0]} item={i} path={path} onPick={close} />)}</ul>
        </div>
        {signOut && <div className="nav-signout">{signOut}</div>}
      </nav>
    </>
  );
}
