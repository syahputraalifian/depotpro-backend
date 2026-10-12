package com.depotpro.app.ui

import android.widget.Toast
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.TextFields
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.depotpro.app.navigation.Screen
import com.depotpro.app.ui.auth.AuthViewModel
import com.depotpro.app.ui.auth.LoginScreen
import com.depotpro.app.ui.auth.Session
import com.depotpro.app.ui.customer.CustomerScreen
import com.depotpro.app.ui.customer.CustomerViewModel
import com.depotpro.app.ui.dashboard.DashboardScreen
import com.depotpro.app.ui.dashboard.DashboardViewModel
import com.depotpro.app.ui.driver.DriverScreen
import com.depotpro.app.ui.driver.DriverViewModel
import com.depotpro.app.ui.expense.ExpenseScreen
import com.depotpro.app.ui.expense.ExpenseViewModel
import com.depotpro.app.ui.pos.PosScreen
import com.depotpro.app.ui.pos.PosViewModel
import com.depotpro.app.ui.receivable.ReceivableScreen
import com.depotpro.app.ui.receivable.ReceivableViewModel
import com.depotpro.app.ui.report.ReportScreen
import com.depotpro.app.ui.report.ReportViewModel
import com.depotpro.app.ui.stok.StokScreen
import com.depotpro.app.ui.stok.StokViewModel
import kotlinx.coroutines.flow.SharedFlow
import kotlin.math.abs

/** Menu yang boleh diakses tiap peran (server juga memeriksa hak akses). Urutan pertama = halaman awal. */
private fun screensFor(role: String?): List<Screen> = when (role) {
    "owner" -> listOf(
        Screen.Dashboard, Screen.Pos, Screen.Stok, Screen.Driver,
        Screen.Customer, Screen.Report, Screen.Expense, Screen.Receivable
    )
    "kasir" -> listOf(Screen.Pos, Screen.Customer, Screen.Receivable, Screen.Report, Screen.Dashboard)
    "gudang" -> listOf(Screen.Stok)
    "driver" -> listOf(Screen.Driver)
    else -> emptyList()
}

private fun roleLabel(role: String?): String = when (role) {
    "owner" -> "Pemilik"
    "kasir" -> "Kasir"
    "gudang" -> "Gudang"
    "driver" -> "Driver"
    else -> "Staf"
}

private val FONT_OPTIONS = listOf(
    "Kecil" to 0.85f,
    "Normal" to 1.0f,
    "Besar" to 1.15f,
    "Sangat besar" to 1.3f
)

@Composable
fun MainLayout(
    authViewModel: AuthViewModel,
    dashboardViewModel: DashboardViewModel,
    posViewModel: PosViewModel,
    stokViewModel: StokViewModel,
    driverViewModel: DriverViewModel,
    customerViewModel: CustomerViewModel,
    reportViewModel: ReportViewModel,
    expenseViewModel: ExpenseViewModel,
    receivableViewModel: ReceivableViewModel,
    messages: SharedFlow<String>,
    fontScale: Float,
    onFontScaleChange: (Float) -> Unit
) {
    val session by authViewModel.session.collectAsState()

    if (session is Session.Loading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    } else {
        AppContent(
            session = session,
            authViewModel = authViewModel,
            dashboardViewModel = dashboardViewModel,
            posViewModel = posViewModel,
            stokViewModel = stokViewModel,
            driverViewModel = driverViewModel,
            customerViewModel = customerViewModel,
            reportViewModel = reportViewModel,
            expenseViewModel = expenseViewModel,
            receivableViewModel = receivableViewModel,
            messages = messages,
            fontScale = fontScale,
            onFontScaleChange = onFontScaleChange
        )
    }
}

