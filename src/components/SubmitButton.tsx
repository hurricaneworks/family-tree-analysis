"use client";

import { useFormStatus } from "react-dom";

/** A submit button that shows it is working and cannot be clicked twice. */
export function SubmitButton({ children, pendingText = "Sending…", className = "border border-ink bg-ink px-5 py-2 text-lg text-paper disabled:opacity-60", name, value }: { children: React.ReactNode; pendingText?: string; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
