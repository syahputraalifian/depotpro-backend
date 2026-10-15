package com.depotpro.app.ui.pos

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

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

/** Ubah waktu ISO (UTC) dari server menjadi teks WIB yang mudah dibaca. */
fun formatWib(iso: String?): String {
    if (iso.isNullOrBlank() || iso.length < 19) return iso ?: "-"
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        parser.timeZone = TimeZone.getTimeZone("UTC")
        val date = parser.parse(iso.substring(0, 19)) ?: return iso
        val out = SimpleDateFormat("dd MMM yyyy HH:mm", Locale("id", "ID"))
        out.timeZone = TimeZone.getTimeZone("Asia/Jakarta")
        out.format(date)
    } catch (e: Exception) {
        iso
    }
}

/** Apakah waktu ISO (UTC) dari server jatuh pada hari ini menurut WIB. */
fun isTodayWib(iso: String?): Boolean {
    if (iso.isNullOrBlank() || iso.length < 19) return false
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        parser.timeZone = TimeZone.getTimeZone("UTC")
        val date = parser.parse(iso.substring(0, 19)) ?: return false
        val day = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        day.timeZone = TimeZone.getTimeZone("Asia/Jakarta")
        day.format(date) == day.format(java.util.Date())
    } catch (e: Exception) {
        false
    }
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
