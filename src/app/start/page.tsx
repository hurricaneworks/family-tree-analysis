import Link from "next/link";
import { Comments } from "@/components/Comments";

export const dynamic = "force-dynamic";

/** The whole site in one page, for the first visit and for coming back after a while. */
export default function StartPage() {
  return (
    <>
      <h1>Start here</h1>
      <p className="mt-3 max-w-2xl">
        This site is your Ancestry tree, read out and laid open. It cannot change Ancestry; it shows you what to change there, and remembers what you have done. Here is the whole of it in four habits.
      </p>
      <ol className="mt-8 max-w-2xl list-decimal space-y-6 pl-7 text-lg">
        <li>
          <strong>Look at <Link href="/list">My list</Link>.</strong> It is the things to do on Ancestry, most important first. Each one has a link that opens the right person on Ancestry in a new window. Do it there, come back, press <em>Done on Ancestry</em>.
        </li>
        <li>
          <strong>When the list runs low, go to <Link href="/gaps">Gaps</Link> or <Link href="/papers">Papers</Link>.</strong> Gaps is everything the tree is missing; Papers is what your certificates say that the tree does not. Press <em>Add to my list</em> on anything you want to chase.
        </li>
        <li>
          <strong>When you want to know something, <Link href="/ask">Ask</Link>.</strong> Type the question as you would say it. It answers from the records and names its sources.
        </li>
        <li>
          <strong>When something is wrong or puzzling, write at the foot of the page.</strong> Every page has a comment box. You get an answer within a minute, and whoever runs the site sees it too.
        </li>
      </ol>
      <h2 className="mt-12">The rest</h2>
      <p className="mt-2 max-w-2xl">
        Under <em>Ways to look</em> in the menu are pictures of the tree that Ancestry cannot draw: the <Link href="/fan">fan</Link> of your ancestors, the <Link href="/sixteen">sixteen</Link> great-great-grandparents, <Link href="/lives">lives</Link> on a timeline, the <Link href="/map">map</Link>, the <Link href="/album">album</Link>, and the <Link href="/journey">long walk back</Link>. They are for looking, not for doing.
      </p>
      <p className="mt-3 max-w-2xl">
        <em>Help</em>, top right, explains whichever page you are on. Every Monday you get an email of what happened in the family that week.
      </p>
      <Comments page="/start" />
    </>
  );
}
