import Link from "next/link";
import { getTree, searchPeople, spouseFamilies, type Tree, syncEdits } from "@/lib/data";
import { portraitFor } from "@/lib/media";
import { lifespan } from "@/lib/format";
import type { Person, Family } from "@/lib/types";

const COUNTRY_COLOURS: Record<string, string> = { Scotland: "#2f6a86", England: "#3f7a5a", Ireland: "#4c8a3c", Wales: "#3f7a5a", Australia: "#c2782a", Canada: "#b4413c", USA: "#8a5aa6", "New Zealand": "#2a8a86", "South Africa": "#a68a2a" };

/** Where a life ended up: the country of the last dated event, else of death, else of birth. */
function country(p: Person): string | null {
  const places = [...p.events].filter((e) => e.place).sort((a, b) => (a.date?.year ?? 0) - (b.date?.year ?? 0)).map((e) => e.place!);
  const last = p.death?.place ?? places[places.length - 1] ?? p.birth?.place;
  if (!last) return null;
  const l = last.toLowerCase();
  if (/australia|victoria|queensland|new south wales|tasmania|south australia/.test(l)) return "Australia";
  if (/canada|ontario|quebec|nova scotia|manitoba|alberta|british columbia|saskatchewan/.test(l)) return "Canada";
  if (/usa|united states|\b(ut|ny|ca|il|pa|oh|ma|nj|mi|wa|tx)\b|utah|illinois|new york|pennsylvania|massachusetts|california|ohio|michigan/.test(l)) return "USA";
  if (/new zealand/.test(l)) return "New Zealand";
  if (/south africa/.test(l)) return "South Africa";
  if (/ireland|donegal|antrim|dublin|derry|tyrone/.test(l)) return "Ireland";
  if (/wales|glamorgan|pembroke|carmarthen|dyfed/.test(l)) return "Wales";
  if (/england|lincolnshire|yorkshire|lancashire|london|northumberland|durham|cumberland|kent|surrey|devon|cheshire/.test(l)) return "England";
  if (/scotland|argyll|orkney|glasgow|edinburgh|lanark|renfrew|ayr|stirling|perth|inverness|ross|caithness|fife|angus|dumfries|roxburgh|midlothian|lothian|paisley|oban|westray|mull|islay|kintyre|campbeltown/.test(l)) return "Scotland";
  return null;
}

type Node = { person: Person; spouse: Person | null; marriage: string | null; children: Node[]; gen: number };

function build(tree: Tree, p: Person, gen: number, seen: Set<string>, maxGen: number): Node[] {
  if (seen.has(p.id) || gen > maxGen) return [];
  seen.add(p.id);
  return spouseFamilies(tree, p).map((m) => ({
    person: p,
    spouse: m.spouse,
    marriage: m.family.events.find((e) => e.type === "MARR")?.date?.year?.toString() ?? null,
    gen,
    children: m.children.flatMap((c) => {
      const own = build(tree, c, gen + 1, seen, maxGen);
      return own.length ? own : [{ person: c, spouse: null, marriage: null, gen: gen + 1, children: [] }];
    }),
  }));
}

function Tree({ nodes, tree }: { nodes: Node[]; tree: Tree }) {
  return (
    <ul className="dtree">
      {nodes.map((n, i) => {
        const c = country(n.person);
        const face = portraitFor(n.person.id);
        return (
          <li key={`${n.person.id}-${i}`}>
            <div className="node" style={{ borderLeftColor: c ? COUNTRY_COLOURS[c] ?? "#c9cfc9" : "#c9cfc9" }}>
              {face && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/photo/${face.id}`} alt="" className="border border-rule object-cover" style={{ width: 28, height: 28, flex: "none" }} />
              )}
              <span>
                <Link href={`/person/${n.person.id}`}>{n.person.name}</Link>
                <span className="data text-ink-soft"> {lifespan(n.person)}{c ? `, ${c}` : ""}</span>
                {n.spouse && (
                  <span className="data block">
                    m.{n.marriage ? ` ${n.marriage}` : ""} <Link href={`/person/${n.spouse.id}`}>{n.spouse.name}</Link>
                  </span>
                )}
              </span>
            </div>
            {n.children.length > 0 && <Tree nodes={n.children} tree={tree} />}
          </li>
        );
      })}
    </ul>
  );
}

import { Comments } from "@/components/Comments";
export default async function DescendantsPage({ searchParams }: { searchParams: Promise<{ from?: string; q?: string; gens?: string }> }) {
  await syncEdits();
  const { from, q, gens } = await searchParams;
  const tree = getTree();
  const maxGen = Math.min(Number(gens) || 5, 8);
  const start = from ? tree.byId.get(from) : undefined;
  const hits = q ? searchPeople(tree, q, 15) : [];

  let nodes: Node[] = [], all: Person[] = [], countries = new Map<string, number>();
  if (start) {
    nodes = build(tree, start, 0, new Set(), maxGen);
    const walk = (ns: Node[]) => { for (const n of ns) { if (n.gen > 0) all.push(n.person); walk(n.children); } };
    walk(nodes);
    for (const p of all) { const c = country(p) ?? "unknown"; countries.set(c, (countries.get(c) ?? 0) + 1); }
  }

  return (
    <>
      <h1>{start ? `Descendants of ${start.name}` : "Descendants of a couple"}</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Pick an ancestor and follow every branch downwards. The coloured edge on each name is the country they ended up in, so the emigrant branches stand out.
      </p>
      <form action="/descendants" className="mt-5 flex max-w-xl gap-3">
        <input name="q" defaultValue={q ?? ""} placeholder="Find an ancestor to start from" className="w-full border border-ink bg-white px-3 py-2 text-lg" />
        <button type="submit" className="border border-ink bg-ink px-5 py-2 text-lg text-paper">Find</button>
      </form>
      {hits.length > 0 && (
        <ul className="mt-3 max-w-xl divide-y divide-rule">
          {hits.map((p) => (
            <li key={p.id} className="py-1.5">
              <Link href={`/descendants?from=${p.id}`}>{p.name}</Link> <span className="data text-ink-soft">{lifespan(p)}{p.birth?.place ? `, ${p.birth.place}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {!start && !q && (
        <p className="mt-6 data">
          Pick anyone from the <Link href="/people">people list</Link> to see where their descendants ended up.
        </p>
      )}
      {start && (
        <>
          <p className="mt-6 data flex flex-wrap gap-x-5 gap-y-1">
            <span>{all.length} descendants in {maxGen} generations</span>
            {[...countries.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3" style={{ background: COUNTRY_COLOURS[c] ?? "#c9cfc9" }} />{c} {n}
              </span>
            ))}
            {maxGen < 8 && <Link href={`/descendants?from=${start.id}&gens=${maxGen + 2}`}>Show more generations</Link>}
          </p>
          <div className="mt-6 overflow-x-auto">
            <Tree nodes={nodes} tree={tree} />
          </div>
        </>
      )}
      <Comments page="/descendants" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
