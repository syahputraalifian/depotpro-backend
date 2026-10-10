package com.depotpro.app.ui.pos

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.Customer
import com.depotpro.app.data.model.Driver
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PosScreen(posViewModel: PosViewModel) {
    val context = LocalContext.current
    val posState by posViewModel.posState.collectAsState()
    val cart by posViewModel.cart.collectAsState()
    val checkoutSuccess by posViewModel.checkoutSuccess.collectAsState()

    var customerName by remember { mutableStateOf("") }
    var selectedCustomer by remember { mutableStateOf<Customer?>(null) }
    var expandedCustomerMenu by remember { mutableStateOf(false) }

    var cashPaidStr by remember { mutableStateOf("") }
    var selectedDriver by remember { mutableStateOf<Driver?>(null) }
    var expandedDriverMenu by remember { mutableStateOf(false) }

    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("id", "ID"))

    val total = cart.sumOf { it.product.price * it.quantity }
    val cashPaid = if (cashPaidStr.isBlank()) total else (cashPaidStr.toDoubleOrNull() ?: total)
    val change = (cashPaid - total).coerceAtLeast(0.0)

    LaunchedEffect(checkoutSuccess) {
        if (checkoutSuccess) {
            Toast.makeText(context, "TRANSAKSI BERHASIL! Stok & Tugas Kurir Disinkronkan.", Toast.LENGTH_LONG).show()
            customerName = ""
            selectedCustomer = null
            cashPaidStr = ""
            selectedDriver = null
            posViewModel.resetCheckoutState()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Kasir Depot (POS & Dispatch)", fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Katalog Produk Depot:",
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
            )

            when (val state = posState) {
                is PosState.Loading -> {
                    Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is PosState.Success -> {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.products, key = { it.id ?: it.name }) { product ->
                            val cartCount = cart.find { it.product.id == product.id }?.quantity ?: 0
                            Card(
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(product.name, fontWeight = FontWeight.Bold)
                                        Text(
                                            "Kategori: ${product.category ?: "Umum"}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            currencyFormatter.format(product.price),
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.primary,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            "Stok: ${product.stock} ${product.unit ?: "pcs"}",
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }

                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        if (cartCount > 0) {
                                            IconButton(onClick = { posViewModel.removeFromCart(product) }) {
                                                Icon(Icons.Default.Remove, contentDescription = "Kurang")
                                            }
                                            Text("$cartCount", fontWeight = FontWeight.Bold)
                                        }
                                        Button(
                                            onClick = { posViewModel.addToCart(product) },
                                            enabled = product.stock > cartCount,
                                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                                        ) {
                                            Icon(Icons.Default.Add, contentDescription = "Tambah")
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Tambah")
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (cart.isNotEmpty()) {
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
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Total Tagihan:", fontWeight = FontWeight.Bold)
                                    Text(currencyFormatter.format(total), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
                                }

                                // Customer Selection Dropdown
                                ExposedDropdownMenuBox(
                                    expanded = expandedCustomerMenu,
                                    onExpandedChange = { expandedCustomerMenu = !expandedCustomerMenu }
                                ) {
                                    OutlinedTextField(
                                        value = if (selectedCustomer != null) selectedCustomer!!.name else customerName.ifBlank { "Pilih Pelanggan Terdaftar (Opsional)" },
                                        onValueChange = {
                                            customerName = it
                                            selectedCustomer = null
                                        },
                                        label = { Text("Pelanggan") },
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedCustomerMenu) },
                                        modifier = Modifier.fillMaxWidth().menuAnchor()
                                    )
                                    ExposedDropdownMenu(
                                        expanded = expandedCustomerMenu,
                                        onDismissRequest = { expandedCustomerMenu = false }
                                    ) {
                                        DropdownMenuItem(
                                            text = { Text("-- Pelanggan Umum (Walk-in) --") },
                                            onClick = {
                                                selectedCustomer = null
                                                customerName = "Pelanggan Umum"
                                                expandedCustomerMenu = false
                                            }
                                        )
                                        state.customers.forEach { customer ->
                                            DropdownMenuItem(
                                                text = { Text("${customer.name} (${customer.phone ?: "-"})") },
                                                onClick = {
                                                    selectedCustomer = customer
                                                    customerName = customer.name
                                                    expandedCustomerMenu = false
                                                }
                                            )
                                        }
                                    }
                                }

                                // Driver Selection Dropdown
                                ExposedDropdownMenuBox(
                                    expanded = expandedDriverMenu,
                                    onExpandedChange = { expandedDriverMenu = !expandedDriverMenu }
                                ) {
                                    OutlinedTextField(
                                        value = selectedDriver?.name ?: "Pilih Kurir / Driver Pengiriman (Opsional)",
                                        onValueChange = {},
                                        readOnly = true,
                                        label = { Text("Assign ke Driver") },
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedDriverMenu) },
                                        modifier = Modifier.fillMaxWidth().menuAnchor()
                                    )
                                    ExposedDropdownMenu(
                                        expanded = expandedDriverMenu,
                                        onDismissRequest = { expandedDriverMenu = false }
                                    ) {
                                        DropdownMenuItem(
                                            text = { Text("-- Tanpa Driver (Ambil Sendiri) --") },
                                            onClick = {
                                                selectedDriver = null
                                                expandedDriverMenu = false
                                            }
                                        )
                                        state.drivers.forEach { driver ->
                                            DropdownMenuItem(
                                                text = { Text("${driver.name} (${driver.status})") },
                                                onClick = {
                                                    selectedDriver = driver
                                                    expandedDriverMenu = false
                                                }
                                            )
                                        }
                                    }
                                }

                                OutlinedTextField(
                                    value = cashPaidStr,
                                    onValueChange = { cashPaidStr = it },
                                    label = { Text("Uang Tunai (Kosongkan = Uang Pas)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Kembalian:", fontWeight = FontWeight.Bold)
                                    Text(currencyFormatter.format(change), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.secondary)
                                }

                                Button(
                                    onClick = {
                                        if (cashPaid < total) {
                                            Toast.makeText(context, "Uang pembayaran kurang!", Toast.LENGTH_SHORT).show()
                                        } else {
                                            val finalCustomer = if (selectedCustomer != null) selectedCustomer!!.name else customerName.ifBlank { "Pelanggan Umum" }
                                            posViewModel.checkout(finalCustomer, "Cash", selectedDriver)
                                        }
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(50.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    enabled = true
                                ) {
                                    Icon(Icons.Default.ShoppingCart, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "CHECKOUT & PROSES TRANSAKSI",
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                                    )
                                }
                            }
                        }
                    }
                }
                is PosState.Error -> {
                    Text(state.message, color = MaterialTheme.colorScheme.error)
                }
                else -> {}
            }
        }
    }
}
