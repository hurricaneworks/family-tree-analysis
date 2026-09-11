import { redirect } from "next/navigation";
import { DATABASE } from "@/lib/features";
import { setNewPassword } from "./actions";
import { Reset } from "./Reset";

export const dynamic = "force-dynamic";

/** Lands here from the email. The code is only spent when the reader presses Open the link. */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!DATABASE) redirect("/");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <h1>Choose a new password</h1>
      <p className="mt-3 text-ink-soft">Pick something you will remember, at least eight characters. Type it twice.</p>
      {error && <p className="mt-4 border-l-4 border-kelp pl-4">{error}</p>}
      <Reset action={setNewPassword} />
    </div>
  );
}
