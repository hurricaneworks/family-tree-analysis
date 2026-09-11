"use client";

import { useState } from "react";
import { ROOT_SHORT_NAME } from "@/lib/config";

export type Life = { id: string; n: number; gen: number; paternal: boolean; name: string; start: number; end: number; estimatedStart: boolean; estimatedEnd: boolean; face: string | null; place: string | null };

const MARKERS: { year: number; label: string; to?: number }[] = [
  { year: 1841, label: "1841 census" }, { year: 1851, label: "1851" }, { year: 1861, label: "1861" }, { year: 1871, label: "1871" }, { year: 1881, label: "1881" }, { year: 1891, label: "1891" }, { year: 1901, label: "1901" }, { year: 1911, label: "1911" }, { year: 1921, label: "1921 census" },
  { year: 1845, to: 1852, label: "Irish famine" }, { year: 1914, to: 1918, label: "Great War" }, { year: 1939, to: 1945, label: "Second World War" },
];

export function Lives({ lives }: { lives: Life[] }) {
  const [hover, setHover] = useState<Life | null>(null);
  const min = Math.floor(Math.min(...lives.map((l) => l.start)) / 10) * 10;
  const max = new Date().getFullYear();
  const W = 1000, LEFT = 8, ROW = 22, TOP = 40;
  const H = TOP + lives.length * ROW + 30;
  const x = (y: number) => LEFT + ((y - min) / (max - min)) * (W - LEFT * 2);
  const decades = [];
  for (let y = min; y <= max; y += 10) decades.push(y);
  const genLabel = [ROOT_SHORT_NAME, "parents", "grandparents", "great-grandparents", "2× great", "3× great", "4× great", "5× great"];

  return (
    <div className="mt-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Lifespans of ${ROOT_SHORT_NAME}'s ancestors`}>
        {decades.map((y) => (
          <g key={y}>
            <line x1={x(y)} x2={x(y)} y1={TOP - 6} y2={H - 24} stroke={y % 50 === 0 ? "#c9cfc9" : "#e6e9e4"} strokeWidth={1} />
            {y % 20 === 0 && <text x={x(y)} y={H - 8} fontSize={11} fill="#55636d" textAnchor="middle" style={{ fontFamily: "var(--font-sans)" }}>{y}</text>}
          </g>
        ))}
        {MARKERS.map((m) => m.to ? (
          <g key={m.label}>
            <rect x={x(m.year)} y={TOP - 6} width={x(m.to) - x(m.year)} height={H - TOP - 18} fill="#7a5a1e" fillOpacity={0.08} />
            <text x={x(m.year) + 2} y={TOP - 12} fontSize={10} fill="#7a5a1e" style={{ fontFamily: "var(--font-sans)" }}>{m.label}</text>
          </g>
        ) : (
          <g key={m.label}>
            <line x1={x(m.year)} x2={x(m.year)} y1={TOP - 6} y2={H - 24} stroke="#7a5a1e" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />
            {m.label.includes("census") && <text x={x(m.year)} y={TOP - 24} fontSize={10} fill="#7a5a1e" textAnchor="middle" style={{ fontFamily: "var(--font-sans)" }}>{m.label}</text>}
          </g>
        ))}
        {lives.map((l, i) => {
          const y = TOP + i * ROW;
          const prevGen = i > 0 ? lives[i - 1].gen : -1;
          const color = l.gen === 0 ? "#22303a" : l.paternal ? "#2f6a86" : "#6b5a86";
          const active = hover?.id === l.id;
          return (
            <g key={l.id} onMouseEnter={() => setHover(l)} onMouseLeave={() => setHover(null)}>
              {l.gen !== prevGen && (
                <text x={LEFT} y={y - 2} fontSize={10} fill="#55636d" style={{ fontFamily: "var(--font-sans)" }}>{genLabel[l.gen]}</text>
              )}
              <a href={`/person/${l.id}`}>
                <rect x={x(l.start)} y={y + 4} width={Math.max(2, x(l.end) - x(l.start))} height={ROW - 9} fill={color} fillOpacity={active ? 1 : l.estimatedStart || l.estimatedEnd ? 0.35 : 0.8} rx={2} />
                <text x={x(l.start) + 4} y={y + ROW / 2 + 3} fontSize={10.5} fill={active ? "#fff" : l.estimatedStart || l.estimatedEnd ? "#22303a" : "#fff"} style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}>
                  {x(l.end) - x(l.start) > 90 ? `${l.name} ${l.start}–${l.end}` : x(l.end) - x(l.start) > 40 ? l.name.split(" ").slice(-1)[0] : ""}
                </text>
              </a>
            </g>
          );
        })}
      </svg>
      <div className="data mt-2 min-h-[3rem] border-t border-rule pt-2" aria-live="polite">
        {hover ? (
          <span className="inline-flex items-center gap-3">
            {hover.face && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/photo/${hover.face}`} alt="" className="border border-rule object-cover" style={{ width: 44, height: 44 }} />
            )}
            <span>
              <strong>{hover.name}</strong>, {hover.estimatedStart ? "about " : ""}{hover.start} to {hover.estimatedEnd ? "about " : ""}{hover.end}{hover.place ? `, born ${hover.place}` : ""}
              <span className="block text-ink-soft">{hover.paternal ? "father's" : "mother's"} side, {hover.end - hover.start} years</span>
            </span>
          </span>
        ) : (
          <span className="text-ink-soft">Move over a bar to see who it is.</span>
        )}
      </div>
    </div>
  );
}
