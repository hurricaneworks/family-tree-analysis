# family-tree-analysis

Notes for anyone working on this code, with an AI assistant or without one. The README says what
the app is for; this file says how it is put together and what will bite you.

## Overview
- An open-source family-history web app: import a GEDCOM export, browse the tree, find the gaps worth
  researching next, and see the family in ways a genealogy site cannot (maps, fan charts, lifespan
  bars, a scroll-driven walk back through the generations).
- It was built for one elderly reader on a laptop, and **that reader is the design constraint.**
  Every decision answers "can an 81-year-old use this without help": large type, high contrast, no
  small controls, no cards, plain British English, nothing that needs a second click to discover.
  Keep that; it is the reason this exists when a dozen GEDCOM viewers already do.
- Locale/voice: British English. No em dashes or en dashes in copy.
- Licence MIT. Name `family-tree-analysis`.

## The privacy rule that governs this whole project

A family tree is full of living people. Publishing their details without consent is the risk this
project has to design around, not a detail to tidy up later. Three rules follow:

1. **No real family data in the repo, ever.** `GEDCOM/` and `data/` are tracked as folders but every
   file inside them is ignored, and `*.ged` is ignored everywhere except `samples/`. A file added and
   deleted is still in git history. This check must print nothing:
   ```bash
   find . -type f \( -name '*.ged' -o -name 'people.json' -o -name '.env.local' \) -not -path './.git/*' -not -path './samples/*' -not -path './node_modules/*' -not -path './.next/*'
   ```
2. **The sample tree is invented, not anonymised.** Renaming real people leaves real family structure,
   dates, places and relationships in place, which is still personal data and is re-identifiable.
   `samples/thorne-family.ged` was written from scratch; nobody in it ever existed. Keep it that way.
3. **Living people are withheld by default.** `src/lib/privacy.ts` decides who is plausibly living (no
   death or burial recorded, and an earliest known year, from their own facts or their children's
   births, within 100 years). `getTree()` applies it once at load unless `SHOW_LIVING_PEOPLE=true`:
   withheld people keep their name and family links and lose birth, death, events, notes, other
   names and pictures; a picture with such a person in it is withheld whole; gaps skip them;
   `lifespan()` says "may be living, details withheld". Every page, the print view, the digest and
   the chat tools read the same redacted tree, so there is no second place to get it wrong.

If you develop against a real tree, keep a private grep of its names outside the repo (`docs/` is
gitignored for exactly this) and run it before every push.

## Commands
```bash
npm ci           # install, always from the lockfile
npm run dev      # http://localhost:4130; imports samples/ automatically when data/ is empty
npm run build    # production build (also imports the sample if data/ is empty)
npx tsc --noEmit # type check, faster than a build
npm run import -- "GEDCOM/your-export.ged"   # replace the sample with your own tree
node scripts/geocode.ts [--limit N]           # coordinates for the map, via Nominatim, 1 request/s, resumable
node scripts/import-photos.ts data/images --local   # after scripts/browser-fetch-photos.js; see README "Getting your pictures"
node scripts/shot.mjs <url> "<selector>|none" out.png   # screenshot after scrolling to a selector
```
Stop `next dev` before `npm run build`: running both makes Turbopack panic.

## Configuration

Nothing about a particular family is compiled in. `src/lib/config.ts` reads it from the environment
with neutral fallbacks, so a fresh clone runs with no `.env.local` at all. `.env.example` documents
every variable.

| Setting | Falls back to |
|---|---|
| `NEXT_PUBLIC_ROOT_ID` | the first individual in the imported file |
| `NEXT_PUBLIC_ROOT_SHORT_NAME` | "the home person" |
| `NEXT_PUBLIC_TREE_NAME` | "the family tree" |
| `NEXT_PUBLIC_OWNER_NAME` | "the keeper" (whoever runs the site, in copy and emails) |
| `SITE_URL` | `http://localhost:4130` |
| `OWNER_EMAIL`, `MAIL_FROM` | unset means no email is sent |
| `CONTACT_EMAIL` | used in the User-Agent for Nominatim and Wikipedia |
| `SHOW_LIVING_PEOPLE` | unset: living people withheld (see above) |

