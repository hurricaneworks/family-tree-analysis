"use client";

import { useState } from "react";
import { ResetSession } from "./ResetSession";
import { SubmitButton } from "@/components/SubmitButton";

/** The form only appears once the link has been opened, so nothing is consumed on arrival. */
export function Reset({ action }: { action: (formData: FormData) => void }) {
  const [ready, setReady] = useState(false);
  return (
    <>
      <ResetSession onReady={() => setReady(true)} />
      {ready && (
        <form action={action} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-lg">
            New password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus className="border border-ink bg-white px-3 py-2 text-lg" />
          </label>
          <label className="flex flex-col gap-1 text-lg">
            The same again
            <input name="password2" type="password" autoComplete="new-password" minLength={8} required className="border border-ink bg-white px-3 py-2 text-lg" />
          </label>
          <SubmitButton pendingText="Saving…">Save the new password</SubmitButton>
        </form>
      )}
    </>
  );
}
