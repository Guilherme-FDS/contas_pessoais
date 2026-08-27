import { DUE_STATUS_LABELS, DUE_STATUS_STYLES, type DueStatus } from "@/lib/dueStatus";

export default function DueStatusBadge({
  status,
  prefix,
}: {
  status: DueStatus;
  prefix?: string;
}) {
  const label = DUE_STATUS_LABELS[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${DUE_STATUS_STYLES[status]}`}
    >
      {prefix}
      {prefix && label ? " · " : ""}
      {label}
    </span>
  );
}

export function DueStatusLegend() {
  return (
    <span className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Em dia
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-amber-500" /> Vence hoje
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-red-500" /> Atrasado (não marcado como pago)
      </span>
    </span>
  );
}