Which optional features are on is decided in `src/lib/features.tsx`: `DATABASE` (three Supabase
keys), `AI_KEY`, `CHAT` (the key, plus the database on a production build so a public site cannot
spend it), `EMAIL`. Every page or library that needs one checks the flag; nothing else
should read those env vars directly. A feature that is off hides its nav entry, shows a one-line
`OffNotice` if reached by URL, and is listed on the home page with what would switch it on.

The home person resolves at load time in `src/lib/data.ts` and is exposed as `tree.rootId`; use
that, never the raw constant.

## Structure
- `scripts/import.ts` a zero-dependency GEDCOM 5.5.1 parser on Node's native TypeScript. Writes
  `data/*.json`. Probably the most reusable thing here. `scripts/ensure-data.ts` (predev/prebuild)
  imports the sample and copies `samples/geocode.json` when `data/` is empty.
- `src/lib/` the substance: `types.ts` (what the importer writes), `data.ts` (loads and indexes the
  tree once per process: parents, generations from the root, link steps), `privacy.ts`,
  `features.tsx`, `gaps.ts` (the research-gap rules), `ancestry.ts` (ahnentafel numbering shared by
  every visual view), `tools.ts` (the lookup tools the chat model calls), `world.ts`, `digest.ts`,
  `timeline.ts` (a life as readable entries, for the print page).
- `src/app/` the pages. Working: desk (`/`), list, gaps, people, person (+ print), compare, papers,
  ask, messages, log, changes. Visual: journey, fan, sixteen, lives, descendants, album, map.
- `src/components/SideNav.tsx` the left menu in three groups; `HelpDrawer` with text in `src/lib/help.ts`.
- `samples/` the invented family and its coordinates. `screenshots/` the README images.
- `supabase/migrations/` the optional schema: auth, tree edits, messages, tasks, notes.
- `scripts/geocode.ts` Nominatim geocoder with a `repair()` function of historical British county
  spellings; `read-documents.ts`, `classify-media.ts`, `import-photos.ts` drive
  the optional paid features and need their keys.

## Gotchas
- Family IDs in a GEDCOM export (`@F64@`) are sequential and **not stable** between exports; person IDs
  are the provider's own and are stable. Families are therefore keyed `<husband>|<wife>`.
- Ancestry writes an empty `1 DEAT` for anyone merely flagged deceased, so a `death` object existing
  does not mean a death is known. Test `death.date.year || death.place`. The privacy rule treats the
  bare marker as "recorded dead", because that is what the tree's owner meant by it.
- Never build `new Anthropic()` at module level in a route or a library a route imports: `next build`
  evaluates the module with no key and fails. Construct it inside the handler.
- The fan chart rounds `polar()` to three decimals: Node and the browser differ in the last bits of
  `Math.cos`, and React reported the SVG `x` as a hydration mismatch.
- Nominatim `jsonv2` results carry `category`, not `class`. Free-form queries with historical county
  names return roads, so the geocoder accepts only place-like hits.
- Leaflet must be created in an effect that can see its container. Rendering a "Loading" placeholder
  instead of the map div on first paint means the init effect finds nothing and never re-runs.
- `outputFileTracingIncludes` in `next.config.ts` ships the data directory with the serverless function.
  Without it every page 500s in production while working locally.
- Next.js 16 `next dev` appends an agent-rules block to CLAUDE.md unless `agentRules: false` is set in
  `next.config.ts` (it is).
- Postgres `ON CONFLICT (col)` needs a full unique index; a partial one fails with 42P10.
- The chat cannot hold a large tree in one prompt. The model looks records up with tools.
- Hosted PostgREST clamps `.limit(n)` to the project's `max_rows` (default 1000) with no error.
- `scripts/shot.mjs` drives Chrome over the DevTools protocol; a plain `--screenshot` cannot scroll to
  a fragment. To capture console errors as well, add listeners for `Runtime.consoleAPICalled`,
  `Runtime.exceptionThrown` and `Log.entryAdded`.

## Legal
- **No scraping.** The only supported input is a GEDCOM export the tree owner makes themselves.
  Genealogy sites have no public API for your tree and their terms forbid scripted access. Never
  ship code that logs into one.
- The AI features each need a third-party key and cost real money per use. They are optional and
  the app is fully usable with none of them; the README table gives the figures.
