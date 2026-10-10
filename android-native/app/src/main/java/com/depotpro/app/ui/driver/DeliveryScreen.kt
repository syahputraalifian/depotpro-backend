package com.depotpro.app.ui.driver

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeliveryScreen(deliveryViewModel: DeliveryViewModel) {
    val state by deliveryViewModel.state.collectAsState()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("id", "ID"))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pengiriman & Detail Barang Kurir", fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            when (val current = state) {
                is DeliveryState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is DeliveryState.Success -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text("Daftar Tugas Pengiriman", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))

                        if (current.orders.isEmpty()) {
                            Text("Tidak ada pengiriman aktif.")
                        } else {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                items(current.orders, key = { it.id ?: it.customerName.orEmpty() }) { order ->
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
                                                    Text(order.status?.uppercase() ?: "PENDING", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), fontWeight = FontWeight.Bold)
                                                }
                                            }

                                            Text("Pelanggan: ${order.customerName ?: "Umum"}", style = MaterialTheme.typography.bodyMedium)

                                            Text("Barang yang dikirim:", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                            if (order.items.isEmpty()) {
                                                Text("- 1x Air Isi Ulang Galon 19L", style = MaterialTheme.typography.bodySmall)
                                            } else {
                                                order.items.forEach { item ->
                                                    Text("- ${item.productName} (${item.quantity} ${item.productName.lowercase().let { if (it.contains("gas")) "tabung" else "galon" }})", style = MaterialTheme.typography.bodySmall)
                                                }
                                            }

                                            Text("Total: ${currencyFormatter.format(order.totalAmount)}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)

                                            Divider()

                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                if (order.status != "on_delivery" && order.status != "delivered") {
                                                    OutlinedButton(
                                                        onClick = { order.id?.let { deliveryViewModel.updateOrderStatus(it, "on_delivery") } },
                                                        modifier = Modifier.weight(1f)
                                                    ) {
                                                        Text("Mulai Kirim")
                                                    }
                                                }
                                                if (order.status != "delivered") {
                                                    Button(
                                                        onClick = { order.id?.let { deliveryViewModel.updateOrderStatus(it, "delivered") } },
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
                }
                is DeliveryState.Error -> {
                    Text(current.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.align(Alignment.Center))
                }
                else -> {}
            }
        }
    }
}
