package com.depotpro.app.ui.report

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.DashboardSummary
import com.depotpro.app.data.model.Order
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import com.depotpro.app.data.repository.dataOrEmpty
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class FinancialReportSummary(
    val totalSales: Double = 0.0,
    val totalHpp: Double = 0.0,
    val totalExpenses: Double = 0.0,
    val totalReceivables: Double = 0.0,
    val netProfit: Double = 0.0,
    val gallonsSold: Int = 0,
    val totalOrders: Int = 0
)

sealed class ReportState {
    object Loading : ReportState()
    data class Success(val summary: FinancialReportSummary, val orders: List<Order>) : ReportState()
    data class Error(val message: String) : ReportState()
}

class ReportViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<ReportState> = combine(
        depotRepository.summaryState,
        depotRepository.ordersState
    ) { summary, orders ->
        toState(summary, orders)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ReportState.Loading)

    private fun toState(summary: Load<DashboardSummary>, orders: Load<List<Order>>): ReportState = when {
        summary is Load.Failed -> ReportState.Error(summary.message)
        summary is Load.Ready -> {
            val s = summary.data
            ReportState.Success(
                FinancialReportSummary(
                    totalSales = s.totalSales,
                    totalHpp = s.totalHpp,
                    totalExpenses = s.totalExpenses,
                    totalReceivables = s.totalReceivables,
                    netProfit = s.netProfit,
                    gallonsSold = s.gallonsSold,
                    totalOrders = s.totalOrders
                ),
                orders.dataOrEmpty()
            )
        }
        else -> ReportState.Loading
    }

    fun deleteTransaction(orderId: String) {
        viewModelScope.launch { depotRepository.cancelOrder(orderId) }
    }
}
