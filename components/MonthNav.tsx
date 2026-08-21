"use client";

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function labelForMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function MonthNav({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const isCurrent = month === currentMonth();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Mês anterior"
        className="rounded-lg border border-neutral-300 px-2.5 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
      >
        ‹
      </button>
      <span className="min-w-[9rem] text-center text-sm font-medium text-neutral-800">
        {labelForMonth(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Próximo mês"
        className="rounded-lg border border-neutral-300 px-2.5 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
      >
        ›
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(currentMonth())}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          Hoje
        </button>
      )}
    </div>
  );
}
