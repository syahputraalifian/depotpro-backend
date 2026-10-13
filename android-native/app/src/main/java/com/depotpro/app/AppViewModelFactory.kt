package com.depotpro.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.depotpro.app.ui.auth.AuthViewModel
import com.depotpro.app.ui.closing.ClosingViewModel
import com.depotpro.app.ui.customer.CustomerViewModel
import com.depotpro.app.ui.dashboard.DashboardViewModel
import com.depotpro.app.ui.driver.DeliveryViewModel
import com.depotpro.app.ui.driver.DriverViewModel
import com.depotpro.app.ui.expense.ExpenseViewModel
import com.depotpro.app.ui.pos.PosViewModel
import com.depotpro.app.ui.receivable.ReceivableViewModel
import com.depotpro.app.ui.report.ReportViewModel
import com.depotpro.app.ui.setoran.SetoranViewModel
import com.depotpro.app.ui.stok.StokViewModel
import com.depotpro.app.ui.users.UsersViewModel

class AppViewModelFactory(private val container: AppContainer) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        val repo = container.depotRepository
        val viewModel: ViewModel = when {
            modelClass.isAssignableFrom(AuthViewModel::class.java) -> AuthViewModel(container.authRepository, repo)
            modelClass.isAssignableFrom(DashboardViewModel::class.java) -> DashboardViewModel(repo)
            modelClass.isAssignableFrom(PosViewModel::class.java) -> PosViewModel(repo)
            modelClass.isAssignableFrom(StokViewModel::class.java) -> StokViewModel(repo)
            modelClass.isAssignableFrom(DriverViewModel::class.java) -> DriverViewModel(repo)
            modelClass.isAssignableFrom(DeliveryViewModel::class.java) -> DeliveryViewModel(repo)
            modelClass.isAssignableFrom(CustomerViewModel::class.java) -> CustomerViewModel(repo)
            modelClass.isAssignableFrom(ReportViewModel::class.java) -> ReportViewModel(repo)
            modelClass.isAssignableFrom(ExpenseViewModel::class.java) -> ExpenseViewModel(repo)
            modelClass.isAssignableFrom(ReceivableViewModel::class.java) -> ReceivableViewModel(repo)
            modelClass.isAssignableFrom(ClosingViewModel::class.java) -> ClosingViewModel(repo)
            modelClass.isAssignableFrom(UsersViewModel::class.java) -> UsersViewModel(repo)
            modelClass.isAssignableFrom(SetoranViewModel::class.java) -> SetoranViewModel(repo)
            else -> throw IllegalArgumentException("ViewModel tidak dikenal: ${modelClass.name}")
        }
        return viewModel as T
    }
}
