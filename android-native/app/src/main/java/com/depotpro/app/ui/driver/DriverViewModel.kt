package com.depotpro.app.ui.driver

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.depotpro.app.data.model.Driver
import com.depotpro.app.data.model.Order
import com.depotpro.app.data.model.Payroll
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.Load
import com.depotpro.app.data.repository.dataOrEmpty
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class DriverState {
    object Loading : DriverState()
    data class Success(val drivers: List<Driver>, val orders: List<Order>) : DriverState()
    data class Error(val message: String) : DriverState()
}

class DriverViewModel(private val depotRepository: DepotRepository) : ViewModel() {

    val state: StateFlow<DriverState> = combine(
        depotRepository.driversState,
        depotRepository.ordersState
    ) { drivers, orders ->
        toState(drivers, orders)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DriverState.Loading)

    private fun toState(drivers: Load<List<Driver>>, orders: Load<List<Order>>): DriverState = when {
        drivers is Load.Failed -> DriverState.Error(drivers.message)
        drivers is Load.Loading || orders is Load.Loading -> DriverState.Loading
        else -> DriverState.Success(drivers.dataOrEmpty(), orders.dataOrEmpty().filter { it.isDelivery })
    }

    fun loadData() {
        viewModelScope.launch {
            depotRepository.refreshDrivers()
            depotRepository.refreshOrders()
        }
    }

    fun addDriver(name: String, phone: String, status: String) {
        viewModelScope.launch {
            depotRepository.createDriver(Driver(name = name.trim(), phone = phone, status = status))
        }
    }

    fun updateDriver(id: String, name: String, phone: String, status: String) {
        viewModelScope.launch {
            // Pertahankan gaji/komisi yang sudah ada; hanya ubah nama, telepon, status.
            val existing = depotRepository.currentDrivers().firstOrNull { it.id == id }
            val updated = existing?.copy(name = name.trim(), phone = phone, status = status)
                ?: Driver(id = id, name = name.trim(), phone = phone, status = status)
            depotRepository.updateDriver(updated)
        }
    }

    /** Ubah gaji pokok, komisi, uang bensin, dan potongan. Data lain driver dipertahankan. */
    fun updateSalary(id: String, base: Double, gallonRate: Double, lpgRate: Double, fuel: Double, deductions: Double) {
        viewModelScope.launch {
            val existing = depotRepository.currentDrivers().firstOrNull { it.id == id } ?: return@launch
            depotRepository.updateDriver(
                existing.copy(
                    baseSalary = base,
                    gallonCommissionRate = gallonRate,
                    lpgCommissionRate = lpgRate,
                    fuelAllowance = fuel,
                    deductions = deductions
                )
            )
        }
    }

    /** Muat riwayat pembayaran gaji seorang driver (hasil dikirim lewat [onResult]). */
    fun loadPayrolls(driverId: String, onResult: (List<Payroll>) -> Unit) {
        viewModelScope.launch { onResult(depotRepository.loadPayrolls(driverId) ?: emptyList()) }
    }

    fun undoPayroll(id: String, onDone: () -> Unit) {
        viewModelScope.launch {
            depotRepository.undoPayroll(id)
            onDone()
        }
    }

    fun recalculate(driverId: String) {
        viewModelScope.launch { depotRepository.recalculateDriver(driverId) }
    }

    fun deleteDriver(driverId: String) {
        viewModelScope.launch { depotRepository.deleteDriver(driverId) }
    }

    fun payDriver(driverId: String) {
        viewModelScope.launch { depotRepository.payDriver(driverId) }
    }

    fun updateOrderStatus(orderId: String, newStatus: String, gallonsReturned: Int = 0, lpgReturned: Int = 0) {
        viewModelScope.launch {
            depotRepository.updateOrderStatus(orderId, newStatus, gallonsReturned, lpgReturned)
        }
    }
}
