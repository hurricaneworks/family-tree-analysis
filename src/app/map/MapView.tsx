"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { MapPayload } from "../api/map/route";
import type * as Leaflet from "leaflet";

const WINDOW = 25; // years shown at once

export function MapView() {
  const [data, setData] = useState<MapPayload | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);

  useEffect(() => {
    fetch("/api/map").then((r) => r.json()).then((d: MapPayload) => {
      setData(d);
      setYear(1850);
    });
  }, []);

  // create the map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapEl.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapEl.current, { worldCopyJump: true }).setView([56.5, -4.5], 5);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        className: "basemap",
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    });
    return () => { cancelled = true; };
  }, []);

  // events in the current window, grouped by place
  const visible = useMemo(() => {
    if (!data || year === null) return new Map<number, MapPayload["events"]>();
    const groups = new Map<number, MapPayload["events"]>();
    for (const ev of data.events) {
      if (!all && (ev[1] > year || ev[1] < year - WINDOW)) continue;
      if (!groups.has(ev[0])) groups.set(ev[0], []);
      groups.get(ev[0])!.push(ev);
    }
    return groups;
  }, [data, year, all]);

  // redraw pins
  useEffect(() => {
    const L = leafletRef.current, layer = layerRef.current;
    if (!L || !layer || !data) return;
    layer.clearLayers();
    for (const [idx, evs] of visible) {
      const p = data.places[idx];
      const people = new Set(evs.map((e) => e[2])).size;
      const r = 4 + Math.min(18, Math.sqrt(people) * 3);
      L.circleMarker([p.lat, p.lon], {
        radius: r,
        color: "#2f6a86",
        weight: p.dropped ? 2 : 1,
        fillColor: "#2f6a86",
        fillOpacity: p.dropped ? 0 : 0.55,
        opacity: 0.9,
      })
        .on("click", () => setSelected(idx))
        .bindTooltip(`${p.name}: ${people} ${people === 1 ? "person" : "people"}`)
        .addTo(layer);
    }
  }, [visible, data]);

  // the map container is always rendered so the init effect above finds it on first mount
  const ready = data !== null && year !== null;
  const [minY, maxY] = data?.yearRange ?? [1500, 2020];
  const sel = ready && selected !== null ? data.places[selected] : null;
  const selEvents = ready && selected !== null ? visible.get(selected) ?? [] : [];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-3 text-lg">
          <span className="data w-32">{!ready ? "Loading…" : all ? "All years" : `${year - WINDOW} to ${year}`}</span>
          <input
            type="range"
            min={minY}
            max={maxY}
            value={year ?? 1850}
            disabled={all || !ready}
            onChange={(e) => { setYear(Number(e.target.value)); setSelected(null); }}
            className="w-72 max-w-full accent-sea"
            aria-label="Year"
          />
        </label>
        <label className="data flex items-center gap-2">
          <input type="checkbox" checked={all} onChange={(e) => { setAll(e.target.checked); setSelected(null); }} />
          Show every year
        </label>
        <span className="data text-ink-soft">
          {[...visible.values()].reduce((a, v) => a + v.length, 0).toLocaleString("en-GB")} events in {visible.size} places
        </span>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_20rem]">
        <div ref={mapEl} className="h-[70vh] min-h-[420px] border border-ink" />
        <aside className="max-h-[70vh] overflow-y-auto">
          {sel ? (
            <>
              <h3>{sel.name}</h3>
              {sel.dropped > 0 && <p className="data text-ink-soft">Located only to the wider area.</p>}
              <ul className="mt-2 divide-y divide-rule">
                {selEvents.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 py-1.5">
                    {data?.faces[e[2]] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/photo/${data.faces[e[2]]}`} alt="" className="border border-rule object-cover" style={{ width: 32, height: 32, flex: "none" }} />
                    ) : (
                      <span className="inline-block bg-paper-deep" style={{ width: 32, height: 32, flex: "none" }} />
                    )}
                    <span>
                      <a href={`/person/${e[2]}`}>{data?.people[e[2]]}</a>
                      <span className="data text-ink-soft"> {e[3].toLowerCase()} {e[1]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="data text-ink-soft">Click a place to see who was there.{data?.unlocated ? ` ${data.unlocated.toLocaleString("en-GB")} events have no map position yet.` : ""}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
