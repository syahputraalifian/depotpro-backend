package com.depotpro.app.ui.expense

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoneyOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.Expense
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseScreen(expenseViewModel: ExpenseViewModel) {
    val state by expenseViewModel.state.collectAsState()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("id", "ID"))

    var showDialog by remember { mutableStateOf(false) }
    var editingExpense by remember { mutableStateOf<Expense?>(null) }
    var category by remember { mutableStateOf("Operasional") }
    var amount by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }

    fun openAddDialog() {
        editingExpense = null
        category = "Operasional"
        amount = "50000"
        note = ""
        showDialog = true
    }

    fun openEditDialog(e: Expense) {
        editingExpense = e
        category = e.category
        amount = e.amount.toInt().toString()
        note = e.note ?: ""
        showDialog = true
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pengeluaran Operasional", fontWeight = FontWeight.Bold) }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { openAddDialog() }) {
                Icon(Icons.Default.Add, contentDescription = "Tambah Pengeluaran")
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val current = state) {
                is ExpenseState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is ExpenseState.Success -> {
                    if (current.expenses.isEmpty()) {
                        Text("Belum ada data pengeluaran.", modifier = Modifier.align(Alignment.Center))
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(current.expenses, key = { it.id ?: it.category }) { expense ->
                                Card(
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Surface(
                                                shape = RoundedCornerShape(8.dp),
                                                color = MaterialTheme.colorScheme.errorContainer,
                                                modifier = Modifier.size(40.dp)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Icon(Icons.Default.MoneyOff, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                                                }
                                            }
                                            Column {
                                                Text(expense.category, fontWeight = FontWeight.Bold)
                                                Text(expense.note ?: "-", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                                Text(expense.date ?: "", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                                            }
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            Text(
                                                currencyFormatter.format(expense.amount),
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.error
                                            )
                                            IconButton(onClick = { openEditDialog(expense) }) {
                                                Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary)
                                            }
                                            IconButton(onClick = { expense.id?.let { expenseViewModel.deleteExpense(it) } }) {
                                                Icon(Icons.Default.Delete, contentDescription = "Hapus", tint = MaterialTheme.colorScheme.error)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                is ExpenseState.Error -> {
                    Text(current.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.align(Alignment.Center))
                }
                else -> {}
            }

            if (showDialog) {
                AlertDialog(
                    onDismissRequest = { showDialog = false },
                    title = { Text(if (editingExpense == null) "Catat Pengeluaran Baru" else "Edit Pengeluaran") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Kategori (Bensin/Listrik/Gaji)") })
                            OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Nominal (Rp)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Catatan / Keterangan") })
                        }
                    },
                    confirmButton = {
                        Button(onClick = {
                            val a = amount.toDoubleOrNull() ?: 50000.0
                            if (category.isNotBlank() && a > 0) {
                                if (editingExpense == null) {
                                    expenseViewModel.addExpense(category, a, note)
                                } else {
                                    editingExpense?.id?.let { expenseViewModel.updateExpense(it, category, a, note) }
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
