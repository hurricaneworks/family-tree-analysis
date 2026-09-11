# Put your own export here

Drop your GEDCOM export in this folder, then run:

```bash
npm run import -- "GEDCOM/your-export.ged"
```

**Nothing in this folder is committed.** The `.gitignore` keeps everything here out of
git except this README, because an export is a file full of real people, many of them
living. A file added and then deleted still sits in git history forever.

How to get an export: every major genealogy site offers one from its tree settings,
usually as "Export tree" or "Export GEDCOM". It is a plain text file. This project has
no other way in, and deliberately so. It never logs into a genealogy provider, and
scripted access to those sites is against their terms.

Keep your exports. They are dated snapshots, and the app shows you what changed between
one import and the next.
