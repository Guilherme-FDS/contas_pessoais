export type DueStatus = "pago" | "verde" | "laranja" | "vermelho" | "neutro";

export const DUE_STATUS_STYLES: Record<DueStatus, string> = {
  pago: "bg-neutral-100 text-neutral-500",
  verde: "bg-emerald-100 text-emerald-700",
  laranja: "bg-amber-100 text-amber-700",
  vermelho: "bg-red-100 text-red-700",
  neutro: "bg-neutral-100 text-neutral-500",
};

export const DUE_STATUS_LABELS: Record<DueStatus, string> = {
  pago: "Pago",
  verde: "Em dia",
  laranja: "Vence hoje",
  vermelho: "Atrasado",
  neutro: "",
};

export function dueStatusByDayOfMonth(diaVencimento: number | null, paid: boolean): DueStatus {
  if (paid) return "pago";
  if (!diaVencimento) return "neutro";
  const today = new Date().getDate();
  const daysUntil = diaVencimento - today;
  if (daysUntil < 0) return "vermelho";
  if (daysUntil === 0) return "laranja";
  return "verde";
}

export function dueStatusByDate(dateStr: string | null, paid: boolean): DueStatus {
  if (paid) return "pago";
  if (!dateStr) return "neutro";
  const todayStr = new Date().toISOString().slice(0, 10);
  const due = dateStr.slice(0, 10);
  if (due < todayStr) return "vermelho";
  if (due === todayStr) return "laranja";
  return "verde";
}
