/**
 * Who the tree is centred on, and how this site describes itself.
 *
 * Everything here is optional. Set what you want in `.env.local`; a fresh clone
 * runs with none of it, falling back to the first person in the imported file
 * and to neutral wording.
 */

/**
 * The home person that generations are counted from.
 * Leave unset to use the first individual in the file, which is what most
 * exports put first anyway.
 */
export const ROOT_ID = process.env.NEXT_PUBLIC_ROOT_ID ?? "";

/** What to call the home person in copy: a first name, or "Gran", or similar. */
export const ROOT_SHORT_NAME = process.env.NEXT_PUBLIC_ROOT_SHORT_NAME ?? "the home person";

/** What to call the person who runs the site, in copy: a first name, or "the keeper". */
export const OWNER_NAME = process.env.NEXT_PUBLIC_OWNER_NAME ?? "the keeper";

/** The tree's name, used on printed pages and shared links. */
export const TREE_NAME = process.env.NEXT_PUBLIC_TREE_NAME ?? "the family tree";

/**
 * Show dates, places, pictures and notes for people who may be living. Off by default: a public
 * tool must not publish a living person's details without their say. See src/lib/privacy.ts.
 */
export const SHOW_LIVING = process.env.SHOW_LIVING_PEOPLE === "true";

/** Where this site is served from. Emails need absolute links, so they use this. */
export const SITE_URL = process.env.SITE_URL ?? "http://localhost:4130";

/** Who is notified of comments. Unset means no notification is sent. */
export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "";

/** The From line on outgoing email. Must be a sender your mail provider has verified. */
export const MAIL_FROM = process.env.MAIL_FROM ?? "The family tree <no-reply@example.invalid>";

/**
 * A contact address sent in the User-Agent of requests to Nominatim and Wikipedia.
 * Both ask that automated callers identify themselves, so set this before any
 * bulk geocoding run.
 */
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? OWNER_EMAIL;

/** User-Agent for third-party lookups, naming the project and a contact if there is one. */
export const USER_AGENT = `family-tree-analysis/1.0 (+${SITE_URL}${CONTACT_EMAIL ? `; contact ${CONTACT_EMAIL}` : ""})`;
