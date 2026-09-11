# Sample tree

`thorne-family.ged` is a small, entirely fictional family, so the app has something to show
on a fresh clone. `npm run dev` and `npm run build` load it automatically when nothing has
been imported yet (see `scripts/ensure-data.ts`). It is replaced the moment you import your
own export.

**It is invented, not anonymised.** Nobody in it has ever existed. Renaming real people
would leave real dates, places and family structure in place, which is still personal
data and is still re-identifiable, so the sample is written from scratch instead. The
places are real (Whitby, Merthyr Tydfil, County Mayo, Ballarat, Hamilton, Scranton);
the people, dates and events are not.

Unlike `GEDCOM/` and `data/`, this folder **is** committed. That is the point: it ships
with the app.

## What is in it

125 people in 39 families, centred on Margaret Thorne, born Whitby 1951. Her father's
line is Yorkshire fishing families, traced ten generations to a John Thorne born about
1685; her mother's is Welsh colliers and Irish famine emigrants to Liverpool. Three
branches leave: to Victoria in 1882, to Ontario in 1907, to Pennsylvania in 1879.

It has faults on purpose, so every screen has something to do:

- lines that stop close to home (a great-grandmother with no parents recorded);
- people with no death recorded, no birth date, or no dates at all;
- a marriage with no source and a child born two years before her parents married;
- two typos that do not add up: a mother aged six at her daughter's birth, and a life
  of 113 years;
- two probable duplicate records, for the compare-and-merge screen;
- nine people withheld by the living-person privacy rule (the import summary says ten: its
  simpler `living` flag does not look at children's births, `src/lib/privacy.ts` does).

`geocode.json` holds coordinates for every place in the file, so the map works without
a geocoding run. It is copied into `data/` alongside the import.
