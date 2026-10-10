package com.depotpro.app.ui.receivable

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.Receivable
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class ReceivableState {
    object Loading : ReceivableState()
    data class Success(val receivables: List<Receivable>) : ReceivableState()
    data class Error(val message: String) : ReceivableState()
}

class ReceivableViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<ReceivableState> = depotRepository.receivablesState
        .map { toState(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ReceivableState.Loading)

    private fun toState(load: Load<List<Receivable>>): ReceivableState = when (load) {
        is Load.Loading -> ReceivableState.Loading
        is Load.Failed -> ReceivableState.Error(load.message)
        is Load.Ready -> ReceivableState.Success(load.data)
    }

    fun loadReceivables() {
        viewModelScope.launch { depotRepository.refreshReceivables() }
    }

    fun addReceivable(customerName: String, totalAmount: Double, dueDate: String) {
        viewModelScope.launch {
            depotRepository.createReceivable(
                Receivable(customerName = customerName.trim(), totalAmount = totalAmount, paidAmount = 0.0, dueDate = dueDate)
            )
        }
    }

    fun updateReceivable(id: String, customerName: String, totalAmount: Double, dueDate: String) {
        viewModelScope.launch {
            depotRepository.updateReceivable(
                Receivable(id = id, customerName = customerName.trim(), totalAmount = totalAmount, paidAmount = 0.0, dueDate = dueDate)
            )
        }
    }

    fun deleteReceivable(id: String) {
        viewModelScope.launch { depotRepository.deleteReceivable(id) }
    }

    fun payReceivable(id: String, amountPaid: Double) {
        if (id.isBlank() || amountPaid <= 0) return
        viewModelScope.launch { depotRepository.payReceivable(id, amountPaid) }
    }
}
