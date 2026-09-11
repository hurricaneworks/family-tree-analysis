"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/** Where each page sits, so the trail and the Back button make sense everywhere. */
const SECTIONS: { match: RegExp; trail: { href: string; label: string }[]; here: string }[] = [
  { match: /^\/person\/[^/]+\/print/, trail: [{ href: "/people", label: "People" }], here: "Printable life" },
  { match: /^\/person\//, trail: [{ href: "/people", label: "People" }], here: "This person" },
  { match: /^\/compare/, trail: [{ href: "/gaps#duplicate", label: "Gaps" }], here: "Compare two records" },
  { match: /^\/picture\//, trail: [{ href: "/photos", label: "Pictures" }], here: "This picture" },
  { match: /^\/name-them/, trail: [{ href: "/photos", label: "Pictures" }], here: "Who is this?" },
  { match: /^\/people/, trail: [], here: "People" },
  { match: /^\/list/, trail: [], here: "My list" },
  { match: /^\/gaps/, trail: [], here: "Gaps" },
  { match: /^\/papers/, trail: [], here: "Papers" },
  { match: /^\/messages/, trail: [], here: "Messages" },
  { match: /^\/ask/, trail: [], here: "Ask" },
  { match: /^\/photos/, trail: [], here: "Pictures" },
  { match: /^\/journey/, trail: [], here: "Journey" },
  { match: /^\/fan/, trail: [], here: "Fan" },
  { match: /^\/sixteen/, trail: [], here: "The sixteen" },
  { match: /^\/lives/, trail: [], here: "Lives" },
  { match: /^\/descendants/, trail: [], here: "Descendants" },
  { match: /^\/album/, trail: [], here: "Album" },
  { match: /^\/map/, trail: [], here: "Map" },
  { match: /^\/log/, trail: [], here: "Log" },
  { match: /^\/changes/, trail: [], here: "Changes" },
  { match: /^\/start/, trail: [], here: "Start here" },
];

/** Back button plus a short trail: Home › People › This person. */
export function Crumbs() {
  const path = usePathname() ?? "/";
  const router = useRouter();
  if (path === "/" || path === "/login" || path === "/forgot" || path === "/reset") return null;
  const s = SECTIONS.find((x) => x.match.test(path));
  const trail = [{ href: "/", label: "Home" }, ...(s?.trail ?? [])];
  const fallback = trail[trail.length - 1].href;
  const back = () => { if (window.history.length > 1) router.back(); else router.push(fallback); };
  return (
    <nav aria-label="You are here" className="crumbs">
      <button type="button" onClick={back} className="crumbs-back">Back</button>
      <span className="crumbs-trail">
        {trail.map((t) => <span key={t.href}><Link href={t.href}>{t.label}</Link><span className="crumbs-sep">›</span></span>)}
        <span>{s?.here ?? ""}</span>
      </span>
    </nav>
  );
}
