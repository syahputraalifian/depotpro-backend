package com.depotpro.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.depotpro.app.ui.MainLayout
import com.depotpro.app.ui.auth.AuthViewModel
import com.depotpro.app.ui.customer.CustomerViewModel
import com.depotpro.app.ui.dashboard.DashboardViewModel
import com.depotpro.app.ui.driver.DriverViewModel
import com.depotpro.app.ui.expense.ExpenseViewModel
import com.depotpro.app.ui.pos.PosViewModel
import com.depotpro.app.ui.receivable.ReceivableViewModel
import com.depotpro.app.ui.report.ReportViewModel
import com.depotpro.app.ui.stok.StokViewModel
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Sinkronisasi berkala hanya saat aplikasi terlihat & pengguna sudah login (tanpa polling di background).
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                authViewModel.userRole.collectLatest { role ->
                    if (role != null) {
                        var first = true
                        while (true) {
                            container.depotRepository.refreshAll(role, silent = !first)
                            first = false
                            delay(15_000)
                        }
                    }
                }
            }
        }

        setContent {
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
                        messages = container.depotRepository.messages
                    )
                }
            }
        }
    }
}
