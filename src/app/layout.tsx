import type { Metadata } from "next";
import { Newsreader, Atkinson_Hyperlegible } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getTree, syncEdits } from "@/lib/data";
import { currentUser } from "@/lib/supabase";
import { signOut } from "./login/actions";
import { HelpDrawer } from "@/components/HelpDrawer";
import { SideNav } from "@/components/SideNav";
import { Crumbs } from "@/components/Crumbs";
import { DATABASE, hiddenPages } from "@/lib/features";
import { getReadings } from "@/lib/readings";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"], weight: ["400", "500", "600"] });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], variable: "--font-atkinson", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: { default: "The family tree", template: "%s" },
  robots: { index: false, follow: false },
};



export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await syncEdits();
  const { meta } = getTree();
  const user = await currentUser();
  const hidden = hiddenPages(Object.keys(getReadings()).length > 0);
  return (
    <html lang="en-GB" className={`${newsreader.variable} ${atkinson.variable}`}>
      <body className="min-h-screen">
        {user ? (
          <SideNav
            treeName={meta.treeName ?? "The family tree"}
            hidden={hidden}
            signOut={DATABASE ? <form action={signOut}><button type="submit">Sign out</button></form> : null}
          />
        ) : (
          <header className="border-b border-ink px-6 py-4 md:px-10">
            <Link href="/" className="text-ink no-underline text-xl">{meta.treeName ?? "The family tree"}</Link>
          </header>
        )}
        {user && <div className="help-corner"><HelpDrawer /></div>}
        <main className={`${user ? "with-sidenav" : ""} mx-auto max-w-6xl px-6 py-10 md:px-10`}>
          {user && <Crumbs />}
          {children}
        </main>
        <footer className={`${user ? "with-sidenav" : ""} mx-auto max-w-6xl px-6 pb-10 pt-6 md:px-10 data text-ink-soft`}>
          Imported from Ancestry export of {meta.gedcomExportDate}. {meta.counts.people.toLocaleString("en-GB")} people, {meta.counts.citations.toLocaleString("en-GB")} citations.
          {!DATABASE && <span className="block">No sign-in is set up, so anyone who can reach this site can read it. Fine on your own computer; not for the open internet.</span>}
        </footer>
      </body>
    </html>
  );
}
