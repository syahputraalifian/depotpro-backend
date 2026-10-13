package com.depotpro.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.Modifier
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.depotpro.app.ui.MainLayout
import com.depotpro.app.ui.auth.AuthViewModel
import com.depotpro.app.ui.closing.ClosingViewModel
import com.depotpro.app.ui.customer.CustomerViewModel
import com.depotpro.app.ui.dashboard.DashboardViewModel
import com.depotpro.app.ui.driver.DriverViewModel
import com.depotpro.app.ui.expense.ExpenseViewModel
import com.depotpro.app.ui.pos.PosViewModel
import com.depotpro.app.ui.receivable.ReceivableViewModel
import com.depotpro.app.ui.report.ReportViewModel
import com.depotpro.app.ui.setoran.SetoranViewModel
import com.depotpro.app.ui.stok.StokViewModel
import com.depotpro.app.ui.users.UsersViewModel
import com.depotpro.app.ui.theme.DepotProTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val container by lazy { (application as DepotProApp).container }
    private val factory by lazy { AppViewModelFactory(container) }

    private val authViewModel: AuthViewModel by viewModels { factory }
    private val dashboardViewModel: DashboardViewModel by viewModels { factory }
    private val posViewModel: PosViewModel by viewModels { factory }
    private val stokViewModel: StokViewModel by viewModels { factory }
    private val driverViewModel: DriverViewModel by viewModels { factory }
    private val customerViewModel: CustomerViewModel by viewModels { factory }
    private val reportViewModel: ReportViewModel by viewModels { factory }
    private val expenseViewModel: ExpenseViewModel by viewModels { factory }
    private val receivableViewModel: ReceivableViewModel by viewModels { factory }
    private val closingViewModel: ClosingViewModel by viewModels { factory }
    private val usersViewModel: UsersViewModel by viewModels { factory }
    private val setoranViewModel: SetoranViewModel by viewModels { factory }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Sinkronisasi berkala hanya saat aplikasi terlihat & pengguna sudah login (tanpa polling di background).
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                authViewModel.userRole.collectLatest { role ->
                    if (role != null) {
                        var tick = 0
                        while (true) {
                            // Penuh (semua data) tiap 4 putaran = 60 detik; sisanya hanya stok/transaksi/ringkasan.
                            container.depotRepository.refreshAll(role, silent = tick > 0, light = tick % 4 != 0)
                            tick++
                            delay(15_000)
                        }
                    }
                }
            }
        }

        setContent {
            val fontScale by container.tokenManager.fontScaleFlow.collectAsState(initial = 1.0f)
            val baseDensity = LocalDensity.current
            // Skala huruf pilihan pengguna dikalikan skala sistem, berlaku untuk seluruh aplikasi.
            CompositionLocalProvider(
                LocalDensity provides Density(baseDensity.density, baseDensity.fontScale * fontScale)
            ) {
                DepotProTheme {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colorScheme.background
                    ) {
                        MainLayout(
                            authViewModel = authViewModel,
                            dashboardViewModel = dashboardViewModel,
                            posViewModel = posViewModel,
                            stokViewModel = stokViewModel,
                            driverViewModel = driverViewModel,
                            customerViewModel = customerViewModel,
                            reportViewModel = reportViewModel,
                            expenseViewModel = expenseViewModel,
                            receivableViewModel = receivableViewModel,
                            closingViewModel = closingViewModel,
                            usersViewModel = usersViewModel,
                            setoranViewModel = setoranViewModel,
                            messages = container.depotRepository.messages,
                            fontScale = fontScale,
                            onFontScaleChange = { scale ->
                                lifecycleScope.launch { container.tokenManager.saveFontScale(scale) }
                            }
                        )
                    }
                }
            }
        }
    }
}
