package com.depotpro.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.MoneyOff
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.TwoWheeler
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Login : Screen("login", "Login", Icons.Default.Dashboard)
    object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Dashboard)
    object Pos : Screen("pos", "Kasir", Icons.Default.PointOfSale)
    object Stok : Screen("stok", "Stok", Icons.Default.Inventory)
    object Driver : Screen("driver", "Driver", Icons.Default.TwoWheeler)
    object Customer : Screen("pelanggan", "Pelanggan", Icons.Default.People)
    object Report : Screen("laporan", "Laporan", Icons.Default.Assessment)
    object Expense : Screen("pengeluaran", "Pengeluaran", Icons.Default.MoneyOff)
    object Receivable : Screen("piutang", "Piutang", Icons.Default.AccountBalanceWallet)
}
