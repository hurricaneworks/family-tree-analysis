"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Turn = { role: "user" | "assistant"; content: string; tools?: string[]; error?: string; faces?: { id: string; name: string; media: string }[] };

const STARTERS = [
  "Who was the first of the family to emigrate, and where did they go?",
  "Which great-grandparents do we know least about?",
  "Who in the family served in the military, and where?",
  "Who lived the longest, and who died youngest?",
];

const TOOL_LABELS: Record<string, string> = {
  search_people: "searching for people",
  get_person: "reading a record",
  get_ancestors: "tracing ancestors",
  get_descendants: "tracing descendants",
  find_events: "searching events",
  list_gaps: "checking the gaps list",
};

/** Minimal markdown: paragraphs, bullet lists, bold, links. Enough for the assistant's answers. */
function render(md: string) {
  const inline = (s: string) => {
    const parts: (string | React.ReactElement)[] = [];
    const re = /\[([^\]]+)\]\((\/person\/[A-Za-z0-9]+)\)|\*\*([^*]+)\*\*/g;
    let last = 0, m: RegExpExecArray | null, k = 0;
    while ((m = re.exec(s))) {
      parts.push(s.slice(last, m.index));
      parts.push(m[1] ? <a key={k++} href={m[2]}>{m[1]}</a> : <strong key={k++}>{m[3]}</strong>);
      last = m.index + m[0].length;
    }
    parts.push(s.slice(last));
    return parts;
  };
  const blocks = md.trim().split(/\n{2,}/);
  return blocks.map((b, i) => {
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*[-*] /.test(l))) {
      return <ul key={i} className="mt-3 list-disc pl-6">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*] /, ""))}</li>)}</ul>;
    }
    if (/^#{1,3} /.test(lines[0])) return <h3 key={i} className="mt-5">{inline(lines[0].replace(/^#+ /, ""))}</h3>;
    return <p key={i} className="mt-3">{inline(lines.join(" "))}</p>;
  });
}

export function Ask({ initialQuestion }: { initialQuestion?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewingSaved, setViewingSaved] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // a question typed on the home page arrives here in the address and is asked at once
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !initialQuestion?.trim()) return;
    asked.current = true;
    ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  // a saved question picked from the history column replaces the current conversation
  useEffect(() => {
    const onOpen = (e: Event) => {
      const h = (e as CustomEvent<{ question: string; answer: string }>).detail;
      setTurns([{ role: "user", content: h.question }, { role: "assistant", content: h.answer }]);
      setViewingSaved(true);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("ask:open", onOpen);
    return () => window.removeEventListener("ask:open", onOpen);
  }, []);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setDraft("");
    setBusy(true);
    setViewingSaved(false);
    window.dispatchEvent(new Event("ask:new"));
    const history = [...turns, { role: "user" as const, content: q }];
    setTurns([...history, { role: "assistant", content: "", tools: [] }]);
    const update = (fn: (t: Turn) => Turn) =>
      setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? fn(t) : t)));
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 503 || res.status === 429 ? await res.text() : `HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const ev = JSON.parse(line) as { t: string; d?: string; name?: string };
          if (ev.t === "text") update((t) => ({ ...t, content: t.content + ev.d }));
          else if (ev.t === "tool") update((t) => ({ ...t, tools: [...(t.tools ?? []), ev.name ?? ""] }));
          else if (ev.t === "error") update((t) => ({ ...t, error: ev.d }));
        }
        bottom.current?.scrollIntoView({ block: "end" });
      }
      // faces for the people the answer linked
      const ids = [...new Set([...(buf + "").matchAll(/\/person\/(I\d+)/g)].map((m) => m[1]))];
      const linked = new Set<string>();
      setTurns((prev) => { for (const m of prev[prev.length - 1].content.matchAll(/\/person\/(I\d+)/g)) linked.add(m[1]); return prev; });
      const want = [...linked, ...ids].slice(0, 24);
      if (want.length) {
        const faces = (await fetch(`/api/faces?ids=${want.join(",")}`).then((r) => (r.ok ? r.json() : {}))) as Record<string, { name: string; media: string }>;
        const list = want.filter((id) => faces[id]).map((id) => ({ id, ...faces[id] }));
        if (list.length) update((t) => ({ ...t, faces: list }));
      }
    } catch (err) {
      update((t) => ({ ...t, error: err instanceof Error ? err.message : "Something went wrong." }));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(draft);
  }

  const startAgain = () => { setTurns([]); setViewingSaved(false); window.dispatchEvent(new Event("ask:new")); };

  return (
    <div className="mt-8 max-w-3xl">
      <form onSubmit={submit} className="flex gap-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={turns.length && !viewingSaved ? "Ask a follow-up, or start again below" : "Ask a question about the family"}
          disabled={busy}
          className="w-full border border-ink bg-white px-3 py-2 text-lg disabled:opacity-60"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="border border-ink bg-ink px-5 py-2 text-lg text-paper disabled:opacity-60">
          Ask
        </button>
      </form>
      {turns.length > 0 && (
        <p className="mt-3 data">
          {viewingSaved ? "You are reading an earlier question. " : ""}
          <button type="button" onClick={startAgain} className="text-sea underline">{viewingSaved ? "Ask something new" : "Start again"}</button>
        </p>
      )}

      {turns.length === 0 && (
        <ul className="mt-8 divide-y divide-rule">
          {STARTERS.map((s) => (
            <li key={s} className="py-2">
              <button type="button" onClick={() => ask(s)} className="text-left text-sea underline decoration-1 underline-offset-2 hover:decoration-2">
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      {turns.map((t, i) =>
        t.role === "user" ? (
          <p key={i} className="mt-8 border-l-4 border-ink pl-4 text-xl">{t.content}</p>
        ) : (
          <div key={i} className="mt-4">
            {t.tools && t.tools.length > 0 && (
              <p className="data text-ink-soft">
                {busy && i === turns.length - 1 && !t.content ? "Looking: " : "Looked at: "}
                {[...new Set(t.tools)].map((n) => TOOL_LABELS[n] ?? n).join(", ")}
                {busy && i === turns.length - 1 && !t.content ? "…" : ""}
              </p>
            )}
            {t.faces && t.faces.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {t.faces.map((f) => (
                  <a key={f.id} href={`/person/${f.id}`} title={f.name} className="block no-underline">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photo/${f.media}`} alt={f.name} className="border border-rule bg-white object-cover" style={{ width: 64, height: 64 }} />
                  </a>
                ))}
              </div>
            )}
            {t.content ? render(t.content) : busy && i === turns.length - 1 && !t.tools?.length ? <p className="data text-ink-soft">Thinking…</p> : null}
            {t.error && <p className="mt-3 data text-kelp">{t.error}</p>}
          </div>
        ),
      )}
      <div ref={bottom} />
    </div>
  );
}
