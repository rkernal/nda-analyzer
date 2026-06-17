import { CLAUSE_TYPES } from "@/lib/constants";

export function ClauseTag({ type }: { type: string }) {
  const t = CLAUSE_TYPES[type] || CLAUSE_TYPES["other"];
  return <span className={"text-xs px-1.5 py-0.5 rounded font-medium " + t.color}>{t.label}</span>;
}
