import Link from "next/link";
import type { Person } from "@/lib/types";
import { lifespan } from "@/lib/format";
import { Face } from "./Face";

export function PersonLink({ person, dates = true, face = true }: { person: Person; dates?: boolean; face?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      {face && <Face personId={person.id} size={32} placeholder={false} />}
      <span>
        <Link href={`/person/${person.id}`}>{person.name}</Link>
        {dates && <span className="data text-ink-soft"> {lifespan(person)}</span>}
      </span>
    </span>
  );
}
