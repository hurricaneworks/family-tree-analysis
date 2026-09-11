import { redirect } from "next/navigation";
import { DATABASE } from "@/lib/features";
import { signIn } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (!DATABASE) redirect("/");
  const { error, next } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <h1>Sign in</h1>
      <p className="mt-3 text-ink-soft">The family tree is private. Use the email address and password you were given.</p>
      {error && <p className="mt-4 border-l-4 border-kelp pl-4">{error}</p>}
      <form action={signIn} className="mt-8 flex flex-col gap-5">
        <input type="hidden" name="next" value={next ?? "/"} />
        <label className="flex flex-col gap-1 text-lg">
          Email
          <input name="email" type="email" autoComplete="email" required className="border border-ink bg-white px-3 py-2 text-lg" />
        </label>
        <label className="flex flex-col gap-1 text-lg">
          Password
          <input name="password" type="password" autoComplete="current-password" required className="border border-ink bg-white px-3 py-2 text-lg" />
        </label>
        <SubmitButton className="mt-2 border border-ink bg-ink px-5 py-2 text-lg text-paper disabled:opacity-60" pendingText="Signing in…">Sign in</SubmitButton>
      </form>
      <p className="mt-5"><a href="/forgot">Forgotten your password?</a></p>
    </div>
  );
}
