package com.depotpro.app.ui.pos

import java.text.NumberFormat
import java.util.Locale

/** Nama usaha pada struk. Ubah di sini bila perlu. */
const val STORE_NAME = "DepotPro"

fun paymentLabel(code: String?): String = when (code?.lowercase()) {
    "cash" -> "Tunai"
    "transfer" -> "Transfer"
    "qris" -> "QRIS"
    "tempo" -> "Tempo / Utang"
    "deposit" -> "Saldo Deposit"
    else -> code ?: "-"
}

fun rupiah(value: Double): String {
    val format = NumberFormat.getCurrencyInstance(Locale("id", "ID"))
    format.maximumFractionDigits = 0
    return format.format(value)
}

/** Teks struk sederhana (monospace) untuk ditampilkan dan dibagikan lewat WhatsApp/printer. */
fun buildReceiptText(r: ReceiptData): String {
    val o = r.order
    val sb = StringBuilder()
    sb.appendLine("=== $STORE_NAME ===")
    val time = o.createdAtLabel ?: o.createdAt
    if (!time.isNullOrBlank()) sb.appendLine(time)
    o.id?.let { sb.appendLine("No: ${it.take(8).uppercase()}") }
    sb.appendLine("Pelanggan: ${o.customerName ?: "Pelanggan Umum"}")
    if (!o.driverName.isNullOrBlank()) sb.appendLine("Kurir: ${o.driverName}")
    sb.appendLine("--------------------------------")
    o.items.forEach { item ->
        sb.appendLine(item.productName)
        sb.appendLine("  ${item.quantity} x ${rupiah(item.price)} = ${rupiah(item.price * item.quantity)}")
    }
    sb.appendLine("--------------------------------")
    sb.appendLine("TOTAL: ${rupiah(o.totalAmount)}")
    sb.appendLine("Metode: ${paymentLabel(r.paymentType)}")
    if (r.cashPaid != null) {
        sb.appendLine("Tunai: ${rupiah(r.cashPaid)}")
        sb.appendLine("Kembali: ${rupiah(r.change ?: 0.0)}")
    }
    if (r.paymentType.lowercase() == "tempo") sb.appendLine("Status: BELUM LUNAS (piutang)")
    sb.appendLine()
    sb.append("Terima kasih!")
    return sb.toString()
}
