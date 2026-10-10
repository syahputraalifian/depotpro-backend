package com.depotpro.app.ui.receivable

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Payment
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.Receivable
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceivableScreen(receivableViewModel: ReceivableViewModel) {
    val state by receivableViewModel.state.collectAsState()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("id", "ID"))

    var showDialog by remember { mutableStateOf(false) }
    var editingReceivable by remember { mutableStateOf<Receivable?>(null) }
    var customerName by remember { mutableStateOf("") }
    var totalAmount by remember { mutableStateOf("") }
    var dueDate by remember { mutableStateOf("2026-10-15") }

    fun openAddDialog() {
        editingReceivable = null
        customerName = ""
        totalAmount = "150000"
        dueDate = "2026-10-15"
        showDialog = true
    }

    fun openEditDialog(r: Receivable) {
        editingReceivable = r
        customerName = r.customerName
        totalAmount = r.totalAmount.toInt().toString()
        dueDate = r.dueDate ?: "2026-10-15"
        showDialog = true
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Manajemen Piutang Pelanggan", fontWeight = FontWeight.Bold) }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { openAddDialog() }) {
                Icon(Icons.Default.Add, contentDescription = "Tambah Piutang")
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val current = state) {
                is ReceivableState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is ReceivableState.Success -> {
                    if (current.receivables.isEmpty()) {
                        Text("Belum ada data piutang.", modifier = Modifier.align(Alignment.Center))
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(current.receivables, key = { it.id ?: it.customerName }) { rec ->
                                val outstanding = rec.totalAmount - rec.paidAmount
                                Card(
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(rec.customerName, fontWeight = FontWeight.Bold)
                                            Badge(
                                                containerColor = when (rec.status) {
                                                    "paid" -> MaterialTheme.colorScheme.primaryContainer
                                                    else -> MaterialTheme.colorScheme.errorContainer
                                                }
                                            ) {
                                                Text(rec.status?.uppercase() ?: "UNPAID", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), fontWeight = FontWeight.Bold)
                                            }
                                        }

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text("Total: ${currencyFormatter.format(rec.totalAmount)}", style = MaterialTheme.typography.bodySmall)
                                                Text("Sisa Piutang: ${currencyFormatter.format(outstanding)}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                                            }

                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                if (rec.status != "paid") {
                                                    Button(
                                                        onClick = { receivableViewModel.payReceivable(rec.id ?: "", outstanding) },
                                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                                    ) {
                                                        Icon(Icons.Default.Payment, contentDescription = null, modifier = Modifier.size(16.dp))
                                                        Spacer(modifier = Modifier.width(4.dp))
                                                        Text("Lunasi")
                                                    }
                                                }
                                                IconButton(onClick = { openEditDialog(rec) }) {
                                                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary)
                                                }
                                                IconButton(onClick = { rec.id?.let { receivableViewModel.deleteReceivable(it) } }) {
                                                    Icon(Icons.Default.Delete, contentDescription = "Hapus", tint = MaterialTheme.colorScheme.error)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                is ReceivableState.Error -> {
                    Text(current.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.align(Alignment.Center))
                }
                else -> {}
            }

            if (showDialog) {
                AlertDialog(
                    onDismissRequest = { showDialog = false },
                    title = { Text(if (editingReceivable == null) "Catat Piutang Baru" else "Edit Piutang Pelanggan") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(value = customerName, onValueChange = { customerName = it }, label = { Text("Nama Pelanggan") })
                            OutlinedTextField(value = totalAmount, onValueChange = { totalAmount = it }, label = { Text("Total Piutang (Rp)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(value = dueDate, onValueChange = { dueDate = it }, label = { Text("Jatuh Tempo (YYYY-MM-DD)") })
                        }
                    },
                    confirmButton = {
                        Button(onClick = {
                            val amt = totalAmount.toDoubleOrNull() ?: 150000.0
                            if (customerName.isNotBlank() && amt > 0) {
                                if (editingReceivable == null) {
                                    receivableViewModel.addReceivable(customerName, amt, dueDate)
                                } else {
                                    editingReceivable?.id?.let { receivableViewModel.updateReceivable(it, customerName, amt, dueDate) }
                                }
                                showDialog = false
                            }
                        }) {
                            Text("Simpan")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showDialog = false }) {
                            Text("Batal")
                        }
                    }
                )
            }
        }
    }
}
