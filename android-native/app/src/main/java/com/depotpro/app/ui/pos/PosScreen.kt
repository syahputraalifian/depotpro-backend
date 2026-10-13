package com.depotpro.app.ui.pos

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.Customer
import com.depotpro.app.data.model.Driver

private val PAYMENT_OPTIONS = listOf(
    "cash" to "Tunai",
    "transfer" to "Transfer",
    "qris" to "QRIS",
    "tempo" to "Tempo / Utang",
    "deposit" to "Saldo Deposit"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PosScreen(posViewModel: PosViewModel) {
    val context = LocalContext.current
    val posState by posViewModel.posState.collectAsState()
    val cart by posViewModel.cart.collectAsState()
    val receipt by posViewModel.receipt.collectAsState()

    var query by remember { mutableStateOf("") }
    var showCheckout by remember { mutableStateOf(false) }

    val total = cart.sumOf { it.product.price * it.quantity }
    val itemCount = cart.sumOf { it.quantity }

    Scaffold(
        bottomBar = {
            if (cart.isNotEmpty()) {
                Surface(tonalElevation = 3.dp, shadowElevation = 6.dp) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("$itemCount item", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(rupiah(total), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        }
                        Button(onClick = { showCheckout = true }) {
                            Icon(Icons.Default.ShoppingCart, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Bayar", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("Cari produk...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
            )

            when (val state = posState) {
                is PosState.Loading -> {
                    Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is PosState.Success -> {
                    val products = state.products.filter { query.isBlank() || it.name.contains(query, ignoreCase = true) }
                    if (products.isEmpty()) {
                        Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                            Text("Produk tidak ditemukan", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.weight(1f).fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(products, key = { it.id ?: it.name }) { product ->
                                val cartCount = cart.find { it.product.id == product.id }?.quantity ?: 0
                                Card(modifier = Modifier.fillMaxWidth()) {
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
                                                rupiah(product.price),
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = MaterialTheme.colorScheme.primary,
                                                fontWeight = FontWeight.Bold
                                            )
                                            Text(
                                                if (product.stock > 0) "Stok: ${product.stock} ${product.unit ?: "pcs"}" else "Stok habis",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = if (product.stock > 0) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.error
                                            )
                                        }
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
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
                                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                            ) {
                                                Icon(Icons.Default.Add, contentDescription = "Tambah")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (showCheckout && cart.isNotEmpty()) {
                        CheckoutDialog(
                            cartLines = cart.map { Triple(it.product.name, it.quantity, it.product.price) },
                            total = total,
                            customers = state.customers,
                            drivers = state.drivers,
                            onDismiss = { showCheckout = false },
                            onConfirm = { customer, name, payment, driver, cash ->
                                showCheckout = false
                                posViewModel.checkout(customer, name, payment, driver, cash)
                            }
                        )
                    }
                }
                is PosState.Error -> {
                    Text(state.message, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }

    receipt?.let { r ->
        AlertDialog(
            onDismissRequest = { posViewModel.dismissReceipt() },
            title = { Text("Transaksi Berhasil") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text(
                        buildReceiptText(r),
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, buildReceiptText(r))
                    }
                    context.startActivity(Intent.createChooser(send, "Bagikan struk"))
                }) { Text("Bagikan Struk") }
            },
            dismissButton = {
                TextButton(onClick = { posViewModel.dismissReceipt() }) { Text("Selesai") }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CheckoutDialog(
    cartLines: List<Triple<String, Int, Double>>,
    total: Double,
    customers: List<Customer>,
    drivers: List<Driver>,
    onDismiss: () -> Unit,
    onConfirm: (Customer?, String, String, Driver?, Double?) -> Unit
) {
    val context = LocalContext.current
    var customerName by remember { mutableStateOf("") }
    var selectedCustomer by remember { mutableStateOf<Customer?>(null) }
    var customerMenu by remember { mutableStateOf(false) }
    var payment by remember { mutableStateOf("cash") }
    var paymentMenu by remember { mutableStateOf(false) }
    var cashPaidStr by remember { mutableStateOf("") }
    var selectedDriver by remember { mutableStateOf<Driver?>(null) }
    var driverMenu by remember { mutableStateOf(false) }

    val cashPaid = if (cashPaidStr.isBlank()) total else (cashPaidStr.toDoubleOrNull() ?: total)
    val change = (cashPaid - total).coerceAtLeast(0.0)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Pembayaran") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                cartLines.forEach { (name, qty, price) ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("$name x$qty", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        Text(rupiah(price * qty), style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Divider()
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Total", fontWeight = FontWeight.Bold)
                    Text(rupiah(total), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }

                // Pelanggan
                ExposedDropdownMenuBox(expanded = customerMenu, onExpandedChange = { customerMenu = !customerMenu }) {
                    OutlinedTextField(
                        value = selectedCustomer?.name ?: customerName,
                        onValueChange = {
                            customerName = it
                            selectedCustomer = null
                        },
                        label = { Text("Pelanggan (kosong = Umum)") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = customerMenu) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        singleLine = true
                    )
                    ExposedDropdownMenu(expanded = customerMenu, onDismissRequest = { customerMenu = false }) {
                        DropdownMenuItem(
                            text = { Text("Pelanggan Umum (walk-in)") },
                            onClick = {
                                selectedCustomer = null
                                customerName = ""
                                customerMenu = false
                            }
                        )
                        customers.forEach { customer ->
                            DropdownMenuItem(
                                text = { Text("${customer.name} (${customer.phone ?: "-"})") },
                                onClick = {
                                    selectedCustomer = customer
                                    customerName = customer.name
                                    customerMenu = false
                                }
                            )
                        }
                    }
                }

                // Metode pembayaran
                ExposedDropdownMenuBox(expanded = paymentMenu, onExpandedChange = { paymentMenu = !paymentMenu }) {
                    OutlinedTextField(
                        value = paymentLabel(payment),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Metode Pembayaran") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = paymentMenu) },
                        modifier = Modifier.fillMaxWidth().menuAnchor()
                    )
                    ExposedDropdownMenu(expanded = paymentMenu, onDismissRequest = { paymentMenu = false }) {
                        PAYMENT_OPTIONS.forEach { (code, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    payment = code
                                    paymentMenu = false
                                }
                            )
                        }
                    }
                }

                when (payment) {
                    "cash" -> {
                        OutlinedTextField(
                            value = cashPaidStr,
                            onValueChange = { cashPaidStr = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Uang diterima (kosong = uang pas)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Kembalian", fontWeight = FontWeight.Bold)
                            Text(rupiah(change), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.secondary)
                        }
                    }
                    "tempo" -> Text(
                        "Dicatat sebagai piutang pelanggan (jatuh tempo 7 hari). Wajib memilih pelanggan terdaftar.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    "deposit" -> Text(
                        "Saldo deposit pelanggan: ${rupiah(selectedCustomer?.deposit ?: 0.0)}. Wajib memilih pelanggan terdaftar.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    else -> Text(
                        "Pastikan pembayaran sudah diterima sebelum memproses.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Driver
                ExposedDropdownMenuBox(expanded = driverMenu, onExpandedChange = { driverMenu = !driverMenu }) {
                    OutlinedTextField(
                        value = selectedDriver?.name ?: "Ambil sendiri (tanpa kurir)",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Kurir Pengiriman") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = driverMenu) },
                        modifier = Modifier.fillMaxWidth().menuAnchor()
                    )
                    ExposedDropdownMenu(expanded = driverMenu, onDismissRequest = { driverMenu = false }) {
                        DropdownMenuItem(
                            text = { Text("Ambil sendiri (tanpa kurir)") },
                            onClick = {
                                selectedDriver = null
                                driverMenu = false
                            }
                        )
                        drivers.forEach { driver ->
                            DropdownMenuItem(
                                text = { Text("${driver.name} (${driver.status ?: "-"})") },
                                onClick = {
                                    selectedDriver = driver
                                    driverMenu = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val customer = selectedCustomer
                when {
                    payment == "cash" && cashPaid < total ->
                        Toast.makeText(context, "Uang diterima kurang dari total!", Toast.LENGTH_SHORT).show()
                    (payment == "tempo" || payment == "deposit") && customer == null ->
                        Toast.makeText(context, "Pilih pelanggan terdaftar untuk metode ini", Toast.LENGTH_SHORT).show()
                    payment == "deposit" && (customer?.deposit ?: 0.0) < total ->
                        Toast.makeText(context, "Saldo deposit pelanggan tidak cukup", Toast.LENGTH_SHORT).show()
                    else -> onConfirm(
                        customer,
                        customerName,
                        payment,
                        selectedDriver,
                        if (payment == "cash") cashPaid else null
                    )
                }
            }) { Text("Proses Transaksi") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } }
    )
}
