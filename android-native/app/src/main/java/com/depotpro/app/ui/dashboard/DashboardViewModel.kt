package com.depotpro.app.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.DashboardSummary
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

data class DailySales(
    val day: String,
    val amount: Double
)

sealed class DashboardState {
    object Loading : DashboardState()
    data class Success(
        val summary: DashboardSummary,
        val dailySales: List<DailySales>,
        val emptyGallons: Int,
        val emptyLpg: Int
    ) : DashboardState()
    data class Error(val message: String) : DashboardState()
}

class DashboardViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<DashboardState> = depotRepository.summaryState
        .map { toState(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DashboardState.Loading)

    private fun toState(load: Load<DashboardSummary>): DashboardState = when (load) {
        is Load.Loading -> DashboardState.Loading
        is Load.Failed -> DashboardState.Error(load.message)
        is Load.Ready -> {
            val s = load.data
            DashboardState.Success(
                summary = s,
                dailySales = s.dailySales.orEmpty().map { DailySales(it.day, it.amount) },
                emptyGallons = s.emptyGallons,
                emptyLpg = s.emptyLpg
            )
        }
    }
}
