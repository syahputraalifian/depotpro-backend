package com.depotpro.app.ui.stok

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.Product
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StokScreen(stokViewModel: StokViewModel, userRole: String?) {
    val context = LocalContext.current
    val state by stokViewModel.stokState.collectAsState()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("id", "ID"))

    val canManageStock = userRole == "owner" || userRole == "gudang"

    var showDialog by remember { mutableStateOf(false) }
    var editingProduct by remember { mutableStateOf<Product?>(null) }
    var name by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Air Isi Ulang") }
    var price by remember { mutableStateOf("5000") }
    var costPrice by remember { mutableStateOf("1500") }
    var stock by remember { mutableStateOf("100") }
    var emptyGallonStock by remember { mutableStateOf("30") }
    var emptyLpgStock by remember { mutableStateOf("0") }
    var unit by remember { mutableStateOf("galon") }
    var reorderPoint by remember { mutableStateOf("") }
    var trackEmpty by remember { mutableStateOf(true) }

    fun openAddDialog() {
        editingProduct = null
        name = ""
        category = "Air Isi Ulang"
        price = ""
        costPrice = ""
        stock = "0"
        emptyGallonStock = "0"
        emptyLpgStock = "0"
        unit = "galon"
        reorderPoint = ""
        trackEmpty = true
        showDialog = true
    }

    fun openEditDialog(p: Product) {
        editingProduct = p
        name = p.name
        category = p.category ?: "Air Isi Ulang"
        price = p.price.toInt().toString()
        costPrice = ((p.costPrice ?: 0.0).toInt()).toString()
        stock = p.stock.toString()
        emptyGallonStock = p.emptyGallonStock.toString()
        emptyLpgStock = p.emptyLpgStock.toString()
        unit = p.unit ?: "galon"
        reorderPoint = p.reorderPoint?.takeIf { it > 0 }?.toString() ?: ""
        trackEmpty = p.trackEmpty != false
        showDialog = true
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Manajemen Stok Produk & Wadah", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = {
                        stokViewModel.refreshCloudData()
                        Toast.makeText(context, "Sinkronisasi Cloud Berhasil!", Toast.LENGTH_SHORT).show()
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Sinkronkan", tint = MaterialTheme.colorScheme.primary)
                    }
                }
            )
        },
        floatingActionButton = {
            if (canManageStock) {
                FloatingActionButton(onClick = { openAddDialog() }) {
                    Icon(Icons.Default.Add, contentDescription = "Tambah Produk")
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
                is StokState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is StokState.Success -> {
                    val totalEmptyGallons = current.products.sumOf { it.emptyGallonStock }
                    val totalEmptyLpg = current.products.sumOf { it.emptyLpgStock }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        item {
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                                shape = RoundedCornerShape(12.dp),
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
                                            Icon(Icons.Default.Inventory, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                            Text("Total Stok Wadah Kosong Depot", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                                        }

                                        OutlinedButton(
                                            onClick = {
                                                stokViewModel.refreshCloudData()
                                                Toast.makeText(context, "Sinkronisasi Cloud Berhasil!", Toast.LENGTH_SHORT).show()
                                            },
                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                        ) {
                                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Sinkronkan", style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                    Divider()
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("Galon Kosong (Siap Isi):", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                                        Text("$totalEmptyGallons Pcs", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
                                    }
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("Tabung LPG Kosong (Siap Refill):", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                                        Text("$totalEmptyLpg Pcs", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.tertiary, style = MaterialTheme.typography.titleMedium)
                                    }
                                }
                            }
                        }

                        item {
                            Text("Daftar Produk, Stok Isi & Stok Wadah Kosong", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                        }

                        if (current.products.isEmpty()) {
                            item {
                                Text("Belum ada data stok produk.")
                            }
                        } else {
                            items(current.products, key = { "product-${it.id ?: it.name}" }) { product ->
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
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(product.name, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                                                Text(
                                                    "Kategori: ${product.category ?: "Umum"}",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }

                                            Badge(
                                                containerColor = if (product.stock > 20) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer
                                            ) {
                                                Text(
                                                    "Stok Isi: ${product.stock} ${product.unit ?: "pcs"}",
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }

                                        Divider()

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text("Stok Wadah Kosong Galon: ${product.emptyGallonStock} Pcs", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                                                Text("Stok Wadah Kosong LPG: ${product.emptyLpgStock} Pcs", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.tertiary)
                                                if (userRole == "owner") {
                                                    Text("HPP: ${currencyFormatter.format(product.costPrice ?: 1500.0)} | Jual: ${currencyFormatter.format(product.price)}", style = MaterialTheme.typography.bodySmall)
                                                }
                                            }

                                            if (canManageStock) {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    IconButton(onClick = { openEditDialog(product) }) {
                                                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary)
                                                    }
                                                    IconButton(onClick = { product.id?.let { stokViewModel.deleteProduct(it) } }) {
                                                        Icon(Icons.Default.Delete, contentDescription = "Hapus", tint = MaterialTheme.colorScheme.error)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        item {
                            Spacer(modifier = Modifier.height(80.dp))
                        }
                    }
                }
                is StokState.Error -> {
                    Text(current.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.align(Alignment.Center))
                }
                else -> {}
            }

            if (showDialog && canManageStock) {
                AlertDialog(
                    onDismissRequest = { showDialog = false },
                    title = { Text(if (editingProduct == null) "Tambah Produk & Opsi Wadah Kosong" else "Edit Produk, Stok & Wadah Kosong") },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nama Produk") })
                            OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Kategori (AMDK/LPG/Air Isi Ulang)") })
                            OutlinedTextField(value = stock, onValueChange = { stock = it }, label = { Text("Stok Fisik Produk / Isi (Pcs)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(value = emptyGallonStock, onValueChange = { emptyGallonStock = it }, label = { Text("Opsi Stok Wadah Kosong Galon (Pcs)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(value = emptyLpgStock, onValueChange = { emptyLpgStock = it }, label = { Text("Opsi Stok Wadah Kosong Tabung LPG (Pcs)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(value = costPrice, onValueChange = { costPrice = it }, label = { Text("HPP / Harga Beli (Rp)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(value = price, onValueChange = { price = it }, label = { Text("Harga Jual (Rp)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                            OutlinedTextField(value = unit, onValueChange = { unit = it }, label = { Text("Satuan (galon/tabung/dus/pcs)") })
                            OutlinedTextField(
                                value = reorderPoint,
                                onValueChange = { reorderPoint = it.filter { ch -> ch.isDigit() } },
                                label = { Text("Batas stok minimum (peringatan, kosong = tanpa)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Hitung wadah kosong saat terjual/dikirim", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                                Switch(checked = trackEmpty, onCheckedChange = { trackEmpty = it })
                            }
                        }
                    },
                    confirmButton = {
                        Button(onClick = {
                            if (name.isNotBlank()) {
                                val cp = costPrice.toDoubleOrNull() ?: 0.0
                                val p = price.toDoubleOrNull() ?: 0.0
                                val s = stock.toIntOrNull() ?: 0
                                val eg = emptyGallonStock.toIntOrNull() ?: 0
                                val el = emptyLpgStock.toIntOrNull() ?: 0
                                val rp = reorderPoint.toIntOrNull()
                                if (p <= 0.0) {
                                    Toast.makeText(context, "Harga jual wajib diisi", Toast.LENGTH_SHORT).show()
                                } else {
                                    if (editingProduct == null) {
                                        stokViewModel.addProduct(name, category, p, cp, s, eg, el, unit, rp, trackEmpty)
                                    } else {
                                        editingProduct?.id?.let { stokViewModel.updateProduct(it, name, category, p, cp, s, eg, el, unit, editingProduct, rp, trackEmpty) }
                                    }
                                    showDialog = false
                                }
                            }
                        }) {
                            Text("Simpan Data Produk & Wadah")
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
