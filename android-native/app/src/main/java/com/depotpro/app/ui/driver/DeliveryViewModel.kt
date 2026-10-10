package com.depotpro.app.ui.driver

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.Driver
import com.depotpro.app.data.model.Order
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import com.depotpro.app.data.repository.dataOrEmpty
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class DeliveryState {
    object Loading : DeliveryState()
    data class Success(val orders: List<Order>, val drivers: List<Driver>) : DeliveryState()
    data class Error(val message: String) : DeliveryState()
}

class DeliveryViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<DeliveryState> = combine(
        depotRepository.ordersState,
        depotRepository.driversState
    ) { orders, drivers ->
        toState(orders, drivers)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DeliveryState.Loading)

    private fun toState(orders: Load<List<Order>>, drivers: Load<List<Driver>>): DeliveryState = when (orders) {
        is Load.Loading -> DeliveryState.Loading
        is Load.Failed -> DeliveryState.Error(orders.message)
        is Load.Ready -> DeliveryState.Success(orders.data.filter { it.isDelivery }, drivers.dataOrEmpty())
    }

    fun loadData() {
        viewModelScope.launch {
            depotRepository.refreshOrders()
            depotRepository.refreshDrivers()
        }
    }

    fun updateOrderStatus(orderId: String, newStatus: String) {
        viewModelScope.launch { depotRepository.updateOrderStatus(orderId, newStatus, 0, 0) }
    }
}
