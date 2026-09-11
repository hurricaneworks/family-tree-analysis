import { redirect } from "next/navigation";
import { DATABASE } from "@/lib/features";
import Link from "next/link";
import { sendReset } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  if (!DATABASE) redirect("/");
  const { sent, error } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <h1>Forgotten your password?</h1>
      {sent ? (
        <p className="mt-4">An email is on its way. Open it and press the button inside to choose a new password. If it does not arrive in a few minutes, check the junk folder.</p>
      ) : (
        <>
          <p className="mt-3 text-ink-soft">Type the email address you sign in with and we will send you a link to choose a new one.</p>
          {error && <p className="mt-4 border-l-4 border-kelp pl-4">{error}</p>}
          <form action={sendReset} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-lg">
              Email
              <input name="email" type="email" autoComplete="email" required className="border border-ink bg-white px-3 py-2 text-lg" />
            </label>
            <SubmitButton pendingText="Sending…">Send me the link</SubmitButton>
          </form>
        </>
      )}
      <p className="mt-6 data"><Link href="/login">Back to sign in</Link></p>
    </div>
  );
}
