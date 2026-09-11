/** Help text for each page, shown in the right-hand drawer. Plain words, no jargon; the reader may be elderly and new to all this. */
export type Help = { title: string; body: string[] };

const HELP: { match: RegExp; help: Help }[] = [
  { match: /^\/start/, help: { title: "Start here", body: ["The whole site on one page. Come back to it whenever you have been away for a while."] } },
  { match: /^\/$/, help: { title: "Home", body: [
    "This is the front page. The top line says how big the tree is and how much of it connects to you.",
    "\"Worth looking at next\" picks the five things most likely to open up a line: direct ancestors whose parents are unknown, and dates that contradict each other. Nearest generations first.",
    "\"Gaps by kind\" counts every kind of gap. Click a kind to see the full list.",
    "\"What the papers say\" appears when certificates and registers disagree with the tree.",
  ] } },
  { match: /^\/gaps/, help: { title: "Gaps in the record", body: [
    "Six lists of what the tree is missing or gets wrong. In each list your direct ancestors come first, nearest generation first, then everyone else by how closely they connect to you.",
    "Lines that stop: people with no parents recorded. No birth date, no death: what it says. Nothing to back it up: not one source citation. Doesn't add up: dates that cannot both be true. Possible duplicates: the same name and birth year twice, which is sometimes one person and sometimes two.",
    "The Open link on each row takes you to that person on Ancestry so you can fix it there.",
    "Only the first 60 of each kind are shown; \"Show every entry\" shows all of them.",
  ] } },
  { match: /^\/people/, help: { title: "Finding a person", body: [
    "Type any part of a name, a place, or a year. All the words must match, so \"smith york\" finds Smiths born in York.",
    "Results are ordered by closeness to you, so your own line comes first.",
    "Each result opens the person's page.",
  ] } },
  { match: /^\/person\/[^/]+\/print/, help: { title: "Printing a life", body: [
    "This is the page to print or save. Press the button, then in the print window choose Save as PDF if you want to send it by email rather than put it on paper.",
    "It holds the whole life in order, the family, the pictures, what the papers say, and where each fact came from.",
  ] } },
  { match: /^\/person\//, help: { title: "A person's page", body: [
    "The line under the name says how they relate to you. The photo, if there is one, comes from the Ancestry gallery.",
    "\"What is missing here\" lists this person's gaps. A duplicate flag links to the other record and to a side-by-side comparison.",
    "Pictures and papers are everything attached to them on Ancestry. A certificate shows what it says and where it differs from the tree.",
    "Family lists parents, marriages and children; Life in the records lists every dated fact with its sources.",
    "Their world: background on the year and the day they were born and died, from Wikipedia's year pages, with a short note written from them. It is scene-setting, not family record, and links to the pages it came from.",
    "Comments at the bottom: ask a question or correct a fact. The tree replies within about half a minute. A correction is added to My list for you to make there.",
  ] } },
  { match: /^\/compare/, help: { title: "Same person twice?", body: [
    "Two records side by side. Look at the parents, spouses and children rows first: if they match, it is one person entered twice.",
    "Keep one and merge the other, and the site shows one person straight away. Nothing changes on Ancestry until you do it there: open the record to keep, Tools, Merge with duplicate.",
    "If they are two different people, say so and the pair leaves the duplicates list for good.",
    "Every decision is in the Log and can be undone.",
  ] } },
  { match: /^\/photos/, help: { title: "Pictures and papers", body: [
    "Every picture from the Ancestry gallery, sorted by what it is. Click a picture to see it full size.",
    "Each tile shows the first line of whatever is written about it. Click to open the picture full size with the rest.",
    "Pictures nobody has named are collected on the Who is this? page.",
  ] } },
  { match: /^\/picture\//, help: { title: "One picture", body: [
    "The picture at full size, with everything written about it: what is on it, what the family has added, and what a certificate says when it has been read.",
    "Click the picture itself to open it alone in a tab, where you can save it.",
    "The names on the right are the people it is attached to. If somebody is missing, say so in the comment box at the foot.",
  ] } },
  { match: /^\/papers/, help: { title: "What the papers say", body: [
    "Each certificate, register page and headstone has been read and compared with the tree, fact by fact.",
    "Differs means the paper and the tree disagree; not in the tree means the paper has a fact the tree lacks, such as an occupation or a cause of death.",
    "The readings are machine-made and the scans are small, so check the image before changing anything on Ancestry.",
  ] } },
  { match: /^\/name-them/, help: { title: "Who is this?", body: [
    "Pictures the export could not label. Write who is in it and anything you remember, then Save, or Save and next to move on.",
    "To attach a person, find them by name in the box and press attach. Skip this one leaves it for later.",
    "Your notes stay here and go on My list so you can add them there too.",
  ] } },
  { match: /^\/list/, help: { title: "My list", body: [
    "The one list of things to do on Ancestry, in order of importance: your direct line first, nearest generation first. Move anything up or down, or to the top.",
    "Things get on the list four ways: Add to my list on a gap or a paper finding; merges, corrections and picture notes join by themselves; and you can write your own, about a person or not.",
    "Each item links to the right record on Ancestry. Tick Done on Ancestry once you have made the change there; nothing on this site changes Ancestry by itself.",
    "When the next export is loaded, every ticked item is checked against it. If the export agrees it is marked confirmed; if it still shows the gap it comes back onto the list with a note saying so.",
  ] } },
  { match: /^\/log/, help: { title: "What we have changed", body: [
    "Every decision made on this site about the tree, newest first, with who made it and when. Undo puts things back; the entry stays in the log, struck through.",
  ] } },
  { match: /^\/messages/, help: { title: "Messages", body: [
    "Every comment left anywhere on the site, with its replies. Open ones first.",
    "The tree replies at once. Anything it cannot do itself is marked \"being looked at\" and passed to whoever runs the site.",
    "Mark done hides a thread from the open list; Reopen brings it back.",
  ] } },
  { match: /^\/ask/, help: { title: "Ask the tree", body: [
    "Ask in plain words, as you would ask a person. It looks things up in the records before answering and links everyone it names, so you can check each one.",
    "It only knows what is in the tree. If something is not recorded it will say so.",
    "Every question and answer is kept in the left-hand column; click one to read it again. Start again clears the conversation.",
  ] } },
  { match: /^\/journey/, help: { title: "The long walk back", body: [
    "Scroll down and the years run back. Each stop is one generation of your direct ancestors: how many are known, where they were born, and a few dated events.",
    "Blue edges are your father's side, heather your mother's. A gold ring means that person's parents are unknown; a dashed box is a place in the generation with nobody in it yet.",
    "Click any face to open the person.",
  ] } },
  { match: /^\/fan/, help: { title: "The fan", body: [
    "You are at the centre; each ring outwards is one generation. Father's side on the left, mother's on the right.",
    "Empty dashed wedges are lines that stop. Move over a wedge to see who it is; click to open them.",
    "The names under the chart re-centre the fan on that person so you can go further back.",
  ] } },
  { match: /^\/sixteen/, help: { title: "The sixteen", body: [
    "Your sixteen great-great-grandparents, grouped under the grandparent they lead to. The line under each name reads from you outwards: father's father's mother is your father's father's mother.",
    "A note in brown means their parents are unknown or the record has other gaps.",
  ] } },
  { match: /^\/lives/, help: { title: "Lives, side by side", body: [
    "Each bar is one life, birth to death, for you and six generations back. Faint bars are estimates where a date is missing.",
    "The dotted lines are census nights, when the records were taken; the shaded bands are the famine and the wars.",
    "Move over a bar to see who it is; click to open them.",
  ] } },
  { match: /^\/descendants/, help: { title: "Descendants of a couple", body: [
    "Find an ancestor, then follow every branch downwards. The coloured edge on each name is the country they ended up in, so the branches that went to Australia, Canada or America stand out.",
    "Show more generations goes deeper; the tree stops at eight.",
  ] } },
  { match: /^\/album/, help: { title: "The album", body: [
    "Every picture in its decade. Papers are placed by the date on them; photographs by the age of the people in them where no date is known, marked \"about\".",
    "Decades with only papers are folded up; click to open them.",
  ] } },
  { match: /^\/map/, help: { title: "Where the family has been", body: [
    "Every dated event placed on the map. Drag the year to move a 25-year window through time, or tick Show every year.",
    "Bigger circles mean more people; hollow rings mean the place could only be found to the parish or county. Click a circle to see who was there.",
  ] } },
  { match: /^\/changes/, help: { title: "What changed", body: [
    "One entry for each time a fresh Ancestry export was loaded, showing who was added, removed or changed since the one before.",
  ] } },
];

export function helpFor(path: string): Help {
  return HELP.find((h) => h.match.test(path))?.help ?? { title: "This site", body: ["A private view of the family tree, built from the Ancestry export. Nothing here changes Ancestry.", "Every page has a comment box at the bottom if something is unclear."] };
}
