package com.depotpro.app.ui.expense

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.Expense
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class ExpenseState {
    object Loading : ExpenseState()
    data class Success(val expenses: List<Expense>) : ExpenseState()
    data class Error(val message: String) : ExpenseState()
}

class ExpenseViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<ExpenseState> = depotRepository.expensesState
        .map { toState(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ExpenseState.Loading)

    private fun toState(load: Load<List<Expense>>): ExpenseState = when (load) {
        is Load.Loading -> ExpenseState.Loading
        is Load.Failed -> ExpenseState.Error(load.message)
        is Load.Ready -> ExpenseState.Success(load.data)
    }

    fun loadExpenses() {
        viewModelScope.launch { depotRepository.refreshExpenses() }
    }

    fun addExpense(category: String, amount: Double, note: String) {
        viewModelScope.launch {
            depotRepository.createExpense(Expense(category = category.trim(), amount = amount, note = note))
        }
    }

    fun updateExpense(id: String, category: String, amount: Double, note: String) {
        viewModelScope.launch {
            depotRepository.updateExpense(Expense(id = id, category = category.trim(), amount = amount, note = note))
        }
    }

    fun deleteExpense(id: String) {
        viewModelScope.launch { depotRepository.deleteExpense(id) }
    }
}
