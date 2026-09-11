/**
 * Lookup tools the chat model uses to answer questions about the tree.
 * A tree is far too large for one prompt (thousands of people, tens of thousands of citations), so the model
 * searches and reads records on demand, the way a researcher would.
 */
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { getTree, parentsOf, spouseFamilies, searchPeople, type Tree } from "./data";
import { getGaps, gapsFor, GAP_TITLES } from "./gaps";
import { ancestorLabel, eventLabel, fmtDate, lifespan } from "./format";
import { ROOT_SHORT_NAME } from "./config";
import type { Person } from "./types";

function relationship(tree: Tree, p: Person): string {
  const gen = tree.ancestorGen.get(p.id);
  if (gen === 0) return "the home person";
  if (gen !== undefined) return `${ROOT_SHORT_NAME}'s ${ancestorLabel(gen, p.sex)}`;
  const steps = tree.steps.get(p.id);
  return steps !== undefined ? `${steps} family links from ${ROOT_SHORT_NAME}` : `not connected to ${ROOT_SHORT_NAME}`;
}

function brief(tree: Tree, p: Person) {
  return {
    id: p.id,
    name: p.name,
    lifespan: lifespan(p),
    birthPlace: p.birth?.place ?? null,
    deathPlace: p.death?.place ?? null,
    relationship: relationship(tree, p),
  };
}

export const searchPeopleTool = betaTool({
  name: "search_people",
  description:
    "Find people in the tree by name, birthplace or birth year (all words must match). Returns the closest relations to the home person first. Use this before get_person when you only have a name.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Words to match against name, birthplace and birth year, e.g. 'smith york' or 'smith 1944'" },
      limit: { type: "integer", description: "Max results, default 15" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  run: ({ query, limit }: { query: string; limit?: number }) => {
    const tree = getTree();
    const hits = searchPeople(tree, query, Math.min(limit ?? 15, 40));
    return JSON.stringify(hits.map((p) => brief(tree, p)));
  },
});

export const getPersonTool = betaTool({
  name: "get_person",
  description: "Everything recorded about one person: names, dates, places, parents, marriages, children, every event with its sources, notes, and what the record is missing.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "Person id, as shown in the person's page URL" } },
    required: ["id"],
    additionalProperties: false,
  },
  run: ({ id }: { id: string }) => {
    const tree = getTree();
    const p = tree.byId.get(id);
    if (!p) return `No person with id ${id}`;
    const marriages = spouseFamilies(tree, p);
    return JSON.stringify({
      ...brief(tree, p),
      sex: p.sex,
      altNames: p.altNames,
      living: p.living,
      withheld: p.withheld ? "may be living: dates, places, events, notes and pictures are withheld by the site's privacy rule; say so if asked" : undefined,
      parents: parentsOf(tree, p.id).map((x) => brief(tree, x)),
      marriages: marriages.map((m) => ({
        spouse: m.spouse ? brief(tree, m.spouse) : null,
        events: m.family.events.map((e) => `${eventLabel(e.type)} ${fmtDate(e.date)}${e.place ? `, ${e.place}` : ""}`),
        children: m.children.map((c) => brief(tree, c)),
      })),
      events: p.events.map((e) => ({
        event: eventLabel(e.type),
        date: fmtDate(e.date) || null,
        place: e.place,
        detail: e.value ?? e.note ?? undefined,
        sources: e.citations.map((c) => (c.sourceId && tree.sources.get(c.sourceId)?.title) || "unnamed source"),
      })),
      notes: p.notes,
      citationCount: p.citationCount,
      gaps: gapsFor(getGaps(tree), p.id).map((g) => `${GAP_TITLES[g.kind].title}: ${g.detail}`),
      ancestryUrl: p.ancestryUrl,
    });
  },
});

export const getAncestorsTool = betaTool({
  name: "get_ancestors",
  description: "Walk up the tree from a person: parents, grandparents and so on, with the generation and line (paternal/maternal path). Defaults to the home person.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Person id; omit for the home person" },
      generations: { type: "integer", description: "How many generations up, default 4, max 12" },
    },
    additionalProperties: false,
  },
  run: ({ id, generations }: { id?: string; generations?: number }) => {
    const tree = getTree();
    const start = tree.byId.get(id ?? tree.rootId);
    if (!start) return `No person with id ${id}`;
    const max = Math.min(generations ?? 4, 12);
    const out: unknown[] = [];
    const walk = (p: Person, gen: number, path: string) => {
      if (gen > max) return;
      if (gen > 0) out.push({ generation: gen, relation: ancestorLabel(gen, p.sex), line: path, ...brief(tree, p) });
      for (const parent of parentsOf(tree, p.id)) walk(parent, gen + 1, path + (parent.sex === "F" ? "M" : "F"));
    };
    walk(start, 0, "");
    return JSON.stringify({ from: brief(tree, start), lineKey: "F = father's side, M = mother's side, read left to right", ancestors: out.slice(0, 400) });
  },
});