@Composable
private fun AppContent(
    session: Session,
    authViewModel: AuthViewModel,
    dashboardViewModel: DashboardViewModel,
    posViewModel: PosViewModel,
    stokViewModel: StokViewModel,
    driverViewModel: DriverViewModel,
    customerViewModel: CustomerViewModel,
    reportViewModel: ReportViewModel,
    expenseViewModel: ExpenseViewModel,
    receivableViewModel: ReceivableViewModel,
    messages: SharedFlow<String>,
    fontScale: Float,
    onFontScaleChange: (Float) -> Unit
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val role: String? = (session as? Session.LoggedIn)?.role
    val screens = screensFor(role)
    val loggedIn = role != null

    val primaryScreens = if (screens.size > 5) screens.take(4) else screens
    val overflowScreens = if (screens.size > 5) screens.drop(4) else emptyList()

    val snackbarHostState = remember { SnackbarHostState() }
    var showPasswordDialog by remember { mutableStateOf(false) }
    var showFontDialog by remember { mutableStateOf(false) }
    var showMoreDialog by remember { mutableStateOf(false) }

    LaunchedEffect(messages) {
        messages.collect { snackbarHostState.showSnackbar(it) }
    }

    // Arahkan sesuai status login/peran (login berhasil, logout, sesi berakhir, atau menu tidak diizinkan).
    LaunchedEffect(session) {
        if (loggedIn && screens.isNotEmpty()) {
            val target = screens.first().route
            if (currentRoute != target && (currentRoute == null || currentRoute == Screen.Login.route || currentRoute !in screens.map { it.route })) {
                navController.navigate(target) {
                    popUpTo(0) { inclusive = true }
                    launchSingleTop = true
                }
            }
        } else if (!loggedIn) {
            if (currentRoute != null && currentRoute != Screen.Login.route) {
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                    launchSingleTop = true
                }
            }
        }
    }

    fun goTo(route: String) {
        if (currentRoute != route && screens.isNotEmpty()) {
            navController.navigate(route) {
                popUpTo(screens.first().route) { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            if (loggedIn && currentRoute != null && currentRoute != Screen.Login.route) {
                SessionHeader(
                    roleLabel = roleLabel(role),
                    onFontSize = { showFontDialog = true },
                    onChangePassword = { showPasswordDialog = true },
                    onLogout = { authViewModel.logout() }
                )
            }
        },
        bottomBar = {
            if (loggedIn && screens.size > 1 && currentRoute != Screen.Login.route) {
                NavigationBar {
                    primaryScreens.forEach { screen ->
                        NavigationBarItem(
                            selected = currentRoute == screen.route,
                            onClick = { goTo(screen.route) },
                            icon = { Icon(screen.icon, contentDescription = screen.title) },
                            label = {
                                Text(
                                    screen.title,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    style = MaterialTheme.typography.labelSmall
                                )
                            },
                            alwaysShowLabel = true
                        )
                    }
                    if (overflowScreens.isNotEmpty()) {
                        NavigationBarItem(
                            selected = overflowScreens.any { it.route == currentRoute },
                            onClick = { showMoreDialog = true },
                            icon = { Icon(Icons.Default.MoreHoriz, contentDescription = "Menu lainnya") },
                            label = {
                                Text(
                                    "Lainnya",
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    style = MaterialTheme.typography.labelSmall
                                )
                            },
                            alwaysShowLabel = true
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        // Tanpa animasi perpindahan layar: terasa instan dan ringan di HP lama.
        NavHost(
            navController = navController,
            startDestination = Screen.Login.route,
            modifier = Modifier.padding(innerPadding),
            enterTransition = { EnterTransition.None },
            exitTransition = { ExitTransition.None },
            popEnterTransition = { EnterTransition.None },
            popExitTransition = { ExitTransition.None }
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    authViewModel = authViewModel,
                    onLoginSuccess = { userRole ->
                        val target = screensFor(userRole).firstOrNull()?.route ?: Screen.Dashboard.route
                        navController.navigate(target) {
                            popUpTo(0) { inclusive = true }
                            launchSingleTop = true
                        }
                    }
                )
            }
            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    dashboardViewModel = dashboardViewModel,
                    authViewModel = authViewModel,
                    onLogout = { authViewModel.logout() }
                )
            }
            composable(Screen.Pos.route) { PosScreen(posViewModel = posViewModel) }
            composable(Screen.Stok.route) { StokScreen(stokViewModel = stokViewModel, userRole = role) }
            composable(Screen.Driver.route) { DriverScreen(driverViewModel = driverViewModel, userRole = role) }
            composable(Screen.Customer.route) { CustomerScreen(customerViewModel = customerViewModel, userRole = role) }
            composable(Screen.Report.route) { ReportScreen(reportViewModel = reportViewModel, userRole = role) }
            composable(Screen.Expense.route) { ExpenseScreen(expenseViewModel = expenseViewModel) }
            composable(Screen.Receivable.route) { ReceivableScreen(receivableViewModel = receivableViewModel) }
        }
    }

    if (showMoreDialog) {
        AlertDialog(
            onDismissRequest = { showMoreDialog = false },
            title = { Text("Menu Lainnya") },
            text = {
                Column {
                    overflowScreens.forEach { screen ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    showMoreDialog = false
                                    goTo(screen.route)
                                }
                                .padding(vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Icon(screen.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Text(screen.title, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showMoreDialog = false }) { Text("Tutup") } }
        )
    }

    if (showFontDialog) {
        FontSizeDialog(
            current = fontScale,
            onSelect = onFontScaleChange,
            onDismiss = { showFontDialog = false }
        )
    }

    if (showPasswordDialog) {
        ChangePasswordDialog(
            onDismiss = { showPasswordDialog = false },
            onSubmit = { old, new, done -> authViewModel.changePassword(old, new, done) }
        )
    }
}

@Composable
private fun SessionHeader(
    roleLabel: String,
    onFontSize: () -> Unit,
    onChangePassword: () -> Unit,
    onLogout: () -> Unit
) {
    var menuOpen by remember { mutableStateOf(false) }
    Surface(color = MaterialTheme.colorScheme.surface, shadowElevation = 2.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("DepotPro", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(roleLabel, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Box {
                IconButton(onClick = { menuOpen = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = "Menu")
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(
                        text = { Text("Ukuran huruf") },
                        leadingIcon = { Icon(Icons.Default.TextFields, contentDescription = null) },
                        onClick = { menuOpen = false; onFontSize() }
                    )
                    DropdownMenuItem(
                        text = { Text("Ganti password") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                        onClick = { menuOpen = false; onChangePassword() }
                    )
                    DropdownMenuItem(
                        text = { Text("Keluar") },
                        leadingIcon = { Icon(Icons.Default.ExitToApp, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
                        onClick = { menuOpen = false; onLogout() }
                    )
                }
            }
        }
    }
}

@Composable
private fun FontSizeDialog(current: Float, onSelect: (Float) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Ukuran Huruf") },
        text = {
            Column {
                FONT_OPTIONS.forEach { (label, value) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(value) }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(selected = abs(current - value) < 0.01f, onClick = { onSelect(value) })
                        Text(label, style = MaterialTheme.typography.bodyLarge)
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    "Contoh: Galon 19L - Rp 125.000",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Selesai") } }
    )
}

@Composable
private fun ChangePasswordDialog(
    onDismiss: () -> Unit,
    onSubmit: (String, String, (Boolean, String) -> Unit) -> Unit
) {
    val context = LocalContext.current
    var oldPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Ganti Password") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = oldPassword,
                    onValueChange = { oldPassword = it },
                    label = { Text("Password Lama") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                )
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it },
                    label = { Text("Password Baru (min. 6 karakter)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                )
                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = { Text("Konfirmasi Password Baru") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                )
            }
        },
        confirmButton = {
            Button(
                enabled = !busy,
                onClick = {
                    if (newPassword != confirmPassword) {
                        Toast.makeText(context, "Konfirmasi password baru tidak cocok!", Toast.LENGTH_SHORT).show()
                    } else {
                        busy = true
                        onSubmit(oldPassword, newPassword) { success, message ->
                            busy = false
                            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                            if (success) onDismiss()
                        }
                    }
                }
            ) { Text("Simpan") }
        },
        dismissButton = {
            TextButton(enabled = !busy, onClick = onDismiss) { Text("Batal") }
        }
    )
}
