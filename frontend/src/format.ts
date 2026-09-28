export function rupiah(n: number | undefined | null): string {
  const v = Math.round(Number(n || 0));
  return "Rp" + v.toLocaleString("id-ID");
}

export function shortDate(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

export const TIER_LABELS: Record<string, string> = {
  eceran: "Eceran",
  warung: "Warung/Toko",
  pangkalan: "Agen/Pangkalan",
  korporat: "Korporat/Resto",
};

export const CATEGORY_LABELS: Record<string, string> = {
  lpg: "Gas LPG",
  galon_brand: "Air Galon Brand",
  refill: "Depot Isi Ulang",
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
  tempo: "Tempo/Hutang",
  deposit: "Deposit",
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Pemilik Usaha",
  cashier: "Kasir",
  warehouse_admin: "Admin Gudang",
  driver: "Driver/Kurir",
};
