"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase puts the recovery code in the address. Exchanging it consumes it, so that must wait for a
 * real click: mail gateways open every link, and some run the page's JavaScript. Until the button is
 * pressed nothing is spent, so a scanner cannot burn the link before the reader gets to it.
 */
export function ResetSession({ onReady }: { onReady?: () => void }) {
  const [state, setState] = useState<"idle" | "working" | "ready" | "bad">("idle");
  const [hasCode, setHasCode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setHasCode(Boolean(params.get("code") || hash.get("access_token")));
    // an existing recovery session (the link put one there without a code) is already usable
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    supabase.auth.getSession().then(({ data }) => { if (data.session) { setState("ready"); onReady?.(); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async () => {
    setState("working");
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      setState(error ? "bad" : "ready");
      if (!error) onReady?.();
      return;
    }
    const { data } = await supabase.auth.getSession();
    setState(data.session ? "ready" : "bad");
    if (data.session) onReady?.();
  };

  if (state === "ready") return <p className="mt-4 data text-ink-soft">Link opened. Choose your new password below.</p>;
  if (state === "bad") return <p className="mt-4 border-l-4 border-kelp pl-4">This link has expired or has already been used. <a href="/forgot">Ask for a new one</a>.</p>;
  return (
    <div className="mt-5">
      <button type="button" onClick={open} disabled={state === "working" || !hasCode} className="border border-ink bg-ink px-5 py-2 text-lg text-paper disabled:opacity-60">
        {state === "working" ? "Opening…" : "Open the link"}
      </button>
      <p className="mt-2 data text-ink-soft">
        {hasCode ? "Press this first. Nothing happens until you do, so the link cannot be used up by anything that opened this email before you." : "This page needs the link from the email. Open the email and press the button in it."}
      </p>
    </div>
  );
}
