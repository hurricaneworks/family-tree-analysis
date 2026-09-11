"use client";

import { useState } from "react";

export type Wedge = {
  n: number;
  gen: number;
  paternal: boolean;
  id: string | null;
  name: string | null;
  surname: string | null;
  years: string | null;
  place: string | null;
  face: string | null;
};

const SIZE = 1000;
const CX = SIZE / 2, CY = SIZE / 2 + 20;
const R0 = 70; // centre circle
const RING = 58; // ring thickness

// rounded, because Node and the browser differ in the last bits of cos and sin, which React reports as a hydration mismatch
const polar = (r: number, a: number) => [Math.round((CX + r * Math.cos(a)) * 1000) / 1000, Math.round((CY + r * Math.sin(a)) * 1000) / 1000] as const;

function arcPath(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = polar(r2, a1), [x2, y2] = polar(r2, a2), [x3, y3] = polar(r1, a2), [x4, y4] = polar(r1, a1);
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M${x1},${y1} A${r2},${r2} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 ${large} 0 ${x4},${y4} Z`;
}

/** Semicircular fan: the root sits at the bottom centre, generations stack upwards in half-rings. */
export function FanChart({ wedges, rootName, rootFace, rootId }: { wedges: Wedge[]; rootName: string; rootFace: string | null; rootId: string }) {
  const [hover, setHover] = useState<Wedge | null>(null);
  const maxGen = Math.max(...wedges.map((w) => w.gen));
  const H = CY - (R0 + RING * maxGen) < 0 ? R0 + RING * maxGen + 40 : SIZE;

  return (
    <div className="relative">
      <svg viewBox={`0 ${CY - (R0 + RING * maxGen) - 10} ${SIZE} ${R0 + RING * maxGen + 60}`} className="w-full" style={{ maxHeight: "80vh" }} role="img" aria-label={`Ancestors of ${rootName}`}>
        <defs>
          <clipPath id="rootclip"><circle cx={CX} cy={CY} r={R0 - 4} /></clipPath>
        </defs>
        {wedges.map((w) => {
          const perGen = 2 ** w.gen;
          const idx = w.n - perGen; // 0 .. perGen-1, paternal half first
          const span = Math.PI / perGen;
          const a1 = Math.PI + idx * span, a2 = a1 + span; // sweep the upper half from left to right
          const r1 = R0 + RING * (w.gen - 1) + 3, r2 = R0 + RING * w.gen - 1;
          const fill = w.id ? (w.paternal ? "#2f6a86" : "#6b5a86") : "none";
          const light = 0.85 - (w.gen - 1) * 0.11; // fade outwards
          const mid = (a1 + a2) / 2;
          const [tx, ty] = polar((r1 + r2) / 2, mid);
          const rotate = (mid * 180) / Math.PI + 90;
          const label = w.gen <= 4 ? (w.surname ?? w.name ?? "") : w.gen === 5 ? (w.surname ?? "").slice(0, 8) : "";
          return (
            <g key={w.n} onMouseEnter={() => setHover(w)} onMouseLeave={() => setHover(null)}>
              {w.id ? (
                <a href={`/person/${w.id}`}>
                  <path d={arcPath(r1, r2, a1, a2)} fill={fill} fillOpacity={light} stroke="#f3f4f1" strokeWidth={1.5} />
                  {label && (
                    <text x={tx} y={ty} fontSize={w.gen <= 2 ? 15 : w.gen <= 4 ? 12 : 9} fill="#fff" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${rotate > 90 && rotate < 270 ? rotate + 180 : rotate} ${tx} ${ty})`} style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}>
                      {label}
                    </text>
                  )}
                </a>
              ) : (
                <path d={arcPath(r1, r2, a1, a2)} fill="#e6e9e4" stroke="#c9cfc9" strokeWidth={1} strokeDasharray="3 3" />
              )}
            </g>
          );
        })}
        <a href={`/person/${rootId}`}>
          <circle cx={CX} cy={CY} r={R0 - 2} fill="#22303a" />
          {rootFace ? (
            <image href={`/api/photo/${rootFace}`} x={CX - R0} y={CY - R0} width={R0 * 2} height={R0 * 2} clipPath="url(#rootclip)" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <text x={CX} y={CY} fontSize={14} fill="#f3f4f1" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-sans)" }}>{rootName.split(" ")[0]}</text>
          )}
        </a>
        <text x={CX - R0 - 8} y={CY + 24} fontSize={12} fill="#55636d" textAnchor="end" style={{ fontFamily: "var(--font-sans)" }}>father&apos;s side</text>
        <text x={CX + R0 + 8} y={CY + 24} fontSize={12} fill="#55636d" style={{ fontFamily: "var(--font-sans)" }}>mother&apos;s side</text>
      </svg>
      <div className="data mt-2 min-h-[3.5rem] border-t border-rule pt-2" aria-live="polite">
        {hover ? (
          hover.id ? (
            <span className="inline-flex items-center gap-3">
              {hover.face && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/photo/${hover.face}`} alt="" className="border border-rule object-cover" style={{ width: 44, height: 44 }} />
              )}
              <span>
                <strong>{hover.name}</strong>, {hover.years}{hover.place ? `, ${hover.place}` : ""}
                <span className="block text-ink-soft">generation {hover.gen}, {hover.paternal ? "father's" : "mother's"} side</span>
              </span>
            </span>
          ) : (
            <span className="text-ink-soft">Line stops here: no {hover.n % 2 === 0 ? "father" : "mother"} recorded for the wedge inside it.</span>
          )
        ) : (
          <span className="text-ink-soft">Move over a wedge to see who it is.</span>
        )}
      </div>
    </div>
  );
}
