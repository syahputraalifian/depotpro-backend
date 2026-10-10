package com.depotpro.app.ui.customer

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.Customer

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerScreen(customerViewModel: CustomerViewModel, userRole: String?) {
    val state by customerViewModel.state.collectAsState()

    val canManage = userRole == "owner" || userRole == "kasir"

    var showDialog by remember { mutableStateOf(false) }
    var editingCustomer by remember { mutableStateOf<Customer?>(null) }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }

    fun openAddDialog() {
        editingCustomer = null
        name = ""
        phone = "08123456789"
        address = "Jl. Depot Melati No. 8"
        showDialog = true
    }

    fun openEditDialog(c: Customer) {
        editingCustomer = c
        name = c.name
        phone = c.phone ?: "08123456789"
        address = c.address ?: "Jl. Depot Melati No. 8"
        showDialog = true
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Daftar Pelanggan Depot", fontWeight = FontWeight.Bold) }
            )
        },
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(onClick = { openAddDialog() }) {
                    Icon(Icons.Default.Add, contentDescription = "Tambah Pelanggan")
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val current = state) {
                is CustomerState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is CustomerState.Success -> {
                    if (current.customers.isEmpty()) {
                        Text("Belum ada data pelanggan.", modifier = Modifier.align(Alignment.Center))
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(current.customers, key = { it.id ?: it.name }) { customer ->
                                Card(
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            color = MaterialTheme.colorScheme.secondaryContainer,
                                            modifier = Modifier.size(40.dp)
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                                            }
                                        }
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(customer.name, fontWeight = FontWeight.Bold)
                                            Text(customer.phone ?: "-", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            Text(customer.address ?: "-", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }

                                        if (canManage) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                IconButton(onClick = { openEditDialog(customer) }) {
                                                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary)
                                                }
                                                IconButton(onClick = { customer.id?.let { customerViewModel.deleteCustomer(it) } }) {
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
                is CustomerState.Error -> {
                    Text(current.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.align(Alignment.Center))
                }
                else -> {}
            }

            if (showDialog && canManage) {
                AlertDialog(
                    onDismissRequest = { showDialog = false },
                    title = { Text(if (editingCustomer == null) "Tambah Pelanggan Baru" else "Edit Pelanggan") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nama Pelanggan / Toko") })
                            OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("No. Telepon / WhatsApp") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                            OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Alamat Lengkap") })
                        }
                    },
                    confirmButton = {
                        Button(onClick = {
                            val finalPhone = phone.ifBlank { "08123456789" }
                            val finalAddress = address.ifBlank { "Jl. Depot Melati No. 8" }
                            if (name.isNotBlank()) {
                                if (editingCustomer == null) {
                                    customerViewModel.addCustomer(name, finalPhone, finalAddress)
                                } else {
                                    editingCustomer?.id?.let { customerViewModel.updateCustomer(it, name, finalPhone, finalAddress) }
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