export const getDescendantsTool = betaTool({
  name: "get_descendants",
  description: "Walk down the tree from a person: children, grandchildren and so on.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Person id" },
      generations: { type: "integer", description: "How many generations down, default 3, max 8" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  run: ({ id, generations }: { id: string; generations?: number }) => {
    const tree = getTree();
    const start = tree.byId.get(id);
    if (!start) return `No person with id ${id}`;
    const max = Math.min(generations ?? 3, 8);
    const out: unknown[] = [];
    const walk = (p: Person, gen: number) => {
      if (gen > max || out.length > 400) return;
      if (gen > 0) out.push({ generation: gen, ...brief(tree, p) });
      for (const m of spouseFamilies(tree, p)) for (const c of m.children) walk(c, gen + 1);
    };
    walk(start, 0);
    return JSON.stringify({ from: brief(tree, start), descendants: out });
  },
});

export const findEventsTool = betaTool({
  name: "find_events",
  description:
    "Find recorded events (births, deaths, marriages, residences, arrivals, departures, military service...) by place, year range or type. Good for 'who was in Australia before 1900' or 'who emigrated'.",
  inputSchema: {
    type: "object",
    properties: {
      place: { type: "string", description: "Substring of the place, e.g. 'York' or 'Australia'" },
      yearFrom: { type: "integer" },
      yearTo: { type: "integer" },
      type: { type: "string", description: "Event type: BIRT, DEAT, MARR, RESI, BURI, Arrival, Departure, Military Service, EMIG, OCCU..." },
      limit: { type: "integer", description: "Max results, default 50, max 200" },
    },
    additionalProperties: false,
  },
  run: ({ place, yearFrom, yearTo, type, limit }: { place?: string; yearFrom?: number; yearTo?: number; type?: string; limit?: number }) => {
    const tree = getTree();
    const pl = place?.toLowerCase();
    const ty = type?.toLowerCase();
    const hits = tree.events.filter(
      (e) =>
        (!pl || e.place.toLowerCase().includes(pl)) &&
        (yearFrom === undefined || (e.year !== null && e.year >= yearFrom)) &&
        (yearTo === undefined || (e.year !== null && e.year <= yearTo)) &&
        (!ty || e.type.toLowerCase() === ty),
    );
    hits.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
    const max = Math.min(limit ?? 50, 200);
    return JSON.stringify({
      total: hits.length,
      showing: Math.min(max, hits.length),
      events: hits.slice(0, max).map((e) => {
        const p = tree.byId.get(e.personId);
        return { event: eventLabel(e.type), year: e.year, place: e.place, personId: e.personId, person: p?.name, relationship: p ? relationship(tree, p) : undefined };
      }),
    });
  },
});

export const gapsTool = betaTool({
  name: "list_gaps",
  description: "The research to-do list: lines that stop, missing births or deaths, uncited people, contradictions and duplicates, ranked with direct ancestors nearest the home person first.",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["line-stops", "no-birth", "no-death", "no-sources", "inconsistent", "duplicate"] },
      limit: { type: "integer", description: "default 20, max 100" },
    },
    additionalProperties: false,
  },
  run: ({ kind, limit }: { kind?: string; limit?: number }) => {
    const tree = getTree();
    const gaps = getGaps(tree).filter((g) => !kind || g.kind === kind);
    return JSON.stringify(gaps.slice(0, Math.min(limit ?? 20, 100)).map((g) => ({ kind: GAP_TITLES[g.kind].title, detail: g.detail, ...brief(tree, g.person) })));
  },
});

export const TOOLS = [searchPeopleTool, getPersonTool, getAncestorsTool, getDescendantsTool, findEventsTool, gapsTool];

/** Deterministic overview of the tree, so the system prompt is stable and cacheable. */
export function treeOverview(): string {
  const tree = getTree();
  const root = tree.byId.get(tree.rootId);
  const count = (f: (p: Person) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const p of tree.people) { const k = f(p); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => `${k} (${n})`).join(", ");
  };
  const eras = new Map<string, number>();
  for (const p of tree.people) { const y = p.birth?.date?.year; const k = y ? `${Math.floor(y / 100) * 100}s` : "undated"; eras.set(k, (eras.get(k) ?? 0) + 1); }
  return [
    `Home person: ${root?.name} (id ${tree.rootId}), ${root ? lifespan(root) : ""}${root?.birth?.place ? `, born ${root.birth.place}` : ""}.`,
    `People: ${tree.people.length}. Families: ${tree.families.length}. Connected to the home person: ${tree.steps.size}. Direct ancestors traced: ${tree.ancestorGen.size - 1}, deepest ${Math.max(...tree.ancestorGen.values())} generations.`,
    `Births by century: ${[...eras.entries()].sort().map(([k, n]) => `${k} ${n}`).join(", ")}.`,
    `Commonest surnames: ${count((p) => p.surname)}.`,
    `Commonest birthplaces: ${count((p) => p.birth?.place)}.`,
    `Export date: ${tree.meta.gedcomExportDate}.`,
  ].join("\n");
}
