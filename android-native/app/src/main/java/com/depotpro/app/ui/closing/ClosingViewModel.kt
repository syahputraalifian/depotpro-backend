package com.depotpro.app.ui.closing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.DailyReport
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class ClosingState {
    object Loading : ClosingState()
    data class Success(val report: DailyReport) : ClosingState()
    data class Error(val message: String) : ClosingState()
}

class ClosingViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<ClosingState> = depotRepository.dailyState
        .map { toState(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ClosingState.Loading)

    private fun toState(load: Load<DailyReport>): ClosingState = when (load) {
        is Load.Loading -> ClosingState.Loading
        is Load.Failed -> ClosingState.Error(load.message)
        is Load.Ready -> ClosingState.Success(load.data)
    }

    fun load() {
        viewModelScope.launch { depotRepository.refreshDaily() }
    }

    fun deleteClosing(date: String) {
        viewModelScope.launch { depotRepository.deleteClosing(date) }
    }

    fun save(countedCash: Double, note: String) {
        viewModelScope.launch { depotRepository.saveClosing(countedCash, note) }
    }
}
