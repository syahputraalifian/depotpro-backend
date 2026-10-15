package com.depotpro.app.ui.closing

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.DailyReport
import com.depotpro.app.ui.pos.paymentLabel
import com.depotpro.app.ui.pos.rupiah

@Composable
fun ClosingScreen(closingViewModel: ClosingViewModel, userRole: String? = null) {
    val state by closingViewModel.state.collectAsState()

    // Muat ulang tiap layar dibuka (data harian berubah terus selama ada penjualan).
    LaunchedEffect(Unit) { closingViewModel.load() }

    when (val s = state) {
        is ClosingState.Loading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        is ClosingState.Error -> Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(s.message, color = MaterialTheme.colorScheme.error)
            Button(onClick = { closingViewModel.load() }, modifier = Modifier.padding(top = 12.dp)) { Text("Coba Lagi") }
        }
        is ClosingState.Success -> ClosingContent(
            report = s.report,
            onReload = { closingViewModel.load() },
            onSave = { counted, note -> closingViewModel.save(counted, note) },
            isOwner = userRole == "owner",
            onDeleteClosing = { closingViewModel.deleteClosing(s.report.date) }
        )
    }
}

private fun plain(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()

private fun summaryText(r: DailyReport, counted: Double?): String {
    val sb = StringBuilder()
    sb.appendLine("TUTUP KASIR ${r.date}")
    sb.appendLine("Transaksi: ${r.ordersCount} (batal: ${r.cancelledCount})")
    sb.appendLine("Total penjualan: ${rupiah(r.totalSales)}")
    r.byMethod.orEmpty().forEach { sb.appendLine("  - ${paymentLabel(it.method)} (${it.count}x): ${rupiah(it.amount)}") }
    sb.appendLine("Pengeluaran: ${rupiah(r.expensesTotal)}")
    sb.appendLine("Setoran driver diterima: ${rupiah(r.driverSettlementsReceived)}")
    sb.appendLine("Pembayaran piutang tunai: ${rupiah(r.receivablePaymentsCash)}")
    sb.appendLine("Uang seharusnya di laci: ${rupiah(r.expectedCash)}")
    if (counted != null) {
        sb.appendLine("Uang fisik di laci: ${rupiah(counted)}")
        sb.append("Selisih: ${rupiah(counted - r.expectedCash)}")
    }
    return sb.toString().trimEnd()
}

@Composable
private fun ClosingContent(
    report: DailyReport,
    onReload: () -> Unit,
    onSave: (Double, String) -> Unit,
    isOwner: Boolean,
    onDeleteClosing: () -> Unit
) {
    val context = LocalContext.current
    var countedStr by remember(report.date, report.closing?.countedCash) {
        mutableStateOf(report.closing?.countedCash?.let { plain(it) } ?: "")
    }
    var note by remember(report.date, report.closing?.note) { mutableStateOf(report.closing?.note ?: "") }
    var showDelete by remember { mutableStateOf(false) }

    val counted = countedStr.toDoubleOrNull()
    val difference = if (counted != null) counted - report.expectedCash else null

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Tutup Kasir - ${report.date}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Penjualan Hari Ini", fontWeight = FontWeight.Bold)
                LineRow("Total penjualan", rupiah(report.totalSales), bold = true)
                LineRow("Jumlah transaksi", "${report.ordersCount}")
                if (report.cancelledCount > 0) LineRow("Transaksi dibatalkan", "${report.cancelledCount}")
                val methods = report.byMethod.orEmpty()
                if (methods.isNotEmpty()) {
                    Divider()
                    methods.forEach { LineRow("${paymentLabel(it.method)} (${it.count}x)", rupiah(it.amount)) }
                }
            }
        }

        val items = report.itemsSold.orEmpty()
        if (items.isNotEmpty()) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Barang Terjual", fontWeight = FontWeight.Bold)
                    items.take(10).forEach { LineRow(it.productName, "${it.qty} (${rupiah(it.amount)})") }
                }
            }
        }

        if (report.driverCashOutstanding > 0) {
            Text(
                "Uang tunai di tangan driver (belum disetor): ${rupiah(report.driverCashOutstanding)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Hitungan Uang di Laci (Tunai)", fontWeight = FontWeight.Bold)
                LineRow("Penjualan tunai di toko", rupiah(report.drawerCashSales))
                LineRow("+ Setoran driver diterima", rupiah(report.driverSettlementsReceived))
                LineRow("+ Pembayaran piutang tunai", rupiah(report.receivablePaymentsCash))
                LineRow("- Pengeluaran (dianggap tunai)", rupiah(report.expensesTotal))
                Divider()
                LineRow("Uang seharusnya di laci", rupiah(report.expectedCash), bold = true)
            }
        }

        Text(
            "Pengeluaran, setoran driver, dan pembayaran piutang yang masih tercatat ikut dihitung. Hapus di menu Pengeluaran atau Setoran bila keliru.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        OutlinedTextField(
            value = countedStr,
            onValueChange = { countedStr = it.filter { ch -> ch.isDigit() } },
            label = { Text("Uang fisik di laci (hasil hitung)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
        )
        if (difference != null) {
            val ok = difference == 0.0
            Text(
                when {
                    ok -> "Pas, tidak ada selisih"
                    difference > 0 -> "Lebih ${rupiah(difference)}"
                    else -> "Kurang ${rupiah(-difference)}"
                },
                fontWeight = FontWeight.Bold,
                color = if (ok) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.error
            )
        }
        OutlinedTextField(
            value = note,
            onValueChange = { note = it },
            label = { Text("Catatan (opsional)") },
            modifier = Modifier.fillMaxWidth()
        )

        Button(
            onClick = { if (counted != null) onSave(counted, note) },
            enabled = counted != null,
            modifier = Modifier.fillMaxWidth()
        ) { Text(if (report.closing != null) "Perbarui Tutup Kasir" else "Simpan Tutup Kasir") }

        report.closing?.let { c ->
            Text(
                "Tersimpan oleh ${c.closedByName ?: "-"}. Selisih tercatat: ${rupiah(c.difference)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (isOwner && report.closing != null) {
            TextButton(onClick = { showDelete = true }, modifier = Modifier.fillMaxWidth()) {
                Text("Hapus Catatan Tutup Kasir Hari Ini", color = MaterialTheme.colorScheme.error)
            }
        }
        if (showDelete) {
            AlertDialog(
                onDismissRequest = { showDelete = false },
                title = { Text("Hapus Catatan Tutup Kasir?") },
                text = { Text("Catatan hitungan uang laci tanggal ${report.date} dihapus. Data penjualan tidak berubah.") },
                confirmButton = {
                    Button(onClick = {
                        showDelete = false
                        onDeleteClosing()
                    }) { Text("Hapus") }
                },
                dismissButton = { TextButton(onClick = { showDelete = false }) { Text("Batal") } }
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedButton(onClick = onReload, modifier = Modifier.weight(1f)) { Text("Muat Ulang") }
            OutlinedButton(
                onClick = {
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, summaryText(report, counted))
                    }
                    context.startActivity(Intent.createChooser(send, "Bagikan ringkasan"))
                },
                modifier = Modifier.weight(1f)
            ) { Text("Bagikan") }
        }
    }
}

@Composable
private fun LineRow(label: String, value: String, bold: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(
            label,
            modifier = Modifier.weight(1f),
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal
        )
        Text(value, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal)
    }
}
