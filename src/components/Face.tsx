import { portraitFor } from "@/lib/media";

/** A small square portrait for a person, or a quiet blank square so rows stay aligned. */
export function Face({ personId, size = 44, alt = "", placeholder = true }: { personId: string; size?: number; alt?: string; placeholder?: boolean }) {
  const m = portraitFor(personId);
  const style = { width: size, height: size, flex: "none" as const };
  if (!m) return placeholder ? <span aria-hidden className="inline-block bg-paper-deep" style={style} /> : null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/photo/${m.id}`} alt={alt} loading="lazy" className="inline-block border border-rule bg-white object-cover" style={style} />
  );
}
