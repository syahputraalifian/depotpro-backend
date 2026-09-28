import { Linking, Platform } from "react-native";
import * as Print from "expo-print";
import { rupiah, PAYMENT_LABELS } from "@/src/format";

const STORE_NAME = "GasGalon ERP";

export function receiptText(inv: any): string {
  const lines = [
    `*STRUK ${STORE_NAME}*`,
    `No: ${inv.invoice_no}`,
    `Pelanggan: ${inv.customer_name}`,
    "-------------------------",
    ...inv.items.map((i: any) => `${i.name} x${i.qty} = ${rupiah(i.subtotal)}`),
    "-------------------------",
    `TOTAL: ${rupiah(inv.total)}`,
    `Bayar: ${PAYMENT_LABELS[inv.payment_method] || inv.payment_method}`,
    inv.status === "outstanding" ? "Status: BELUM LUNAS (Tempo)" : "Status: LUNAS",
    "",
    "Terima kasih 🙏",
  ];
  return lines.join("\n");
}

export function sendWhatsApp(inv: any, phone?: string) {
  const text = encodeURIComponent(receiptText(inv));
  const p = phone ? phone.replace(/^0/, "62").replace(/\D/g, "") : "";
  const url = p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`;
  return Linking.openURL(url);
}

function receiptHtml(inv: any): string {
  const rows = inv.items
    .map(
      (i: any) =>
        `<tr><td>${i.name}<br/><small>${i.qty} x ${rupiah(i.price)}</small></td><td style="text-align:right">${rupiah(i.subtotal)}</td></tr>`,
    )
    .join("");
  return `
  <html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { font-family: monospace; }
    body { width: 280px; margin: 0 auto; padding: 8px; color: #000; }
    h2 { text-align:center; margin: 4px 0; }
    .muted { text-align:center; font-size: 11px; color:#333; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    td { padding: 3px 0; vertical-align: top; }
    .hr { border-top: 1px dashed #000; margin: 6px 0; }
    .total { display:flex; justify-content: space-between; font-weight: bold; font-size: 14px; }
    .foot { text-align:center; margin-top: 10px; font-size: 12px; }
  </style></head>
  <body>
    <h2>${STORE_NAME}</h2>
    <div class="muted">Agen LPG • Galon • Depot Isi Ulang</div>
    <div class="hr"></div>
    <div style="font-size:12px">No: ${inv.invoice_no}<br/>Pelanggan: ${inv.customer_name}</div>
    <table>${rows}</table>
    <div class="hr"></div>
    <div class="total"><span>TOTAL</span><span>${rupiah(inv.total)}</span></div>
    <div style="font-size:12px;margin-top:4px">Bayar: ${PAYMENT_LABELS[inv.payment_method] || inv.payment_method}</div>
    <div style="font-size:12px">Status: ${inv.status === "outstanding" ? "BELUM LUNAS (Tempo)" : "LUNAS"}</div>
    <div class="foot">Terima kasih 🙏</div>
  </body></html>`;
}

// Print via system dialog (AirPrint / network / OS-level Bluetooth printers).
// Dedicated thermal Bluetooth SDK requires a native build.
export async function printReceipt(inv: any) {
  const html = receiptHtml(inv);
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
  } else {
    await Print.printAsync({ html });
  }
}
