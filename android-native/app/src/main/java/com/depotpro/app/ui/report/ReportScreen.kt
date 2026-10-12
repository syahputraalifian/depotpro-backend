package com.depotpro.app.ui.report

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ShowChart
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
fun ReportScreen(reportViewModel: ReportViewModel, userRole: String?) {
    val state by reportViewModel.state.collectAsState()
    // Daftar riwayat tidak lazy: render bertahap agar layar tidak berat di HP lama.
    var visibleCount by remember { mutableStateOf(30) }
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("id", "ID"))
    val isOwner = userRole == "owner"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Laporan Keuangan & Laba Rugi", fontWeight = FontWeight.Bold) }
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
                is ReportState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is ReportState.Success -> {
                    val summary = current.summary
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Executive Financial P&L Statement Card
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(20.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
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
                                        Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                        Text("Ringkasan Laba Rugi Depot", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                                    }

                                    Badge(
                                        containerColor = if (summary.netProfit >= 0) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer
                                    ) {
                                        Text("STATUS: SEHAT", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), fontWeight = FontWeight.Bold)
                                    }
                                }

                                Divider()

                                ReportRow(label = "(+) Total Omset Penjualan", value = currencyFormatter.format(summary.totalSales), isBold = true)
                                ReportRow(label = "(-) Total HPP Modal Beli Produk", value = currencyFormatter.format(summary.totalHpp))
                                ReportRow(label = "(-) Total Pengeluaran Operasional", value = currencyFormatter.format(summary.totalExpenses))
                                ReportRow(label = "(!) Sisa Piutang Belum Terbayar", value = currencyFormatter.format(summary.totalReceivables))

                                Divider()

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text("Estimasi Laba Bersih Depot:", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                        Text(currencyFormatter.format(summary.netProfit), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleLarge)
                                    }

                                    Icon(Icons.Default.ShowChart, contentDescription = null, modifier = Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }

                        Text("Riwayat Transaksi POS Terperinci", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))

                        if (current.orders.isEmpty()) {
                            Text("Belum ada transaksi tercatat.", style = MaterialTheme.typography.bodyMedium)
                        } else {
                            current.orders.take(visibleCount).forEach { order ->
                                Card(
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(order.id ?: "INV", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                            Text(currencyFormatter.format(order.totalAmount), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleSmall)
                                        }

                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(Icons.Default.CalendarToday, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.secondary)
                                            Text(
                                                text = order.createdAt ?: "Sabtu, 03 Oktober 2026 - 10:15 WIB",
                                                style = MaterialTheme.typography.bodySmall,
                                                fontWeight = FontWeight.SemiBold,
                                                color = MaterialTheme.colorScheme.secondary
                                            )
                                        }

                                        Divider()

                                        Text("Pelanggan: ${order.customerName ?: "Umum"}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                                        Text("Items: ${order.items.joinToString { "${it.productName} (${it.quantity}x)" }}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

                                        if (isOwner) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.End
                                            ) {
                                                IconButton(onClick = { order.id?.let { reportViewModel.deleteTransaction(it) } }) {
                                                    Icon(Icons.Default.Delete, contentDescription = "Hapus Transaksi", tint = MaterialTheme.colorScheme.error)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            if (current.orders.size > visibleCount) {
                                OutlinedButton(
                                    onClick = { visibleCount += 30 },
                                    modifier = Modifier.fillMaxWidth()
                                ) { Text("Tampilkan lebih banyak (${current.orders.size - visibleCount} lagi)") }
                            }
                        }

                        Spacer(modifier = Modifier.height(40.dp))
                    }
                }
                is ReportState.Error -> {
                    Text(current.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.align(Alignment.Center))
                }
                else -> {}
            }
        }
    }
}

@Composable
fun ReportRow(label: String, value: String, isBold: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = if (isBold) MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold) else MaterialTheme.typography.bodySmall)
        Text(value, fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal, style = if (isBold) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.bodySmall)
    }
}
