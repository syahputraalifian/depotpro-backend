package com.depotpro.app.ui.driver

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.Driver
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriverScreen(driverViewModel: DriverViewModel, userRole: String?) {
    val context = LocalContext.current
    val state by driverViewModel.state.collectAsState()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("id", "ID"))

    val canManage = userRole == "owner"

    var showDialog by remember { mutableStateOf(false) }
    var editingDriver by remember { mutableStateOf<Driver?>(null) }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("available") }

    var completingOrderId by remember { mutableStateOf<String?>(null) }
    var deliveryNote by remember { mutableStateOf("") }
    var emptyGallonExchanged by remember { mutableStateOf("1") }
    var emptyLpgExchanged by remember { mutableStateOf("0") }

    var deliveryFilter by remember { mutableStateOf("belum") }
    var salaryDriver by remember { mutableStateOf<Driver?>(null) }

    fun openAddDialog() {
        editingDriver = null
        name = ""
        phone = "08198765432"
        status = "available"
        showDialog = true
    }

    fun openEditDialog(d: Driver) {
        editingDriver = d
        name = d.name
        phone = d.phone ?: "08198765432"
        status = d.status ?: "available"
        showDialog = true
    }

    salaryDriver?.let { d ->
        SalaryDialog(
            driver = d,
            onDismiss = { salaryDriver = null },
            onSave = { base, gallonRate, lpgRate, fuel, deductions ->
                d.id?.let { driverViewModel.updateSalary(it, base, gallonRate, lpgRate, fuel, deductions) }
                salaryDriver = null
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Payroll & Pengiriman Kurir", fontWeight = FontWeight.Bold) }
            )
        },
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(onClick = { openAddDialog() }) {
                    Icon(Icons.Default.Add, contentDescription = "Tambah Driver")
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
                is DriverState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is DriverState.Success -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        item {
                            Text("Rekap Finansial & Gaji Kurir", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                        }

                        if (current.drivers.isEmpty()) {
                            item {
                                Text("Belum ada data driver.")
                            }
                        } else {
                            items(current.drivers, key = { "driver-${it.id ?: it.name}" }) { driver ->
                                Card(
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier.padding(16.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(
                                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Icon(Icons.Default.LocalShipping, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                                Text(driver.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                            }
                                            Badge(
                                                containerColor = if (driver.status == "available") MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.tertiaryContainer
                                            ) {
                                                Text(driver.status?.uppercase() ?: "AVAILABLE", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), fontWeight = FontWeight.Bold)
                                            }
                                        }

                                        Divider()

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Column {
                                                Text("Gaji Pokok Harian:", style = MaterialTheme.typography.bodySmall)
                                                Text("Komisi Galon/AMDK (${driver.gallonsDelivered}x @Rp ${driver.gallonCommissionRate.toLong()}):", style = MaterialTheme.typography.bodySmall)
                                                Text("Komisi LPG Gas (${driver.lpgDelivered}x @Rp ${driver.lpgCommissionRate.toLong()}):", style = MaterialTheme.typography.bodySmall)
                                                Text("Uang Bensin Harian:", style = MaterialTheme.typography.bodySmall)
                                            }
                                            Column(horizontalAlignment = Alignment.End) {
                                                Text(currencyFormatter.format(driver.baseSalary), style = MaterialTheme.typography.bodySmall)
                                                Text("+ ${currencyFormatter.format(driver.gallonIncentive)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                                                Text("+ ${currencyFormatter.format(driver.lpgIncentive)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                                                Text("+ ${currencyFormatter.format(driver.fuelAllowance)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                                            }
                                        }

                                        Divider()

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text("Total Diterima Kurir (Take-Home Pay):", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                                Text(currencyFormatter.format(driver.takeHomePay), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
                                            }

                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                if (canManage) {
                                                    Button(
                                                        onClick = {
                                                            driver.id?.let { driverViewModel.payDriver(it) }
                                                            Toast.makeText(context, "Gaji & Komisi Produk ${driver.name} telah dibayarkan!", Toast.LENGTH_SHORT).show()
                                                        },
                                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                                    ) {
                                                        Icon(Icons.Default.Payments, contentDescription = null, modifier = Modifier.size(16.dp))
                                                        Spacer(modifier = Modifier.width(4.dp))
                                                        Text("Bayar Kurir", style = MaterialTheme.typography.bodySmall)
                                                    }

                                                    IconButton(onClick = { openEditDialog(driver) }, modifier = Modifier.size(32.dp)) {
                                                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary)
                                                    }
                                                    IconButton(onClick = { driver.id?.let { driverViewModel.deleteDriver(it) } }, modifier = Modifier.size(32.dp)) {
                                                        Icon(Icons.Default.Delete, contentDescription = "Hapus", tint = MaterialTheme.colorScheme.error)
                                                    }
                                                }
                                            }
                                        }

                                        if (canManage) {
                                            OutlinedButton(
                                                onClick = { salaryDriver = driver },
                                                modifier = Modifier.fillMaxWidth()
                                            ) { Text("Atur Gaji & Komisi") }
                                            TextButton(
                                                onClick = { driver.id?.let { driverViewModel.recalculate(it) } },
                                                modifier = Modifier.fillMaxWidth()
                                            ) { Text("Hitung Ulang Komisi dari Pengiriman") }
                                        }
                                    }
                                }
                            }
                        }

                        item {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Daftar Tugas Pengiriman (Delivery Dispatch)", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                FilterChip(
                                    selected = deliveryFilter == "belum",
                                    onClick = { deliveryFilter = "belum" },
                                    label = { Text("Belum Kirim (${current.orders.count { it.status != "delivered" }})") },
                                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = MaterialTheme.colorScheme.errorContainer)
                                )
                                FilterChip(
                                    selected = deliveryFilter == "selesai",
                                    onClick = { deliveryFilter = "selesai" },
                                    label = { Text("Histori Selesai (${current.orders.count { it.status == "delivered" }})") },
                                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = MaterialTheme.colorScheme.primaryContainer)
                                )
                                FilterChip(
                                    selected = deliveryFilter == "semua",
                                    onClick = { deliveryFilter = "semua" },
                                    label = { Text("Semua (${current.orders.size})") }
                                )
                            }
                        }

                        val filteredOrders = when (deliveryFilter) {
                            "belum" -> current.orders.filter { it.status != "delivered" }
                            "selesai" -> current.orders.filter { it.status == "delivered" }
                            else -> current.orders
                        }

                        if (filteredOrders.isEmpty()) {
                            item {
                                Text("Tidak ada pengiriman pada kategori ini.")
                            }
                        } else {
                            items(filteredOrders, key = { "order-${it.id ?: it.customerName.orEmpty()}" }) { order ->
                                Card(
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier.padding(16.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(order.id ?: "INV", fontWeight = FontWeight.Bold)
                                            Badge(
                                                containerColor = when (order.status) {
                                                    "delivered" -> MaterialTheme.colorScheme.primaryContainer
                                                    "on_delivery" -> MaterialTheme.colorScheme.tertiaryContainer
                                                    else -> MaterialTheme.colorScheme.errorContainer
                                                }
                                            ) {
                                                Text(
                                                    text = when (order.status) {
                                                        "delivered" -> "SELESAI KIRIM"
                                                        "on_delivery" -> "SEDANG DIJALAN"
                                                        else -> "BELUM DIKIRIM"
                                                    },
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }

                                        Text("Pelanggan: ${order.customerName ?: "Umum"}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)

                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            OutlinedButton(
                                                onClick = {
                                                    val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:08123456789"))
                                                    context.startActivity(intent)
                                                },
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp)
                                            ) {
                                                Icon(Icons.Default.Call, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Telepon", style = MaterialTheme.typography.bodySmall)
                                            }

                                            OutlinedButton(
                                                onClick = {
                                                    val uri = Uri.parse("geo:0,0?q=${Uri.encode(order.customerName ?: "Depot")}")
                                                    val intent = Intent(Intent.ACTION_VIEW, uri)
                                                    context.startActivity(intent)
                                                },
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp)
                                            ) {
                                                Icon(Icons.Default.Map, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Buka Peta", style = MaterialTheme.typography.bodySmall)
                                            }
                                        }

                                        Text("Detail Barang:", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                        if (order.items.isEmpty()) {
                                            Text("- 5x Air Isi Ulang Galon 19L", style = MaterialTheme.typography.bodySmall)
                                        } else {
                                            order.items.forEach { item ->
                                                Text("- ${item.productName} (${item.quantity} unit)", style = MaterialTheme.typography.bodySmall)
                                            }
                                        }

                                        Text("Total Tagihan: ${currencyFormatter.format(order.totalAmount)}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)

                                        Divider()

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            if (order.status != "on_delivery" && order.status != "delivered") {
                                                OutlinedButton(
                                                    onClick = { order.id?.let { driverViewModel.updateOrderStatus(it, "on_delivery") } },
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Text("Mulai Kirim")
                                                }
                                            }
                                            if (order.status != "delivered") {
                                                Button(
                                                    onClick = { completingOrderId = order.id },
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Text("Selesai (Delivered)")
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                is DriverState.Error -> {
                    Text(current.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.align(Alignment.Center))
                }
                else -> {}
            }

            if (showDialog && canManage) {
                AlertDialog(
                    onDismissRequest = { showDialog = false },
                    title = { Text(if (editingDriver == null) "Tambah Driver Baru" else "Edit Driver") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nama Lengkap Driver") })
                            OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("No. Telepon / WhatsApp") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                            OutlinedTextField(value = status, onValueChange = { status = it }, label = { Text("Status (available/delivering)") })
                        }
                    },
                    confirmButton = {
                        Button(onClick = {
                            val finalPhone = phone.ifBlank { "08198765432" }
                            if (name.isNotBlank()) {
                                if (editingDriver == null) {
                                    driverViewModel.addDriver(name, finalPhone, status)
                                } else {
                                    editingDriver?.id?.let { driverViewModel.updateDriver(it, name, finalPhone, status) }
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

            if (completingOrderId != null) {
                AlertDialog(
                    onDismissRequest = { completingOrderId = null },
                    title = { Text("Konfirmasi Selesai & Pengembalian Wadah Kosong") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Catat galon & tabung LPG kosong yang diterima kurir dari pelanggan:", style = MaterialTheme.typography.bodySmall)
                            OutlinedTextField(
                                value = emptyGallonExchanged,
                                onValueChange = { emptyGallonExchanged = it },
                                label = { Text("Galon Kosong Diterima Kembali (Pcs)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                            )
                            OutlinedTextField(
                                value = emptyLpgExchanged,
                                onValueChange = { emptyLpgExchanged = it },
                                label = { Text("Tabung LPG Kosong Diterima Kembali (Pcs)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                            )
                            OutlinedTextField(
                                value = deliveryNote,
                                onValueChange = { deliveryNote = it },
                                label = { Text("Catatan (Contoh: 1 Galon dipinjam/hutang)") }
                            )
                        }
                    },
                    confirmButton = {
                        Button(onClick = {
                            completingOrderId?.let { id ->
                                val galons = emptyGallonExchanged.toIntOrNull() ?: 0
                                val lpgs = emptyLpgExchanged.toIntOrNull() ?: 0
                                driverViewModel.updateOrderStatus(id, "delivered", galons, lpgs)
                                Toast.makeText(context, "Pengiriman Selesai! Stok Wadah Kosong ($galons Galon, $lpgs Tabung) Disinkronkan.", Toast.LENGTH_LONG).show()
                            }
                            completingOrderId = null
                            deliveryNote = ""
                            emptyGallonExchanged = "1"
                            emptyLpgExchanged = "0"
                        }) {
                            Text("Konfirmasi Selesai & Tambah Stok Kosong")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { completingOrderId = null }) {
                            Text("Batal")
                        }
                    }
                )
            }
        }
    }
}
