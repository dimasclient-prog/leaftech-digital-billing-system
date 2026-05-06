export const formatIDR = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);
};

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-accent text-accent-foreground",
  partially_paid: "bg-warning/15 text-warning",
  paid: "bg-success/15 text-success",
  overdue: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export const statusLabel: Record<string, string> = {
  draft: "Draft",
  sent: "Terkirim",
  partially_paid: "Dibayar Sebagian",
  paid: "Lunas",
  overdue: "Jatuh Tempo",
  cancelled: "Dibatalkan",
};

export const methodLabel: Record<string, string> = {
  bank_transfer: "Transfer Bank",
  cash: "Tunai",
  credit_card: "Kartu Kredit",
  e_wallet: "E-Wallet",
  other: "Lainnya",
};