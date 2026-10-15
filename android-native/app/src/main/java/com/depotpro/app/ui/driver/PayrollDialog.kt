package com.depotpro.app.ui.driver

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.Driver
import com.depotpro.app.data.model.Payroll
import com.depotpro.app.ui.pos.formatWib
import com.depotpro.app.ui.pos.rupiah

/** Riwayat pembayaran gaji seorang driver. Hanya pembayaran TERAKHIR yang bisa dibatalkan (bila salah bayar). */
@Composable
fun PayrollDialog(driver: Driver, driverViewModel: DriverViewModel, onDismiss: () -> Unit) {
    var items by remember { mutableStateOf<List<Payroll>?>(null) }
    var undoTarget by remember { mutableStateOf<Payroll?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    LaunchedEffect(driver.id, reloadKey) {
        val id = driver.id
        if (id != null) driverViewModel.loadPayrolls(id) { items = it }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Riwayat Gaji - ${driver.name}") },
        text = {
            val list = items
            when {
                list == null -> Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                list.isEmpty() -> Text("Belum ada pembayaran gaji.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                else -> Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    list.forEachIndexed { index, p ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(rupiah(p.amount), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                    Text(formatWib(p.paidAt), style = MaterialTheme.typography.bodySmall)
                                }
                                Text(
                                    "${p.completedDeliveries} pengiriman, ${p.gallonsDelivered} galon/AMDK, ${p.lpgDelivered} LPG",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                if (index == 0) {
                                    TextButton(onClick = { undoTarget = p }) {
                                        Text("Batalkan pembayaran ini", color = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Tutup") } }
    )

    undoTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { undoTarget = null },
            title = { Text("Batalkan Pembayaran Gaji?") },
            text = {
                Text("Pengeluaran gaji ${rupiah(target.amount)} akan dihapus dan hitungan komisi dikembalikan, sehingga gaji bisa dibayar ulang dengan benar.")
            },
            confirmButton = {
                Button(onClick = {
                    undoTarget = null
                    target.id?.let { id -> driverViewModel.undoPayroll(id) { reloadKey += 1 } }
                }) { Text("Batalkan Pembayaran") }
            },
            dismissButton = { TextButton(onClick = { undoTarget = null }) { Text("Kembali") } }
        )
    }
}
