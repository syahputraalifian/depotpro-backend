package com.depotpro.app.ui.customer

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.Customer
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class CustomerState {
    object Loading : CustomerState()
    data class Success(val customers: List<Customer>) : CustomerState()
    data class Error(val message: String) : CustomerState()
}

class CustomerViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<CustomerState> = depotRepository.customersState
        .map { toState(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), CustomerState.Loading)

    private fun toState(load: Load<List<Customer>>): CustomerState = when (load) {
        is Load.Loading -> CustomerState.Loading
        is Load.Failed -> CustomerState.Error(load.message)
        is Load.Ready -> CustomerState.Success(load.data)
    }

    fun loadCustomers() {
        viewModelScope.launch { depotRepository.refreshCustomers() }
    }

    fun addCustomer(name: String, phone: String, address: String) {
        viewModelScope.launch {
            depotRepository.createCustomer(Customer(name = name.trim(), phone = phone, address = address))
        }
    }

    fun updateCustomer(id: String, name: String, phone: String, address: String) {
        viewModelScope.launch {
            depotRepository.updateCustomer(Customer(id = id, name = name.trim(), phone = phone, address = address))
        }
    }

    /** [amount] positif = isi saldo, negatif = kurangi (khusus pemilik). */
    fun adjustDeposit(customerId: String, amount: Double, reason: String) {
        viewModelScope.launch { depotRepository.adjustDeposit(customerId, amount, reason.ifBlank { null }) }
    }

    fun deleteCustomer(customerId: String) {
        viewModelScope.launch { depotRepository.deleteCustomer(customerId) }
    }
}
