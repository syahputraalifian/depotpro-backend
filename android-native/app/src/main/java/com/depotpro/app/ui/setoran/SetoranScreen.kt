package com.depotpro.app.ui.setoran

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.CashOutstanding
import com.depotpro.app.data.model.SettlementItem
import com.depotpro.app.ui.pos.formatWib
import com.depotpro.app.ui.pos.rupiah

private fun plain(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()

@Composable
fun SetoranScreen(setoranViewModel: SetoranViewModel, userRole: String?) {
    val state by setoranViewModel.state.collectAsState()
    LaunchedEffect(Unit) { setoranViewModel.load() }

    val isDriver = userRole == "driver"
    var showSubmit by remember { mutableStateOf(false) }
    var confirmTarget by remember { mutableStateOf<SettlementItem?>(null) }
    var directTarget by remember { mutableStateOf<CashOutstanding?>(null) }
    var editTarget by remember { mutableStateOf<SettlementItem?>(null) }
    var deleteTarget by remember { mutableStateOf<SettlementItem?>(null) }
    val isOwner = userRole == "owner"

    when (val s = state) {
        is SetoranState.Loading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        is SetoranState.Error -> Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(s.message, color = MaterialTheme.colorScheme.error)
            Button(onClick = { setoranViewModel.load() }, modifier = Modifier.padding(top = 12.dp)) { Text("Coba Lagi") }
        }
        is SetoranState.Success -> {
            val pending = s.settlements.filter { it.status == "pending" }
            val history = s.settlements.filter { it.status == "confirmed" }.take(20)
            val totalOutstanding = s.outstanding.sumOf { it.amount }
            val totalOrders = s.outstanding.sumOf { it.orders }

            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    Text("Setoran Uang", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                }

                if (isDriver) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Uang tunai belum disetor", fontWeight = FontWeight.Bold)
                                Text(
                                    rupiah(totalOutstanding),
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Text("Dari $totalOrders pengiriman tunai yang sudah selesai", style = MaterialTheme.typography.bodySmall)
                                Button(
                                    onClick = { showSubmit = true },
                                    enabled = totalOutstanding > 0,
                                    modifier = Modifier.fillMaxWidth()
                                ) { Text("Setor Uang ke Toko") }
                            }
                        }
                    }
                } else {
                    item {
                        Text("Uang di Tangan Driver", fontWeight = FontWeight.Bold)
                    }
                    if (s.outstanding.isEmpty()) {
                        item { Text("Tidak ada uang tunai yang belum disetor.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    items(s.outstanding, key = { it.driverId }) { row ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(row.driverName ?: "Driver", fontWeight = FontWeight.Bold)
                                    Text("${row.orders} pengiriman", style = MaterialTheme.typography.bodySmall)
                                    Text(rupiah(row.amount), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                }
                                Button(onClick = { directTarget = row }) { Text("Terima Tunai") }
                            }
                        }
                    }

                    item { Text("Menunggu Konfirmasi", fontWeight = FontWeight.Bold) }
                    if (pending.isEmpty()) {
                        item { Text("Tidak ada setoran yang menunggu.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    items(pending, key = { it.id ?: it.createdAt ?: "" }) { item ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.driverName ?: item.userName ?: "-", fontWeight = FontWeight.Bold)
                                    Text("${item.orderCount} pengiriman - ${formatWib(item.createdAt)}", style = MaterialTheme.typography.bodySmall)
                                    Text(rupiah(item.amount), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                    if (!item.note.isNullOrBlank()) Text(item.note, style = MaterialTheme.typography.bodySmall)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Button(onClick = { confirmTarget = item }) { Text("Terima") }
                                    if (isOwner) {
                                        TextButton(onClick = { deleteTarget = item }) {
                                            Text("Hapus", color = MaterialTheme.colorScheme.error)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (isDriver) {
                    item { Text("Menunggu Konfirmasi", fontWeight = FontWeight.Bold) }
                    if (pending.isEmpty()) {
                        item { Text("Tidak ada.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    items(pending, key = { it.id ?: it.createdAt ?: "" }) { item ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(rupiah(item.amount), fontWeight = FontWeight.Bold)
                                Text("${item.orderCount} pengiriman - ${formatWib(item.createdAt)}", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }

                item { Text("Riwayat Setoran", fontWeight = FontWeight.Bold) }
                if (history.isEmpty()) {
                    item { Text("Belum ada riwayat.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
                items(history, key = { "h-" + (it.id ?: it.createdAt ?: "") }) { item ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(item.driverName ?: item.userName ?: "-", fontWeight = FontWeight.Bold)
                            Text("Disetor ${rupiah(item.amount)} - diterima ${rupiah(item.receivedAmount ?: item.amount)}")
                            val diff = item.difference ?: 0.0
                            if (diff != 0.0) {
                                Text(
                                    if (diff < 0) "Kurang ${rupiah(-diff)}" else "Lebih ${rupiah(diff)}",
                                    color = MaterialTheme.colorScheme.error,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Text(
                                "Dikonfirmasi ${item.confirmedByName ?: "-"} - ${formatWib(item.confirmedAt)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (isOwner) {
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    TextButton(onClick = { editTarget = item }) { Text("Ubah") }
                                    TextButton(onClick = { deleteTarget = item }) {
                                        Text("Hapus", color = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (showSubmit) {
                NoteDialog(
                    title = "Setor Uang",
                    message = "Setor ${rupiah(totalOutstanding)} dari $totalOrders pengiriman. Setelah dikirim, kasir/pemilik akan mengonfirmasi uang yang diterima.",
                    onDismiss = { showSubmit = false },
                    onConfirm = { note ->
                        showSubmit = false
                        setoranViewModel.submitOwn(note)
                    }
                )
            }
            confirmTarget?.let { target ->
                ReceiveDialog(
                    title = "Terima Setoran",
                    subtitle = "${target.driverName ?: "-"}: setoran ${rupiah(target.amount)}",
                    expected = target.amount,
                    onDismiss = { confirmTarget = null },
                    onConfirm = { received, note ->
                        confirmTarget = null
                        target.id?.let { setoranViewModel.confirm(it, received, note) }
                    }
                )
            }
            directTarget?.let { target ->
                ReceiveDialog(
                    title = "Terima Tunai dari Driver",
                    subtitle = "${target.driverName ?: "-"}: seharusnya ${rupiah(target.amount)} (${target.orders} pengiriman)",
                    expected = target.amount,
                    onDismiss = { directTarget = null },
                    onConfirm = { received, note ->
                        directTarget = null
                        setoranViewModel.receiveDirect(target.driverId, received, note)
                    }
                )
            }
            editTarget?.let { target ->
                ReceiveDialog(
                    title = "Ubah Setoran",
                    subtitle = "${target.driverName ?: "-"}: setoran ${rupiah(target.amount)}",
                    expected = target.amount,
                    initial = target.receivedAmount ?: target.amount,
                    onDismiss = { editTarget = null },
                    onConfirm = { received, note ->
                        editTarget = null
                        target.id?.let { setoranViewModel.edit(it, received, note) }
                    }
                )
            }
            deleteTarget?.let { target ->
                AlertDialog(
                    onDismissRequest = { deleteTarget = null },
                    title = { Text("Hapus Setoran?") },
                    text = {
                        Text("Setoran ${rupiah(target.amount)} dari ${target.driverName ?: "driver"} akan dihapus. Pesanan terkait kembali menjadi belum disetor.")
                    },
                    confirmButton = {
                        Button(onClick = {
                            deleteTarget = null
                            target.id?.let { setoranViewModel.remove(it) }
                        }) { Text("Hapus") }
                    },
                    dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Batal") } }
                )
            }
        }
    }
}

@Composable
private fun NoteDialog(title: String, message: String, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var note by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(message)
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Catatan (opsional)") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = { Button(onClick = { onConfirm(note) }) { Text("Kirim Setoran") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } }
    )
}

@Composable
private fun ReceiveDialog(
    title: String,
    subtitle: String,
    expected: Double,
    onDismiss: () -> Unit,
    onConfirm: (Double, String) -> Unit,
    initial: Double = expected
) {
    var receivedStr by remember { mutableStateOf(plain(initial)) }
    var note by remember { mutableStateOf("") }
    val received = receivedStr.toDoubleOrNull()
    val diff = if (received != null) received - expected else null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(subtitle)
                OutlinedTextField(
                    value = receivedStr,
                    onValueChange = { receivedStr = it.filter { ch -> ch.isDigit() } },
                    label = { Text("Uang yang diterima (hasil hitung)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
                if (diff != null) {
                    Text(
                        when {
                            diff == 0.0 -> "Pas, tidak ada selisih"
                            diff > 0 -> "Lebih ${rupiah(diff)}"
                            else -> "Kurang ${rupiah(-diff)}"
                        },
                        fontWeight = FontWeight.Bold,
                        color = if (diff == 0.0) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.error
                    )
                }
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Catatan (opsional)") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (received != null) onConfirm(received, note) },
                enabled = received != null
            ) { Text("Terima") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } }
    )
}
