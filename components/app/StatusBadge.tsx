import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={"text-xs px-2 py-0.5 rounded-full " + (STATUS_COLORS[status] || "bg-gray-100 text-gray-800")}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
